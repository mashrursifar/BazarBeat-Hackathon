import mongoose from "mongoose";
import { ObjectId } from "bson";
import {
  AUCTION_TIMING,
  type AnonymizedBidHistoryItem,
  type BidItem,
  BidStatus,
  type BuyerBidStatus,
  type CropGrade,
  DomainEventName,
  ListingStatus,
  type MyBidsQuery,
  type MyBidsResponse,
  type MyBidsRow,
  type PublicUser,
  UserRole,
  calculateSubtotal,
  calculateWinRate,
  getAntiSnipingExtensionDurationMs,
  getAntiSnipingTriggerWindowMs,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { Crop } from "../crops/crop.model.js";
import { Listing } from "../listings/listing.model.js";
import { Order } from "../orders/order.model.js";
import { Bid } from "./bid.model.js";
import { IdempotencyRecord } from "./idempotency-record.model.js";

function ensureObjectId(value: string): string {
  if (!/^[\da-f]{24}$/i.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid database ID format");
  }
  return value.toLowerCase();
}

function isTransactionUnsupported(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === 20 ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("Transaction numbers are only allowed"))
  );
}

/**
 * Computes the consistent chronological anonymized bidder label (e.g. "Buyer #1", "Buyer #2")
 * based on each buyer's first accepted bid on this listing.
 * AUCTION_RULES §10: Bidders appear as anonymized labels to protect privacy.
 */
export async function getBidderLabel(
  listingId: string,
  buyerId: string,
  session?: mongoose.ClientSession,
): Promise<string> {
  const query = Bid.find({ listingId: ensureObjectId(listingId) })
    .sort({ seq: 1 })
    .select("buyerId");
  if (session) {
    query.session(session);
  }
  const bids = await query.lean();
  const seenBuyerIds: string[] = [];
  for (const b of bids) {
    const idStr = b.buyerId.toString().toLowerCase();
    if (!seenBuyerIds.includes(idStr)) {
      seenBuyerIds.push(idStr);
    }
  }

  const targetIdStr = buyerId.toLowerCase();
  const existingIndex = seenBuyerIds.indexOf(targetIdStr);
  if (existingIndex !== -1) {
    return `Buyer #${existingIndex + 1}`;
  }
  return `Buyer #${seenBuyerIds.length + 1}`;
}

/**
 * Re-reads the listing state to determine the exact failure reason when the conditional
 * atomic update did not match.
 * AUCTION_RULES §4 & §5: Specific error reporting.
 */
async function reportMismatchReason(
  listingId: string,
  buyerId: string,
  amountPerKg: number,
  currentInstant: Date,
): Promise<never> {
  const listing = await Listing.findById(ensureObjectId(listingId));
  if (!listing) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  // 1. Actor is not the listing's farmer
  if (listing.farmerId.toString().toLowerCase() === buyerId.toLowerCase()) {
    throw new AppError(403, "OWN_LISTING", "Farmers cannot bid on their own listing");
  }

  // 2. Listing status is ACTIVE and server time < endsAt
  if (
    listing.status !== ListingStatus.ACTIVE ||
    listing.endsAt.getTime() <= currentInstant.getTime()
  ) {
    throw new AppError(400, "AUCTION_CLOSED", "Auction is closed");
  }

  // 3. The buyer is not already the current highest bidder (cannot outbid self)
  if (
    listing.currentBidderId &&
    listing.currentBidderId.toString().toLowerCase() === buyerId.toLowerCase()
  ) {
    throw new AppError(409, "CONFLICT", "You are already the highest bidder");
  }

  // 4. Amount meets floor / current bid + minIncrement
  if (listing.bidCount === 0) {
    if (amountPerKg < listing.floorPricePerKg) {
      throw new AppError(
        400,
        "BID_TOO_LOW",
        `Bid must be at least the floor price of ${listing.floorPricePerKg} poisha`,
        {
          minimumRequiredPerKg: listing.floorPricePerKg,
          currentBidPerKg: null,
          floorPricePerKg: listing.floorPricePerKg,
          minIncrementPerKg: listing.minIncrementPerKg,
        },
      );
    }
  } else {
    const minRequired = (listing.currentBidPerKg ?? 0) + listing.minIncrementPerKg;
    if (amountPerKg < minRequired) {
      throw new AppError(
        400,
        "BID_TOO_LOW",
        `Bid must be at least ${minRequired} poisha`,
        {
          minimumRequiredPerKg: minRequired,
          currentBidPerKg: listing.currentBidPerKg ?? null,
          floorPricePerKg: listing.floorPricePerKg,
          minIncrementPerKg: listing.minIncrementPerKg,
        },
      );
    }
  }

  // Fallback for race condition mismatch
  throw new AppError(409, "CONFLICT", "Bid was rejected due to a concurrent update");
}

