import { ObjectId } from "bson";
import { type PipelineStage, Types } from "mongoose";
import {
  type BuyerListingCard,
  type BuyerListingDetail,
  type CompareListing,
  type CompareListingItem,
  type ComparePayload,
  type CreateListingRequest,
  CropGrade,
  DomainEventName,
  type FarmerListing,
  ListingStatus,
  type MarketplaceQuery,
  MarketplaceSort,
  type PublicUser,
  type RelistListingRequest,
  UserRole,
  calculateCompareHighlights,
  calculateSubtotal,
  deriveBuyerListingStatus,
  evaluateFloorPrice,
} from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { getClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { logger } from "../../shared/logger.js";
import { Crop } from "../crops/crop.model.js";
import { Bid } from "../bids/bid.model.js";
import { AiAssessmentRecord } from "../ai/ai-assessment-record.model.js";
import { getPricePredictionProvider, hashAssessmentToken } from "../ai/ai.service.js";
import { releaseStock, reserveStockForListing } from "../inventory/inventory.service.js";
import { Listing, type ListingRecord } from "./listing.model.js";
import { assertValidListingTransition } from "./listing-state-machine.js";
import {
  type RawMarketplaceListingDoc,
  mapListingToBuyerCard,
  mapListingToBuyerDetail,
  mapListingToFarmerListing,
} from "./listing.mapper.js";
import {
  getWatchedListingIds,
  isListingWatched,
} from "../watchlist/watchlist.service.js";

function ensureObjectId(value: string): string {
  if (!/^[\da-f]{24}$/i.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid database ID format");
  }
  return value.toLowerCase();
}

/**
 * Creates and publishes a listing adhering strictly to the workflow in AUCTION_RULES §2.
 */
export async function createAndPublishListing(
  farmer: PublicUser,
  request: CreateListingRequest,
): Promise<{ listing: FarmerListing; warning?: string }> {
  // 1. Validate Crop, lot limits, floor price, and duration
  const cropId = ensureObjectId(request.cropId);
  const crop = await Crop.findById(cropId);
  if (!crop || !crop.isActive) {
    throw new AppError(404, "NOT_FOUND", "Crop not found or inactive in catalog");
  }

  if (request.quantityKg < crop.minLotKg || request.quantityKg > crop.maxLotKg) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Quantity must be between ${crop.minLotKg} kg and ${crop.maxLotKg} kg for ${crop.nameEn}`,
    );
  }

  if (request.floorPricePerKg <= 0 || !Number.isInteger(request.floorPricePerKg)) {
    throw new AppError(400, "VALIDATION_ERROR", "Floor price must be a positive integer in poisha");
  }

  const maxDurationMinutes = crop.shelfLifeHours * 60;
  if (request.durationMinutes > maxDurationMinutes) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Duration cannot exceed crop shelf life of ${crop.shelfLifeHours} hours (${maxDurationMinutes} minutes)`,
    );
  }

  // 2. Atomically consume the assessment record (single use, same farmer, same crop, unexpired)
  const clock = getClock();
  const currentInstant = clock.now();
  const assessmentTokenHash = hashAssessmentToken(request.assessmentToken);
  const assessmentRecord = await AiAssessmentRecord.findOneAndUpdate(
    {
      assessmentTokenHash,
      farmerId: ensureObjectId(farmer.id),
      cropId: crop._id,
      isConsumed: false,
      expiresAt: { $gt: currentInstant },
    },
    {
      $set: {
        isConsumed: true,
        consumedAt: currentInstant,
      },
    },
    { new: true },
  );

  if (!assessmentRecord) {
    const existing = await AiAssessmentRecord.findOne({ assessmentTokenHash });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Assessment record not found");
    }
    if (existing.farmerId.toString() !== farmer.id) {
      throw new AppError(403, "FORBIDDEN", "This assessment token does not belong to you");
    }
    if (existing.cropId.toString() !== crop._id.toString()) {
      throw new AppError(400, "VALIDATION_ERROR", "Assessment token is for a different crop");
    }
    if (existing.expiresAt.getTime() <= clock.timestamp()) {
      throw new AppError(400, "VALIDATION_ERROR", "Assessment token has expired");
    }
    if (existing.isConsumed) {
      throw new AppError(409, "CONFLICT", "Assessment token has already been used");
    }
    throw new AppError(400, "VALIDATION_ERROR", "Assessment record cannot be consumed");
  }

  // 3. Recompute price guidance on server for immutable snapshot
  const guidance = await getPricePredictionProvider().predictPrice(
    {
      cropId: crop._id.toString(),
      grade: assessmentRecord.grade as "A" | "B" | "C",
      quantityKg: request.quantityKg,
    },
    farmer.division,
  );

  // Check floor price warning (warn, do not block)
  let floorWarning: string | undefined;
  try {
    const evaluation = evaluateFloorPrice(
      request.floorPricePerKg,
      guidance.lowPerKg,
      guidance.highPerKg,
    );
    if (evaluation === "overpriced") {
      floorWarning = "Floor price is more than 30% above expected market high; lot may not sell.";
    } else if (evaluation === "below-market") {
      floorWarning = "Floor price is below estimated market low.";
    }
  } catch {
    // Range check failed or guidance abnormal; warning is non-blocking
  }

  // 4. Reserve stock with Phase 2 reserve function
  const listingId = new Types.ObjectId().toString();
  const reserveOperationId = `list-${listingId}`;

  try {
    await reserveStockForListing({
      farmerId: farmer.id,
      cropId: crop._id.toString(),
      quantityKg: request.quantityKg,
      listingId,
      operationId: reserveOperationId,
      note: `Reserved for listing ${listingId}`,
    });
  } catch (reserveError) {
    // Unconsume assessment token if stock reservation fails
    await AiAssessmentRecord.updateOne(
      { _id: assessmentRecord._id },
      { $set: { isConsumed: false }, $unset: { consumedAt: "" } },
    );
    throw reserveError;
  }

  // 5. Create listing as ACTIVE
  assertValidListingTransition(ListingStatus.DRAFT, ListingStatus.ACTIVE, "publish");

  const now = clock.now();
  const endsAt = new Date(now.getTime() + request.durationMinutes * 60 * 1000);

  let createdListing: InstanceType<typeof Listing>;
  try {
    createdListing = new Listing({
      _id: listingId,
      farmerId: farmer.id,
      cropId: crop._id,
      quantityKg: request.quantityKg,
      images: assessmentRecord.images.map((img) => ({
        url: img.url,
        width: img.width,
        height: img.height,
      })),
      aiAssessment: {
        grade: assessmentRecord.grade,
        confidence: assessmentRecord.confidence,
        confidenceBand: assessmentRecord.confidenceBand,
        classProbabilities: assessmentRecord.classProbabilities,
        qualityNotes: assessmentRecord.qualityNotes,
        cropMatch: assessmentRecord.cropMatch,
        modelVersion: assessmentRecord.modelVersion,
        provider: assessmentRecord.provider,
        degraded: assessmentRecord.degraded,
        assessedAt: assessmentRecord.assessedAt,
        imageHashes: assessmentRecord.imageHashes,
      },
      aiPriceGuidance: {
        lowPerKg: guidance.lowPerKg,
        expectedPerKg: guidance.expectedPerKg,
        highPerKg: guidance.highPerKg,
        trend: guidance.trend,
        confidence: guidance.confidence,
        explanation: guidance.explanation,
        modelVersion: guidance.modelVersion,
        provider: guidance.provider,
        degraded: guidance.degraded,
        generatedAt: new Date(guidance.generatedAt),
        suggestedFloorPerKg: guidance.suggestedFloorPerKg,
      },
      floorPricePerKg: request.floorPricePerKg,
      minIncrementPerKg: crop.minIncrementPerKg,
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      bidCount: 0,
      location: {
        division: farmer.division,
        district: farmer.district,
        upazila: farmer.upazila,
      },
      pickupNote: request.pickupNote,
    });

    await createdListing.save();
  } catch (creationError) {
    // If creation fails after stock was reserved, release it (compensation) and log the failure
    logger.error(
      {
        err: creationError,
        listingId,
        farmerId: farmer.id,
        cropId: crop._id.toString(),
      },
      "Listing creation failed after stock reserved; executing compensating stock release",
    );

    try {
      await releaseStock({
        farmerId: farmer.id,
        cropId: crop._id.toString(),
        quantityKg: request.quantityKg,
        listingId,
        operationId: `compensate-list-${listingId}`,
        note: `Compensating release for failed listing ${listingId}`,
      });
    } catch (compensationError) {
      logger.error(
        { err: compensationError, listingId },
        "CRITICAL: Compensating stock release failed",
      );
    }

    await AiAssessmentRecord.updateOne(
      { _id: assessmentRecord._id },
      { $set: { isConsumed: false }, $unset: { consumedAt: "" } },
    );

    throw creationError;
  }

  const mapped = mapListingToFarmerListing(createdListing.toObject());
  return { listing: mapped, warning: floorWarning };
}

