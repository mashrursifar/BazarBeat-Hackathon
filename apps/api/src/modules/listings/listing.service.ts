import { Types } from "mongoose";
import {
  type CreateListingRequest,
  type FarmerListing,
  ListingStatus,
  type PublicUser,
  evaluateFloorPrice,
} from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { getClock } from "../../shared/clock.js";
import { logger } from "../../shared/logger.js";
import { Crop } from "../crops/crop.model.js";
import { AiAssessmentRecord } from "../ai/ai-assessment-record.model.js";
import { getPricePredictionProvider, hashAssessmentToken } from "../ai/ai.service.js";
import { releaseStock, reserveStockForListing } from "../inventory/inventory.service.js";
import { Listing, type ListingRecord } from "./listing.model.js";
import { assertValidListingTransition } from "./listing-state-machine.js";
import { mapListingToFarmerListing } from "./listing.mapper.js";

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
    Listing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(options.limit)
      .lean(),
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
): Promise<FarmerListing> {
  const id = ensureObjectId(listingId);
  const record = await Listing.findById(id).lean();

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  const isOwner = record.farmerId.toString() === user.id;

  // Non-owners (other farmers, buyers) can only see ACTIVE listings
  if (!isOwner && record.status !== ListingStatus.ACTIVE) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  return mapListingToFarmerListing(
    record as unknown as ListingRecord & { _id: { toString(): string }; createdAt: Date },
  );
}