export interface PlaceBidInput {
  amountPerKg: number;
  idempotencyKey?: string;
}

export interface PlaceBidExecutionResult {
  bid: BidItem;
  wasExtended: boolean;
  newEndsAt?: Date;
  newExtensionCount?: number;
  seq: number;
  isReplay?: boolean;
}

/**
 * Places a bid with a single conditional update on the listing and appends the Bid record.
 * Applies AUCTION_RULES §4, §5, §6.
 */
export async function placeBid(
  buyer: PublicUser,
  listingId: string,
  input: PlaceBidInput,
): Promise<PlaceBidExecutionResult> {
  // Pre-flight checks
  if (buyer.role !== UserRole.BUYER) {
    throw new AppError(403, "FORBIDDEN", "Only buyers can place bids");
  }

  if (!Number.isInteger(input.amountPerKg) || input.amountPerKg <= 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Bid amount must be a positive integer in poisha",
    );
  }

  const validListingId = ensureObjectId(listingId);
  const validBuyerId = ensureObjectId(buyer.id);

  // Idempotency check if key provided through IdempotencyRecord
  let idempotencyKey: string | undefined;
  if (input.idempotencyKey !== undefined) {
    idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Idempotency key cannot be empty");
    }
    if (idempotencyKey.length > 128) {
      throw new AppError(400, "VALIDATION_ERROR", "Idempotency key must be at most 128 characters");
    }

    const existingRecord = await IdempotencyRecord.findOne({
      key: idempotencyKey,
      userId: validBuyerId,
    }).lean();

    if (existingRecord) {
      if (existingRecord.listingId.toString().toLowerCase() !== validListingId) {
        throw new AppError(409, "CONFLICT", "Idempotency key already used for another listing");
      }
      return {
        bid: existingRecord.responseBody as BidItem,
        wasExtended: false,
        seq: (existingRecord.responseBody as BidItem).seq ?? 0,
        isReplay: true,
      };
    }

    const existingBid = await Bid.findOne({
      listingId: validListingId,
      buyerId: validBuyerId,
      idempotencyKey,
    }).lean();

    if (existingBid) {
      return {
        bid: {
          id: existingBid._id.toString(),
          listingId: existingBid.listingId.toString(),
          buyerId: existingBid.buyerId.toString(),
          amountPerKg: existingBid.amountPerKg,
          totalAmount: existingBid.totalAmount,
          seq: existingBid.seq,
          status: existingBid.status as BidStatus,
          placedAt: existingBid.placedAt.toISOString(),
        },
        wasExtended: false,
        seq: existingBid.seq,
        isReplay: true,
      };
    }
  }

  const clock = getClock();
  const currentInstant = clock.now();
  const nowMs = currentInstant.getTime();

  // Timing configuration (AUCTION_RULES §6)
  const triggerWindowMs = getAntiSnipingTriggerWindowMs(env.DEMO_MODE);
  const extensionDurationMs = getAntiSnipingExtensionDurationMs(env.DEMO_MODE);
  const maxExtensions = AUCTION_TIMING.ANTI_SNIPING_MAX_EXTENSIONS;
  const triggerThreshold = new Date(nowMs + triggerWindowMs);
  const extendedEndsAt = new Date(nowMs + extensionDurationMs);

  // Single conditional filter enforcing every AUCTION_RULES §4 condition atomically
  const filter = {
    _id: validListingId,
    farmerId: { $ne: validBuyerId },
    status: ListingStatus.ACTIVE,
    endsAt: { $gt: currentInstant },
    $or: [
      {
        bidCount: 0,
        floorPricePerKg: { $lte: input.amountPerKg },
      },
      {
        bidCount: { $gt: 0 },
        currentBidderId: { $ne: validBuyerId },
        $expr: {
          $lte: [
            { $add: ["$currentBidPerKg", "$minIncrementPerKg"] },
            input.amountPerKg,
          ],
        },
      },
    ],
  };

  // Pipeline update: increments bidCount, sets currentBid and currentBidder,
  // and applies anti-sniping extension in the EXACT SAME single atomic operation (AUCTION_RULES §5 & §6)
  const pipeline = [
    {
      $set: {
        currentBidPerKg: input.amountPerKg,
        currentBidderId: { $toObjectId: validBuyerId },
        bidCount: { $add: ["$bidCount", 1] },
        endsAt: {
          $cond: {
            if: {
              $and: [
                { $lt: ["$extensionCount", maxExtensions] },
                { $lt: ["$endsAt", triggerThreshold] },
              ],
            },
            then: extendedEndsAt,
            else: "$endsAt",
          },
        },
        extensionCount: {
          $cond: {
            if: {
              $and: [
                { $lt: ["$extensionCount", maxExtensions] },
                { $lt: ["$endsAt", triggerThreshold] },
              ],
            },
            then: { $add: ["$extensionCount", 1] },
            else: "$extensionCount",
          },
        },
      },
    },
  ];

  let executionResult: PlaceBidExecutionResult | undefined;
  let transactionSucceeded = false;

  // Step 1: Attempt Mongo transaction (Task 2.4 / D-29 decision)
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const previousListing = await Listing.findOneAndUpdate(filter, pipeline, {
        session,
        returnDocument: "before",
      });

      if (!previousListing) {
        await reportMismatchReason(
          validListingId,
          buyer.id,
          input.amountPerKg,
          currentInstant,
        );
        throw new AppError(500, "INTERNAL", "Unreachable");
      }

      const seq = previousListing.bidCount + 1;
      const totalAmount = Math.round(input.amountPerKg * previousListing.quantityKg);
      const wasExtended =
        previousListing.extensionCount < maxExtensions &&
        previousListing.endsAt.getTime() < triggerThreshold.getTime();
      const newEndsAt = wasExtended ? extendedEndsAt : previousListing.endsAt;
      const newExtensionCount = wasExtended
        ? previousListing.extensionCount + 1
        : previousListing.extensionCount;

      const createdBids = await Bid.create(
        [
          {
            listingId: validListingId,
            buyerId: validBuyerId,
            amountPerKg: input.amountPerKg,
            totalAmount,
            seq,
            status: BidStatus.ACCEPTED,
            placedAt: currentInstant,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        ],
        { session },
      );

      const createdBid = createdBids[0];
      if (!createdBid) {
        throw new AppError(500, "INTERNAL", "Failed to create bid in transaction");
      }

      executionResult = {
        bid: {
          id: createdBid._id.toString(),
          listingId: validListingId,
          buyerId: buyer.id,
          amountPerKg: createdBid.amountPerKg,
          totalAmount: createdBid.totalAmount,
          seq: createdBid.seq,
          status: createdBid.status as BidStatus,
          placedAt: createdBid.placedAt.toISOString(),
        },
        wasExtended,
        newEndsAt,
        newExtensionCount,
        seq,
      };

      if (idempotencyKey) {
        await IdempotencyRecord.create(
          [
            {
              key: idempotencyKey,
              userId: validBuyerId,
              listingId: validListingId,
              bidId: createdBid._id,
              responseBody: executionResult.bid,
              expiresAt: new Date(nowMs + 24 * 60 * 60 * 1000),
            },
          ],
          { session },
        );
      }
    });
    transactionSucceeded = true;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (!isTransactionUnsupported(error)) {
      throw error;
    }
    logger.info(
      { listingId },
      "Mongo transactions unavailable; executing atomic update with documented compensation fallback",
    );
  } finally {
    await session.endSession();
  }

  // Step 2: Standalone Mongo fallback with documented compensation
  if (!transactionSucceeded) {
    const previousListing = await Listing.findOneAndUpdate(filter, pipeline, {
      returnDocument: "before",
    });

    if (!previousListing) {
      await reportMismatchReason(
        validListingId,
        buyer.id,
        input.amountPerKg,
        currentInstant,
      );
      throw new AppError(500, "INTERNAL", "Unreachable");
    }

    const seq = previousListing.bidCount + 1;
    const totalAmount = Math.round(input.amountPerKg * previousListing.quantityKg);
    const wasExtended =
      previousListing.extensionCount < maxExtensions &&
      previousListing.endsAt.getTime() < triggerThreshold.getTime();
    const newEndsAt = wasExtended ? extendedEndsAt : previousListing.endsAt;
    const newExtensionCount = wasExtended
      ? previousListing.extensionCount + 1
      : previousListing.extensionCount;

    let createdBid: InstanceType<typeof Bid>;
    try {
      const createdBids = await Bid.create([
        {
          listingId: validListingId,
          buyerId: validBuyerId,
          amountPerKg: input.amountPerKg,
          totalAmount,
          seq,
          status: BidStatus.ACCEPTED,
          placedAt: currentInstant,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      ]);
      const firstCreated = createdBids[0];
      if (!firstCreated) {
        throw new AppError(500, "INTERNAL", "Failed to create fallback bid");
      }
      createdBid = firstCreated;
    } catch (bidCreateError) {
      logger.error(
        {
          err: bidCreateError,
          listingId: validListingId,
          buyerId: buyer.id,
          seq,
        },
        "CRITICAL: Failed to append Bid document after listing update; executing compensating listing rollback",
      );

      try {
        const rollbackUpdate: Record<string, unknown> = {
          $set: {
            bidCount: previousListing.bidCount,
            endsAt: previousListing.endsAt,
            extensionCount: previousListing.extensionCount,
          },
        };
        if (previousListing.bidCount === 0) {
          rollbackUpdate.$unset = {
            currentBidPerKg: 1,
            currentBidderId: 1,
          };
        } else {
          (rollbackUpdate.$set as Record<string, unknown>).currentBidPerKg =
            previousListing.currentBidPerKg;
          (rollbackUpdate.$set as Record<string, unknown>).currentBidderId =
            previousListing.currentBidderId;
        }

        await Listing.updateOne({ _id: validListingId, bidCount: seq }, rollbackUpdate);
      } catch (compensationError) {
        logger.error(
          { err: compensationError, listingId: validListingId },
          "CRITICAL: Compensating listing rollback failed",
        );
      }
      throw bidCreateError;
    }

    executionResult = {
      bid: {
        id: createdBid._id.toString(),
        listingId: validListingId,
        buyerId: buyer.id,
        amountPerKg: createdBid.amountPerKg,
        totalAmount: createdBid.totalAmount,
        seq: createdBid.seq,
        status: createdBid.status as BidStatus,
        placedAt: createdBid.placedAt.toISOString(),
      },
      wasExtended,
      newEndsAt,
      newExtensionCount,
      seq,
    };

    if (idempotencyKey) {
      try {
        await IdempotencyRecord.create([
          {
            key: idempotencyKey,
            userId: validBuyerId,
            listingId: validListingId,
            bidId: createdBid._id,
            responseBody: executionResult.bid,
            expiresAt: new Date(nowMs + 24 * 60 * 60 * 1000),
          },
        ]);
      } catch (idempotencyErr: unknown) {
        logger.warn(
          { err: idempotencyErr, key: idempotencyKey },
          "IdempotencyRecord duplicate or creation issue in fallback mode",
        );
      }
    }
  }

  if (!executionResult) {
    throw new AppError(500, "INTERNAL", "Bid placement failed unexpectedly");
  }

  if (executionResult.isReplay) {
    return executionResult;
  }

  // Compute anonymized bidder label and publish domain events
  const bidderLabel = await getBidderLabel(validListingId, validBuyerId);
  const emitter = getDomainEventEmitter();

  emitter.emit(DomainEventName.BID_PLACED, {
    listingId: validListingId,
    bidId: executionResult.bid.id,
    buyerId: buyer.id,
    bidderLabel,
    amountPerKg: executionResult.bid.amountPerKg,
    totalAmount: executionResult.bid.totalAmount,
    bidCount: executionResult.seq,
    currentBidPerKg: executionResult.bid.amountPerKg,
    placedAt: executionResult.bid.placedAt,
  });

  if (executionResult.wasExtended && executionResult.newEndsAt && executionResult.newExtensionCount) {
    emitter.emit(DomainEventName.AUCTION_EXTENDED, {
      listingId: validListingId,
      endsAt: executionResult.newEndsAt.toISOString(),
      extensionCount: executionResult.newExtensionCount,
      extendedAt: currentInstant.toISOString(),
    });
  }

  return executionResult;
}