export interface FarmerListingsResult {
  listings: FarmerListing[];
  total: number;
}

export async function getFarmerListings(
  farmerId: string,
  options: { status?: ListingStatus; page: number; limit: number },
): Promise<FarmerListingsResult> {
  const farmerObjectId = ensureObjectId(farmerId);
  const filter: Record<string, unknown> = {
    farmerId: farmerObjectId,
  };

  if (options.status) {
    filter.status = options.status;
  }

  const skip = (options.page - 1) * options.limit;

  const [records, total] = await Promise.all([
    Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    Listing.countDocuments(filter),
  ]);

  const listings = records.map((record) =>
    mapListingToFarmerListing(
      record as unknown as ListingRecord & { _id: { toString(): string }; createdAt: Date },
    ),
  );

  return { listings, total };
}

export async function getListingById(
  listingId: string,
  user: PublicUser,
): Promise<FarmerListing | BuyerListingDetail> {
  const id = ensureObjectId(listingId);
  const record = await Listing.findById(id).lean();

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  const isOwner =
    user.role === UserRole.FARMER &&
    record.farmerId.toString().toLowerCase() === user.id.toLowerCase();

  // Owner farmer can view their own listing in any status with farmer fields
  if (isOwner) {
    return mapListingToFarmerListing(
      record as unknown as ListingRecord & { _id: { toString(): string }; createdAt: Date },
    );
  }

  // Non-owners (buyers, other farmers):
  // DRAFT listings are strictly invisible to non-owners
  if (record.status === ListingStatus.DRAFT) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  let myHighestBidPerKg: number | null = null;
  let hasBids = false;
  let isWatched = false;

  if (user.role === UserRole.BUYER) {
    const [buyerBids, watched] = await Promise.all([
      Bid.find({
        listingId: id,
        buyerId: ensureObjectId(user.id),
      })
        .select("amountPerKg")
        .lean(),
      isListingWatched(user.id, listingId),
    ]);

    isWatched = watched;

    // A buyer can open any ACTIVE listing, any listing they have bid on (so won and lost bids stay viewable),
    // plus any ended listing in their watchlist (read-only, Decision D-34);
    // anything else is NOT_FOUND.
    if (record.status !== ListingStatus.ACTIVE && buyerBids.length === 0 && !isWatched) {
      throw new AppError(404, "NOT_FOUND", "Listing not found");
    }

    if (buyerBids.length > 0) {
      hasBids = true;
      myHighestBidPerKg = Math.max(...buyerBids.map((b) => b.amountPerKg));
    }
  } else {
    // Non-owner farmers can only view ACTIVE listings
    if (record.status !== ListingStatus.ACTIVE) {
      throw new AppError(404, "NOT_FOUND", "Listing not found");
    }
  }

  const myStatus = deriveBuyerListingStatus({
    listingStatus: record.status as ListingStatus,
    currentBidderId: record.currentBidderId ? record.currentBidderId.toString() : null,
    buyerId: user.id,
    hasBids,
  });

  const cropDoc = await Crop.findById(record.cropId).lean();
  const cropSummary = {
    id: record.cropId.toString(),
    slug: cropDoc?.slug ?? "unknown",
    nameEn: cropDoc?.nameEn ?? "Unknown",
    nameBn: cropDoc?.nameBn ?? "অজানা",
    unit: cropDoc?.unit ?? "kg",
    minIncrementPerKg: cropDoc?.minIncrementPerKg ?? record.minIncrementPerKg ?? 100,
  };

  const detail = mapListingToBuyerDetail(
    record as unknown as ListingRecord & { _id: { toString(): string }; createdAt: Date },
    cropSummary,
    {
      myStatus,
      myHighestBidPerKg,
    },
  );

  if (user.role === UserRole.BUYER) {
    detail.isWatched = isWatched;
  }

  return detail;
}

