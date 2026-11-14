import mongoose from "mongoose";
import {
  AUCTION_TIMING,
  type AnonymizedBidHistoryItem,
  type BidItem,
  BidStatus,
  DomainEventName,
  ListingStatus,
  type PublicUser,
  UserRole,
  getAntiSnipingExtensionDurationMs,
  getAntiSnipingTriggerWindowMs,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { getClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { Listing } from "../listings/listing.model.js";
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

  // Non-owners can only see bids for ACTIVE listings
  const isOwner = user && listing.farmerId.toString().toLowerCase() === user.id.toLowerCase();
  if (!isOwner && listing.status !== ListingStatus.ACTIVE) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
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
        ...(user ? { isMyBid, isMine: isMyBid } : {}),
      };
    })
    .reverse(); // Newest bids first
}