/**
 * Retrieves the anonymized bid history for a listing.
 * AUCTION_RULES §10: Bidders are masked as "Buyer #1", "Buyer #2", etc.
 */
export async function getListingBids(
  listingId: string,
  user?: PublicUser,
): Promise<AnonymizedBidHistoryItem[]> {
  const validListingId = ensureObjectId(listingId);
  const listing = await Listing.findById(validListingId).lean();
  if (!listing) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  // Non-owners: owner farmers see any status; buyers see ACTIVE or any listing they have bid on
  const isOwner =
    user &&
    user.role === UserRole.FARMER &&
    listing.farmerId.toString().toLowerCase() === user.id.toLowerCase();

  if (!isOwner) {
    if (listing.status === ListingStatus.DRAFT) {
      throw new AppError(404, "NOT_FOUND", "Listing not found");
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      const hasBuyerBid =
        user && user.role === UserRole.BUYER
          ? await Bid.exists({ listingId: validListingId, buyerId: ensureObjectId(user.id) })
          : false;

      if (!hasBuyerBid) {
        throw new AppError(404, "NOT_FOUND", "Listing not found");
      }
    }
  }

  const allBids = await Bid.find({ listingId: validListingId }).sort({ seq: 1 }).lean();

  const seenBuyerIds: string[] = [];
  const buyerLabelMap = new Map<string, string>();
  for (const b of allBids) {
    const idStr = b.buyerId.toString().toLowerCase();
    if (!buyerLabelMap.has(idStr)) {
      seenBuyerIds.push(idStr);
      buyerLabelMap.set(idStr, `Buyer #${seenBuyerIds.length}`);
    }
  }

  return allBids
    .map((bid) => {
      const buyerIdStr = bid.buyerId.toString().toLowerCase();
      const isMyBid =
        user && user.role === UserRole.BUYER
          ? buyerIdStr === user.id.toLowerCase()
          : false;
      return {
        id: bid._id.toString(),
        listingId: validListingId,
        amountPerKg: bid.amountPerKg,
        totalAmount: bid.totalAmount,
        bidderLabel: buyerLabelMap.get(buyerIdStr) ?? "Buyer #?",
        placedAt: bid.placedAt.toISOString(),
        isMine: isMyBid,
        isMyBid,
      };
    })
    .reverse(); // Newest bids first
}