/**
 * Cancels an active listing adhering strictly to AUCTION_RULES §9.
 * Only allowed if zero bids exist. Enforced by a conditional atomic update
 * so that a simultaneous bid and cancel cannot both win.
 * Releases reserved stock and transitions status to CANCELLED.
 */
export async function cancelListing(listingId: string, farmer: PublicUser): Promise<FarmerListing> {
  const validListingId = ensureObjectId(listingId);
  const validFarmerId = ensureObjectId(farmer.id);

  // 1. Initial pre-checks
  const listing = await Listing.findById(validListingId);
  if (!listing) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  if (listing.farmerId.toString().toLowerCase() !== validFarmerId) {
    throw new AppError(403, "FORBIDDEN", "Only the listing owner can cancel this listing");
  }

  if (listing.status !== ListingStatus.ACTIVE) {
    throw new AppError(
      400,
      "INVALID_TRANSITION",
      `Cannot cancel listing in '${listing.status}' status`,
    );
  }

  if (listing.bidCount > 0) {
    throw new AppError(400, "HAS_BIDS", "Cannot cancel listing with existing bids");
  }

  assertValidListingTransition(listing.status, ListingStatus.CANCELLED, "cancel");

  // 2. Conditional atomic update
  const clock = getClock();
  const now = clock.now();
  const cancelledListing = await Listing.findOneAndUpdate(
    {
      _id: validListingId,
      farmerId: validFarmerId,
      status: ListingStatus.ACTIVE,
      bidCount: 0,
    },
    {
      $set: {
        status: ListingStatus.CANCELLED,
        closedAt: now,
      },
    },
    { new: true },
  );

  if (!cancelledListing) {
    // Re-read listing to report the exact race reason
    const current = await Listing.findById(validListingId);
    if (!current) {
      throw new AppError(404, "NOT_FOUND", "Listing not found");
    }
    if (current.farmerId.toString().toLowerCase() !== validFarmerId) {
      throw new AppError(403, "FORBIDDEN", "Only the listing owner can cancel this listing");
    }
    if (current.status !== ListingStatus.ACTIVE) {
      throw new AppError(
        400,
        "INVALID_TRANSITION",
        `Cannot cancel listing in '${current.status}' status`,
      );
    }
    if (current.bidCount > 0) {
      throw new AppError(400, "HAS_BIDS", "Cannot cancel listing with existing bids");
    }
    throw new AppError(409, "CONFLICT", "Concurrent update prevented cancellation");
  }

  // 3. Release stock back to available
  await releaseStock({
    farmerId: validFarmerId,
    cropId: cancelledListing.cropId.toString(),
    quantityKg: cancelledListing.quantityKg,
    listingId: validListingId,
    operationId: `cancel-${validListingId}`,
    note: `Stock released on cancellation of listing ${validListingId}`,
  });

  // 4. Emit auction.closed event
  await getDomainEventEmitter().emit(DomainEventName.AUCTION_CLOSED, {
    listingId: validListingId,
    status: ListingStatus.CANCELLED,
    closedAt: now.toISOString(),
  });

  return mapListingToFarmerListing(
    cancelledListing.toObject() as unknown as ListingRecord & {
      _id: { toString(): string };
      createdAt: Date;
    },
  );
}