/**
 * Retrieves the authenticated buyer's bids grouped by listing (Task 5.5).
 * One row per listing the buyer bid on:
 * - Listing summary (crop, grade, quantity, thumbnails, listingStatus)
 * - Buyer's highest bid on that listing (amountPerKg, totalAmount, bidId, placedAt)
 * - Current price (currentBidPerKg, currentTotalAmount, bidCount)
 * - Derived status (WINNING or OUTBID while active; WON or LOST after closing)
 * - Gap to current price when outbid (in poisha per kg)
 * - End time (endsAt)
 * - Order ID when won
 * - Newest activity first (sorted by the buyer's latest bid placedAt on that listing)
 * - Filterable by group (active | won | lost) with pagination (page, limit, total, totalPages)
 */
export interface BuyerBidsGroupedResult {
  activeRows: MyBidsRow[];
  wonRows: MyBidsRow[];
  lostRows: MyBidsRow[];
  allRows: MyBidsRow[];
  activeCount: number;
  winningCount: number;
  outbidCount: number;
  wonCount: number;
  lostCount: number;
  totalCompletedCount: number;
  winRate: number;
}

/**
 * Shared My Bids grouping implementation.
 * Groups all bids placed by a buyer by listing to produce exactly one row per listing,
 * deriving the canonical status (WINNING, OUTBID, WON, LOST), latest activity, and win rate.
 * Used by both `getMyBids` and `BuyerDashboardService`.
 */
export async function getBuyerBidsGrouped(
  buyerId: string | ObjectId,
): Promise<BuyerBidsGroupedResult> {
  const validBuyerId =
    typeof buyerId === "string" ? ensureObjectId(buyerId) : buyerId.toString().toLowerCase();
  const buyerObjectId = new ObjectId(validBuyerId);

  // 1. Fetch all bids placed by this buyer, sorted newest first
  const buyerBids = await Bid.find({ buyerId: buyerObjectId })
    .sort({ placedAt: -1, _id: -1 })
    .lean();

  if (buyerBids.length === 0) {
    return {
      activeRows: [],
      wonRows: [],
      lostRows: [],
      allRows: [],
      activeCount: 0,
      winningCount: 0,
      outbidCount: 0,
      wonCount: 0,
      lostCount: 0,
      totalCompletedCount: 0,
      winRate: 0,
    };
  }

  // 2. Group bids by listingId to produce exactly one row per listing
  interface ListingGroup {
    listingIdStr: string;
    highestBid: (typeof buyerBids)[0];
    latestActivityAt: Date;
  }

  const groupMap = new Map<string, ListingGroup>();

  for (const bid of buyerBids) {
    const lid = bid.listingId.toString().toLowerCase();
    const existing = groupMap.get(lid);

    if (!existing) {
      groupMap.set(lid, {
        listingIdStr: lid,
        highestBid: bid,
        latestActivityAt: bid.placedAt,
      });
    } else {
      if (bid.placedAt > existing.latestActivityAt) {
        existing.latestActivityAt = bid.placedAt;
      }
      if (bid.amountPerKg > existing.highestBid.amountPerKg) {
        existing.highestBid = bid;
      }
    }
  }

  // 3. Fetch listings, crops, and orders in bulk
  const listingObjectIds = Array.from(groupMap.keys()).map((id) => new ObjectId(id));
  const listings = await Listing.find({ _id: { $in: listingObjectIds } }).lean();
  const listingsMap = new Map(listings.map((l) => [l._id.toString().toLowerCase(), l]));

  const cropObjectIds = Array.from(
    new Set(listings.map((l) => l.cropId.toString().toLowerCase())),
  ).map((id) => new ObjectId(id));
  const crops = await Crop.find({ _id: { $in: cropObjectIds } }).lean();
  const cropsMap = new Map(crops.map((c) => [c._id.toString().toLowerCase(), c]));

  const orders = await Order.find({
    listingId: { $in: listingObjectIds },
    buyerId: buyerObjectId,
  }).lean();
  const ordersMap = new Map(orders.map((o) => [o.listingId.toString().toLowerCase(), o]));

  // 4. Construct MyBidsRow for each listing
  const rowsWithActivity: Array<{ row: MyBidsRow; latestActivityAt: Date }> = [];

  for (const group of groupMap.values()) {
    const listing = listingsMap.get(group.listingIdStr);
    if (!listing) continue; // In case listing was removed or not accessible

    const crop = cropsMap.get(listing.cropId.toString().toLowerCase());
    const order = ordersMap.get(group.listingIdStr);
    const highestBid = group.highestBid;

    // Derived status
    let derivedStatus: BuyerBidStatus;
    if (listing.status === ListingStatus.ACTIVE) {
      const isCurrentHighest =
        listing.currentBidderId !== undefined &&
        listing.currentBidderId !== null &&
        listing.currentBidderId.toString().toLowerCase() === validBuyerId;
      derivedStatus = isCurrentHighest ? "WINNING" : "OUTBID";
    } else if (listing.status === ListingStatus.SOLD) {
      const isWinner =
        order !== undefined ||
        highestBid.status === BidStatus.WON ||
        (listing.winningBidId !== undefined &&
          listing.winningBidId !== null &&
          listing.winningBidId.toString().toLowerCase() ===
            highestBid._id.toString().toLowerCase()) ||
        (listing.currentBidderId !== undefined &&
          listing.currentBidderId !== null &&
          listing.currentBidderId.toString().toLowerCase() === validBuyerId);
      derivedStatus = isWinner ? "WON" : "LOST";
    } else {
      // EXPIRED_UNSOLD, CANCELLED, etc.
      derivedStatus = "LOST";
    }

    const currentBidPerKg = listing.currentBidPerKg ?? listing.floorPricePerKg;
    const currentTotalAmount = calculateSubtotal(currentBidPerKg, listing.quantityKg);

    let gapToCurrentPerKg: number | null = null;
    let gap: number | null = null;
    if (derivedStatus === "OUTBID") {
      const diff = Math.max(0, currentBidPerKg - highestBid.amountPerKg);
      gapToCurrentPerKg = diff;
      gap = diff;
    }

    const orderId = derivedStatus === "WON" && order ? order._id.toString() : null;

    const row: MyBidsRow = {
      bidId: highestBid._id.toString(),
      listingId: listing._id.toString(),
      cropId: listing.cropId.toString(),
      cropNameEn: crop?.nameEn ?? "Produce",
      cropNameBn: crop?.nameBn ?? "শস্য",
      grade: listing.aiAssessment.grade as CropGrade,
      quantityKg: listing.quantityKg,
      myBidPerKg: highestBid.amountPerKg,
      myTotalAmount: highestBid.totalAmount,
      currentBidPerKg,
      currentTotalAmount,
      bidCount: listing.bidCount,
      status: derivedStatus,
      listingStatus: listing.status as ListingStatus,
      endsAt: listing.endsAt.toISOString(),
      placedAt: highestBid.placedAt.toISOString(),
      thumbnailUrl: listing.images?.[0]?.url ?? null,
      gapToCurrentPerKg,
      gap,
      orderId,
    };

    rowsWithActivity.push({
      row,
      latestActivityAt: group.latestActivityAt,
    });
  }

  // 5. Newest activity first
  rowsWithActivity.sort((a, b) => {
    const diff = b.latestActivityAt.getTime() - a.latestActivityAt.getTime();
    if (diff !== 0) return diff;
    return b.row.listingId.localeCompare(a.row.listingId);
  });

  const allRows = rowsWithActivity.map((item) => item.row);

  function getRowGroup(status: BuyerBidStatus): "active" | "won" | "lost" {
    if (status === "WINNING" || status === "OUTBID") return "active";
    if (status === "WON") return "won";
    return "lost";
  }

  const activeRows = allRows.filter((r) => getRowGroup(r.status) === "active");
  const wonRows = allRows.filter((r) => getRowGroup(r.status) === "won");
  const lostRows = allRows.filter((r) => getRowGroup(r.status) === "lost");

  const activeCount = activeRows.length;
  const winningCount = activeRows.filter((r) => r.status === "WINNING").length;
  const outbidCount = activeRows.filter((r) => r.status === "OUTBID").length;
  const wonCount = wonRows.length;
  const lostCount = lostRows.length;
  const totalCompletedCount = wonCount + lostCount;
  const winRate = calculateWinRate(wonCount, totalCompletedCount);

  return {
    activeRows,
    wonRows,
    lostRows,
    allRows,
    activeCount,
    winningCount,
    outbidCount,
    wonCount,
    lostCount,
    totalCompletedCount,
    winRate,
  };
}