/**
 * Relists an unsold listing adhering to AUCTION_RULES §9 and gap 5.
 * Creates a new active listing from an EXPIRED_UNSOLD one with new floor and duration.
 * Re-checks and reserves stock, recomputes price guidance on the server,
 * enforces shelf-life freshness (returning GRADE_STALE if expired),
 * marks relistedFromId on the new listing, and guarantees only one relist per unsold listing.
 */
export async function relistListing(
  listingId: string,
  farmer: PublicUser,
  request: RelistListingRequest,
): Promise<{ listing: FarmerListing; warning?: string }> {
  const validListingId = ensureObjectId(listingId);
  const validFarmerId = ensureObjectId(farmer.id);

  // 1. Validate source listing
  const sourceListing = await Listing.findById(validListingId);
  if (!sourceListing) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  if (sourceListing.farmerId.toString().toLowerCase() !== validFarmerId) {
    throw new AppError(403, "FORBIDDEN", "Only the listing owner can relist this listing");
  }

  if (sourceListing.status !== ListingStatus.EXPIRED_UNSOLD) {
    throw new AppError(
      400,
      "INVALID_TRANSITION",
      `Cannot relist listing in '${sourceListing.status}' status. Only unsold listings can be relisted.`,
    );
  }

  if (sourceListing.relistedToListingId) {
    throw new AppError(409, "CONFLICT", "This unsold listing has already been relisted");
  }

  // 2. Fetch and validate crop
  const crop = await Crop.findById(sourceListing.cropId);
  if (!crop || !crop.isActive) {
    throw new AppError(404, "NOT_FOUND", "Crop not found or inactive in catalog");
  }

  if (request.floorPricePerKg <= 0 || !Number.isInteger(request.floorPricePerKg)) {
    throw new AppError(400, "VALIDATION_ERROR", "Floor price must be a positive integer in poisha");
  }

  const maxDurationMinutes = crop.shelfLifeHours * 60;
  if (request.durationMinutes > maxDurationMinutes) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Duration cannot exceed crop shelf life of ${crop.shelfLifeHours} hours (${maxDurationMinutes} minutes)`,
    );
  }

  // 3. Check quality assessment freshness window (shelf life)
  const clock = getClock();
  const now = clock.now();
  const freshnessWindowMs = crop.shelfLifeHours * 60 * 60 * 1000;
  const assessmentAgeMs = now.getTime() - sourceListing.aiAssessment.assessedAt.getTime();
  if (assessmentAgeMs > freshnessWindowMs) {
    throw new AppError(
      400,
      "GRADE_STALE",
      `Quality assessment is stale (age ${Math.round(assessmentAgeMs / 3600000)}h exceeds shelf life limit of ${crop.shelfLifeHours}h). Produce must be re-assessed to relist.`,
    );
  }

  // 4. Atomically claim source listing to prevent concurrent double-relisting
  const newListingId = new Types.ObjectId().toString();
  const claimedSource = await Listing.findOneAndUpdate(
    {
      _id: validListingId,
      farmerId: validFarmerId,
      status: ListingStatus.EXPIRED_UNSOLD,
      relistedToListingId: null,
    },
    {
      $set: {
        relistedToListingId: new ObjectId(newListingId),
      },
    },
    { new: true },
  );

  if (!claimedSource) {
    const current = await Listing.findById(validListingId);
    if (!current) throw new AppError(404, "NOT_FOUND", "Listing not found");
    if (current.farmerId.toString().toLowerCase() !== validFarmerId) {
      throw new AppError(403, "FORBIDDEN", "Only the listing owner can relist this listing");
    }
    if (current.status !== ListingStatus.EXPIRED_UNSOLD) {
      throw new AppError(
        400,
        "INVALID_TRANSITION",
        `Cannot relist listing in '${current.status}' status. Only unsold listings can be relisted.`,
      );
    }
    throw new AppError(409, "CONFLICT", "This unsold listing has already been relisted");
  }

  // 5. Re-check and reserve stock
  const reserveOperationId = `list-${newListingId}`;
  try {
    await reserveStockForListing({
      farmerId: validFarmerId,
      cropId: crop._id.toString(),
      quantityKg: sourceListing.quantityKg,
      listingId: newListingId,
      operationId: reserveOperationId,
      note: `Reserved for relisted listing ${newListingId}`,
    });
  } catch (reserveError) {
    // Roll back the claimed relistedToListingId on failure
    await Listing.updateOne({ _id: validListingId }, { $unset: { relistedToListingId: "" } });
    throw reserveError;
  }

  // 6. Recompute price guidance on server
  const guidance = await getPricePredictionProvider().predictPrice(
    {
      cropId: crop._id.toString(),
      grade: sourceListing.aiAssessment.grade as "A" | "B" | "C",
      quantityKg: sourceListing.quantityKg,
    },
    farmer.division,
  );

  let floorWarning: string | undefined;
  try {
    const evaluation = evaluateFloorPrice(
      request.floorPricePerKg,
      guidance.lowPerKg,
      guidance.highPerKg,
    );
    if (evaluation === "overpriced") {
      floorWarning = "Floor price is more than 30% above expected market high; lot may not sell.";
    } else if (evaluation === "below-market") {
      floorWarning = "Floor price is below estimated market low.";
    }
  } catch {
    // Non-blocking warning check
  }

  // 7. Create new ACTIVE listing
  assertValidListingTransition(ListingStatus.DRAFT, ListingStatus.ACTIVE, "publish");
  const endsAt = new Date(now.getTime() + request.durationMinutes * 60 * 1000);
  let createdListing: InstanceType<typeof Listing>;
  try {
    createdListing = new Listing({
      _id: newListingId,
      farmerId: validFarmerId,
      cropId: crop._id,
      quantityKg: sourceListing.quantityKg,
      images: sourceListing.images.map((img) => ({
        url: img.url,
        width: img.width,
        height: img.height,
      })),
      aiAssessment: {
        grade: sourceListing.aiAssessment.grade,
        confidence: sourceListing.aiAssessment.confidence,
        confidenceBand: sourceListing.aiAssessment.confidenceBand,
        classProbabilities: sourceListing.aiAssessment.classProbabilities,
        qualityNotes: sourceListing.aiAssessment.qualityNotes,
        cropMatch: sourceListing.aiAssessment.cropMatch,
        modelVersion: sourceListing.aiAssessment.modelVersion,
        provider: sourceListing.aiAssessment.provider,
        degraded: sourceListing.aiAssessment.degraded,
        assessedAt: sourceListing.aiAssessment.assessedAt,
        imageHashes: sourceListing.aiAssessment.imageHashes,
      },
      aiPriceGuidance: {
        lowPerKg: guidance.lowPerKg,
        expectedPerKg: guidance.expectedPerKg,
        highPerKg: guidance.highPerKg,
        trend: guidance.trend,
        confidence: guidance.confidence,
        explanation: guidance.explanation,
        modelVersion: guidance.modelVersion,
        provider: guidance.provider,
        degraded: guidance.degraded,
        generatedAt: new Date(guidance.generatedAt),
        suggestedFloorPerKg: guidance.suggestedFloorPerKg,
      },
      floorPricePerKg: request.floorPricePerKg,
      minIncrementPerKg: crop.minIncrementPerKg,
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      bidCount: 0,
      location: {
        division: farmer.division,
        district: farmer.district,
        upazila: farmer.upazila,
      },
      pickupNote: request.pickupNote ?? sourceListing.pickupNote,
      relistedFromId: new ObjectId(validListingId),
    });

    await createdListing.save();
  } catch (creationError) {
    logger.error(
      { err: creationError, newListingId, sourceListingId: validListingId },
      "Relisting creation failed; executing compensating release and unlocking source listing",
    );
    try {
      await releaseStock({
        farmerId: validFarmerId,
        cropId: crop._id.toString(),
        quantityKg: sourceListing.quantityKg,
        listingId: newListingId,
        operationId: `compensate-relist-${newListingId}`,
        note: `Compensating release for failed relisting ${newListingId}`,
      });
    } catch (compensationError) {
      logger.error(
        { err: compensationError, newListingId },
        "CRITICAL: Compensating stock release failed",
      );
    }

    await Listing.updateOne({ _id: validListingId }, { $unset: { relistedToListingId: "" } });

    throw creationError;
  }

  const mapped = mapListingToFarmerListing(
    createdListing.toObject() as unknown as ListingRecord & {
      _id: { toString(): string };
      createdAt: Date;
    },
  );

  return { listing: mapped, warning: floorWarning };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface MarketplaceListingsResult {
  listings: BuyerListingCard[];
  total: number;
}

interface AggregateFacetResult {
  data: RawMarketplaceListingDoc[];
  totalCount: Array<{ count: number }>;
}

/**
 * Queries active marketplace listings for buyers with filtering, sorting, and pagination.
 * Excludes listings past their end time using the injected Clock.
 * Returns anonymized buyer card DTOs with no private fields.
 */
export async function getMarketplaceListings(
  query: MarketplaceQuery,
  buyerUserId?: string,
): Promise<MarketplaceListingsResult> {
  if (query.status && query.status !== ListingStatus.ACTIVE) {
    throw new AppError(400, "VALIDATION_ERROR", "Buyers can only query ACTIVE listings");
  }

  const now = getClock().now();

  const matchStage: Record<string, unknown> = {
    status: ListingStatus.ACTIVE,
    endsAt: { $gt: now },
  };

  // 1. Crop filter (by ID or slug/name)
  if (query.cropId) {
    matchStage.cropId = new ObjectId(ensureObjectId(query.cropId));
  } else if (query.crop) {
    const cropDoc = await Crop.findOne({
      $or: [
        { slug: query.crop.toLowerCase() },
        { nameEn: new RegExp(`^${escapeRegex(query.crop)}$`, "i") },
      ],
    }).lean();

    if (!cropDoc) {
      return { listings: [], total: 0 };
    }
    matchStage.cropId = cropDoc._id;
  }

  // 2. Grade filter
  if (query.grade) {
    matchStage["aiAssessment.grade"] = query.grade;
  }

  // 3. Division & District filter
  if (query.division) {
    matchStage["location.division"] = new RegExp(`^${escapeRegex(query.division)}$`, "i");
  }
  if (query.district) {
    matchStage["location.district"] = new RegExp(`^${escapeRegex(query.district)}$`, "i");
  }

  // 4. Quantity filter
  const minQty = query.minQuantity ?? query.minQty;
  if (minQty !== undefined) {
    matchStage.quantityKg = { $gte: minQty };
  }

  // 5. Ending within filter (presets in hours: 1, 3, 6, 24)
  if (query.endingWithin !== undefined) {
    const targetEnd = new Date(now.getTime() + query.endingWithin * 3600 * 1000);
    matchStage.endsAt = { $gt: now, $lte: targetEnd };
  }

  // 6. Compute displayPricePerKg
  const displayPriceField: PipelineStage = {
    $addFields: {
      displayPricePerKg: {
        $cond: {
          if: {
            $and: [{ $gt: ["$bidCount", 0] }, { $ne: ["$currentBidPerKg", null] }],
          },
          then: "$currentBidPerKg",
          else: "$floorPricePerKg",
        },
      },
    },
  };

  // 7. Price range filter on computed displayPricePerKg
  const priceFilter: Record<string, unknown> = {};
  if (query.minPrice !== undefined) {
    priceFilter.$gte = query.minPrice;
  }
  if (query.maxPrice !== undefined) {
    priceFilter.$lte = query.maxPrice;
  }

  // 8. Sorting stage with deterministic tie-breaking (_id: 1)
  let sortStage: PipelineStage;
  switch (query.sort) {
    case MarketplaceSort.LOWEST_PRICE:
      sortStage = { $sort: { displayPricePerKg: 1, endsAt: 1, _id: 1 } };
      break;
    case MarketplaceSort.HIGHEST_GRADE:
      sortStage = { $sort: { "aiAssessment.grade": 1, endsAt: 1, _id: 1 } };
      break;
    case MarketplaceSort.NEWEST:
      sortStage = { $sort: { createdAt: -1, _id: 1 } };
      break;
    case MarketplaceSort.ENDING_SOONEST:
    default:
      sortStage = { $sort: { endsAt: 1, _id: 1 } };
      break;
  }

  const lookupCrop: PipelineStage = {
    $lookup: {
      from: "crops",
      localField: "cropId",
      foreignField: "_id",
      as: "cropDoc",
    },
  };

  const unwindCrop: PipelineStage = {
    $unwind: "$cropDoc",
  };

  const skip = (query.page - 1) * query.limit;
  const facetStage: PipelineStage = {
    $facet: {
      data: [{ $skip: skip }, { $limit: query.limit }],
      totalCount: [{ $count: "count" }],
    },
  };

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    displayPriceField,
    ...(Object.keys(priceFilter).length > 0
      ? [{ $match: { displayPricePerKg: priceFilter } } as PipelineStage]
      : []),
    lookupCrop,
    unwindCrop,
    sortStage,
    facetStage,
  ];

  const results = (await Listing.aggregate(pipeline).exec()) as [AggregateFacetResult];
  const facetResult = results[0];

  const listings = (facetResult?.data ?? []).map((doc) => mapListingToBuyerCard(doc));
  const total = facetResult?.totalCount?.[0]?.count ?? 0;

  if (buyerUserId && listings.length > 0) {
    const listingIds = listings.map((l) => l.id);
    const watchedSet = await getWatchedListingIds(buyerUserId, listingIds);
    for (const card of listings) {
      card.isWatched = watchedSet.has(card.id);
    }
  }

  return { listings, total };
}

/**
 * Compares 2 to 4 listings of the same crop for buyers according to Task 5.4 rules.
 * Applies Task 5.3 buyer visibility rules:
 * - ACTIVE listings are visible.
 * - Ended listings (SOLD, EXPIRED_UNSOLD, CANCELLED) are visible ONLY if the buyer bid on them.
 * - Non-visible or non-existent listings are reported in missingIds.
 * - DRAFT listings are strictly non-visible and reported in missingIds.
 * - Throws 400 COMPARE_MIXED_CROPS if visible listings belong to different crops.
 * - Computes highlights via shared calculateCompareHighlights.
 */
export async function compareListings(
  ids: string[],
  user: PublicUser,
): Promise<ComparePayload> {
  if (user.role !== UserRole.BUYER) {
    throw new AppError(403, "FORBIDDEN", "Only buyers can access compare");
  }

  const validObjectIds = ids.map((id) => ensureObjectId(id));

  // Fetch all requested listings
  const records = await Listing.find({
    _id: { $in: validObjectIds.map((id) => new ObjectId(id)) },
  }).lean();

  const recordMap = new Map(records.map((r) => [r._id.toString().toLowerCase(), r]));

  // Check buyer bids for all ended listings in one batch query
  const nonActiveIds = records
    .filter((r) => r.status !== ListingStatus.ACTIVE && r.status !== ListingStatus.DRAFT)
    .map((r) => r._id);

  const buyerBidsOnListings = new Set<string>();
  const watchedListingIds = new Set<string>();
  if (nonActiveIds.length > 0) {
    const [bids, watchedSet] = await Promise.all([
      Bid.find({
        listingId: { $in: nonActiveIds },
        buyerId: new ObjectId(ensureObjectId(user.id)),
      })
        .select("listingId")
        .lean(),
      getWatchedListingIds(
        user.id,
        nonActiveIds.map((id) => id.toString()),
      ),
    ]);
    for (const b of bids) {
      buyerBidsOnListings.add(b.listingId.toString().toLowerCase());
    }
    for (const w of watchedSet) {
      watchedListingIds.add(w.toLowerCase());
    }
  }

  const visibleRecords: typeof records = [];
  const missingIds: string[] = [];

  for (const requestedId of ids) {
    const idKey = requestedId.toLowerCase();
    const record = recordMap.get(idKey);

    if (!record) {
      missingIds.push(requestedId);
      continue;
    }

    if (record.status === ListingStatus.DRAFT) {
      // DRAFT is strictly invisible to buyers
      missingIds.push(requestedId);
      continue;
    }

    if (record.status !== ListingStatus.ACTIVE) {
      // Ended listing is only visible if buyer placed a bid on it or saved to watchlist (Decision D-34)
      if (!buyerBidsOnListings.has(idKey) && !watchedListingIds.has(idKey)) {
        missingIds.push(requestedId);
        continue;
      }
    }

    visibleRecords.push(record);
  }

  // Check single-crop constraint among visible listings
  const distinctCropIds = new Set(visibleRecords.map((r) => r.cropId.toString().toLowerCase()));
  if (distinctCropIds.size > 1) {
    throw new AppError(400, "COMPARE_MIXED_CROPS", "All listings in compare must belong to the same crop");
  }

  // If no visible listings, return empty compare payload with missingIds
  if (visibleRecords.length === 0) {
    return {
      cropId: null,
      listings: [],
      highlights: {
        lowestPriceListingIds: [],
        bestGradeListingIds: [],
        largestQuantityListingIds: [],
        bestValueListingIds: [],
        byListingId: {},
      },
      missingIds,
    };
  }

  // Fetch crop info for the single crop
  const cropIdStr = visibleRecords[0]!.cropId.toString();
  const cropDoc = await Crop.findById(cropIdStr).lean();
  const cropSummary = {
    id: cropDoc?._id.toString() ?? cropIdStr,
    slug: cropDoc?.slug ?? "unknown",
    nameEn: cropDoc?.nameEn ?? "Unknown",
    nameBn: cropDoc?.nameBn ?? "অজানা",
    unit: cropDoc?.unit ?? "kg",
  };
  const cropMinIncrementPerKg = cropDoc?.minIncrementPerKg ?? 100;

  // Build items for shared calculateCompareHighlights
  const compareItems: CompareListingItem[] = visibleRecords.map((r) => ({
    id: r._id.toString(),
    cropId: r.cropId.toString(),
    grade: r.aiAssessment.grade as CropGrade,
    quantityKg: r.quantityKg,
    floorPricePerKg: r.floorPricePerKg,
    currentBidPerKg: r.currentBidPerKg,
    bidCount: r.bidCount,
    status: r.status as ListingStatus,
    aiExpectedPricePerKg: r.aiPriceGuidance?.expectedPerKg,
    aiPriceGuidance: r.aiPriceGuidance ? { expectedPerKg: r.aiPriceGuidance.expectedPerKg } : null,
  }));

  const highlights = calculateCompareHighlights(compareItems);
  const now = getClock().now();

  const compareListingsResult: CompareListing[] = visibleRecords.map((r) => {
    const displayPricePerKg =
      r.bidCount > 0 && r.currentBidPerKg != null ? r.currentBidPerKg : r.floorPricePerKg;
    const totalDisplayCost = calculateSubtotal(displayPricePerKg, r.quantityKg);

    const timeLeftSeconds =
      r.status === ListingStatus.ACTIVE
        ? Math.max(0, Math.floor((new Date(r.endsAt).getTime() - now.getTime()) / 1000))
        : 0;

    const farmerRegion = r.location?.division ?? "Dhaka";
    const expectedPerKg = r.aiPriceGuidance?.expectedPerKg;
    const percentageVsAiExpected =
      expectedPerKg && expectedPerKg > 0
        ? Math.round((displayPricePerKg / expectedPerKg) * 100)
        : null;

    const aiRange = r.aiPriceGuidance
      ? {
          lowPerKg: r.aiPriceGuidance.lowPerKg,
          expectedPerKg: r.aiPriceGuidance.expectedPerKg,
          highPerKg: r.aiPriceGuidance.highPerKg,
        }
      : null;

    const itemHighlights = highlights.byListingId[r._id.toString()] ?? {
      isLowestPrice: false,
      isBestGrade: false,
      isLargestQuantity: false,
      isBestValue: false,
    };

    const buyerCard: BuyerListingCard = {
      id: r._id.toString(),
      cropId: r.cropId.toString(),
      crop: cropSummary,
      grade: r.aiAssessment.grade as CropGrade,
      quantityKg: r.quantityKg,
      floorPricePerKg: r.floorPricePerKg,
      currentBidPerKg: r.currentBidPerKg ?? null,
      displayPricePerKg,
      totalDisplayCost,
      minIncrementPerKg: cropMinIncrementPerKg,
      hasBids: r.bidCount > 0,
      bidCount: r.bidCount,
      startsAt: r.startsAt instanceof Date ? r.startsAt.toISOString() : new Date(r.startsAt).toISOString(),
      endsAt: r.endsAt instanceof Date ? r.endsAt.toISOString() : new Date(r.endsAt).toISOString(),
      status: r.status as ListingStatus,
      location: {
        division: r.location?.division ?? "Dhaka",
        district: r.location?.district ?? "Dhaka",
      },
      thumbnailUrl: r.images?.[0]?.url ?? null,
      images: r.images?.map((img: { url: string; width: number; height: number }) => ({
        url: img.url,
        width: img.width,
        height: img.height,
      })),
      ...(expectedPerKg !== undefined ? { aiExpectedPricePerKg: expectedPerKg } : {}),
    };

    return {
      ...buyerCard,
      cropNameEn: cropSummary.nameEn,
      cropNameBn: cropSummary.nameBn,
      displayTotalCost: totalDisplayCost,
      totalDisplayCost,
      timeLeftSeconds,
      farmerRegion,
      aiExpectedPricePerKg: expectedPerKg ?? null,
      aiRange,
      percentageVsAiExpected,
      highlights: itemHighlights,
      card: buyerCard,
    };
  });

  return {
    cropId: cropSummary.id,
    listings: compareListingsResult,
    highlights,
    missingIds,
  };
}