export async function getMyBids(
  buyer: PublicUser,
  query: MyBidsQuery,
): Promise<MyBidsResponse> {
  const clock = getClock();
  const grouped = await getBuyerBidsGrouped(buyer.id);

  if (grouped.allRows.length === 0) {
    if (query.group !== undefined) {
      return {
        data: [],
        meta: {
          serverTime: clock.iso(),
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
          group: query.group,
        },
      };
    }
    return {
      data: {
        active: [],
        won: [],
        lost: [],
      },
      meta: {
        serverTime: clock.iso(),
        total: 0,
      },
    };
  }

  // Handle query with or without group filter
  if (query.group !== undefined) {
    const targetGroup = query.group;
    const filteredRows =
      targetGroup === "active"
        ? grouped.activeRows
        : targetGroup === "won"
          ? grouped.wonRows
          : grouped.lostRows;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = filteredRows.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = filteredRows.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      meta: {
        serverTime: clock.iso(),
        page,
        limit,
        total,
        totalPages,
        group: targetGroup,
      },
    };
  }

  return {
    data: {
      active: grouped.activeRows,
      won: grouped.wonRows,
      lost: grouped.lostRows,
    },
    meta: {
      serverTime: clock.iso(),
      total: grouped.allRows.length,
    },
  };
}
