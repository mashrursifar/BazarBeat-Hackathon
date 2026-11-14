import { ObjectId } from "bson";
import mongoose from "mongoose";
import {
  AuctionCloseTrigger,
  BidStatus,
  DomainEventName,
  ListingStatus,
  type MinimalOrder,
  calculateFeeAndNet,
  calculateSubtotal,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { type Clock, getClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { Bid, type BidRecord } from "../bids/bid.model.js";
import { markStockSold, releaseStock } from "../inventory/inventory.service.js";
import { assertValidListingTransition } from "../listings/listing-state-machine.js";
import { Listing, type ListingRecord } from "../listings/listing.model.js";
import { recordPlatformSalePrice } from "../market-prices/market-price.service.js";
import { mapOrderToMinimalOrder } from "../orders/order.mapper.js";
import { Order, type OrderRecord } from "../orders/order.model.js";

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

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export type CrashInjectionPoint =
  | "after_listing_update"
  | "after_bids_marked"
  | "after_order_created"
  | "after_stock_moved"
  | "after_market_price";

export interface CloseAuctionOptions {
  trigger: AuctionCloseTrigger;
  farmerId?: string; // Required when trigger === AuctionCloseTrigger.FARMER_ACCEPT
  clock?: Clock;
  platformFeeBps?: number;
  /** Test-only: inject simulated crash after a specific step to verify recovery */
  _testCrashAfterStep?: CrashInjectionPoint;
}

export interface CloseAuctionResult {
  listingId: string;
  status: typeof ListingStatus.SOLD | typeof ListingStatus.EXPIRED_UNSOLD;
  closedAt: string;
  winningBidId?: string;
  winningBidderId?: string;
  winningAmountPerKg?: number;
  totalAmount?: number;
  order?: MinimalOrder;
  isIdempotentReplay: boolean;
}

type RawListingDoc = ListingRecord & { _id: { toString(): string } };
type RawBidDoc = BidRecord & { _id: { toString(): string } };
type RawOrderDoc = OrderRecord & { _id: { toString(): string }; createdAt: Date };

/**
 * Idempotent auction closing service.
 * AUCTION_RULES §8, §11, DATA_MODEL (Order, MarketPrice), DESIGN_PATTERNS (#3, #4, #6).
 *
 * Supports three triggers:
 * 1. TIMER_EXPIRED: Auction countdown elapsed (endsAt <= now)
 * 2. FARMER_ACCEPT: Farmer accepts current bid early (requires farmer ownership, bids >= floor)
 * 3. SCHEDULER: Periodic background job checking expired listings
 *
 * Execution flow:
 * 1. Atomically transitions listing ACTIVE -> SOLD or EXPIRED_UNSOLD
 * 2. If SOLD: marks winning bid WON, other bids LOST; creates unique Order; moves stock to sold (SELL);
 *    records PLATFORM MarketPrice row; emits auction.closed and order.created.
 * 3. If EXPIRED_UNSOLD: releases stock back to available (RELEASE); emits auction.closed.
 * 4. Atomic transaction used when supported; ordered crash-recoverable steps with compensation used when standalone.
 */
export async function closeAuction(
  listingId: string,
  options: CloseAuctionOptions,
): Promise<CloseAuctionResult> {
  const validListingId = ensureObjectId(listingId);
  const clock = options.clock ?? getClock();
  const now = clock.now();
  const feeBps = options.platformFeeBps ?? env.PLATFORM_FEE_BPS;

  // 1. Fetch listing and check pre-conditions
  const listing = (await Listing.findById(validListingId)) as unknown as RawListingDoc | null;
  if (!listing) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  // Idempotency check: If already closed, reconcile missing steps and return safely
  if (
    listing.status === ListingStatus.SOLD ||
    listing.status === ListingStatus.EXPIRED_UNSOLD
  ) {
    return handleAlreadyClosedListing(listing, feeBps);
  }

  if (listing.status !== ListingStatus.ACTIVE) {
    throw new AppError(
      400,
      "INVALID_TRANSITION",
      `Cannot close listing in '${listing.status}' status`,
    );
  }

  // Trigger-specific validation
  if (options.trigger === AuctionCloseTrigger.FARMER_ACCEPT) {
    if (!options.farmerId) {
      throw new AppError(403, "FORBIDDEN", "Farmer ID required to accept bids early");
    }
    if (listing.farmerId.toString().toLowerCase() !== options.farmerId.toLowerCase()) {
      throw new AppError(403, "FORBIDDEN", "Only the listing owner can accept bids early");
    }
    if (listing.bidCount === 0 || !listing.currentBidPerKg) {
      throw new AppError(400, "NO_BIDS", "Cannot accept early when there are no bids");
    }
    if (listing.currentBidPerKg < listing.floorPricePerKg) {
      throw new AppError(400, "BELOW_FLOOR", "Current bid is below floor price");
    }
  } else {
    // TIMER_EXPIRED or SCHEDULER: must have reached endsAt
    if (listing.endsAt.getTime() > now.getTime()) {
      throw new AppError(400, "AUCTION_NOT_EXPIRED", "Auction has not reached its end time yet");
    }
  }

  const isSold = listing.bidCount > 0 && listing.currentBidPerKg !== undefined;
  const targetStatus = isSold ? ListingStatus.SOLD : ListingStatus.EXPIRED_UNSOLD;
  const action = options.trigger === AuctionCloseTrigger.FARMER_ACCEPT
    ? "accept_current_bid"
    : isSold
      ? "close_sold"
      : "close_unsold";

  assertValidListingTransition(listing.status, targetStatus, action);

  let winningBid: RawBidDoc | null = null;
  if (isSold) {
    winningBid = (await Bid.findOne({ listingId: validListingId })
      .sort({ amountPerKg: -1, seq: -1 })
      .lean()) as unknown as RawBidDoc | null;

    if (!winningBid) {
      throw new AppError(500, "INTERNAL", "Winning bid record missing despite positive bid count");
    }
  }

  // Attempt transactional execution (Mongo replica set)
  const session = await mongoose.startSession();
  let transactionSucceeded = false;
  let result: CloseAuctionResult | undefined;

  try {
    await session.withTransaction(async () => {
      // Step 1: Transition listing
      const updatedListing = (await Listing.findOneAndUpdate(
        { _id: validListingId, status: ListingStatus.ACTIVE },
        {
          $set: {
            status: targetStatus,
            closedAt: now,
            ...(isSold && winningBid ? { winningBidId: winningBid._id } : {}),
          },
        },
        { session, new: true },
      )) as unknown as RawListingDoc | null;

      if (!updatedListing) {
        // Concurrently closed
        const current = (await Listing.findById(validListingId).session(session)) as unknown as RawListingDoc | null;
        if (!current) throw new AppError(404, "NOT_FOUND", "Listing not found");
        return;
      }

      if (options._testCrashAfterStep === "after_listing_update") {
        throw new Error("Simulated crash: after_listing_update");
      }

      let createdOrder: RawOrderDoc | undefined;

      if (isSold && winningBid) {
        // Step 2: Mark bids
        await Bid.updateOne(
          { _id: winningBid._id },
          { $set: { status: BidStatus.WON } },
          { session },
        );
        await Bid.updateMany(
          { listingId: validListingId, _id: { $ne: winningBid._id } },
          { $set: { status: BidStatus.LOST } },
          { session },
        );

        if (options._testCrashAfterStep === "after_bids_marked") {
          throw new Error("Simulated crash: after_bids_marked");
        }

        // Step 3: Create Order
        const pricePerKg = winningBid.amountPerKg;
        const subtotal = calculateSubtotal(pricePerKg, listing.quantityKg);
        const { platformFee, farmerNet } = calculateFeeAndNet(subtotal, feeBps);

        const orders = (await Order.create(
          [
            {
              _id: new ObjectId(validListingId),
              listingId: validListingId,
              farmerId: listing.farmerId,
              buyerId: winningBid.buyerId,
              cropId: listing.cropId,
              quantityKg: listing.quantityKg,
              grade: listing.aiAssessment.grade,
              pricePerKg,
              subtotal,
              platformFee,
              farmerNet,
              status: "PENDING",
              payment: { status: "UNPAID" },
            },
          ],
          { session },
        )) as unknown as RawOrderDoc[];

        const firstOrder = orders[0];
        if (!firstOrder) {
          throw new AppError(500, "INTERNAL", "Failed to create order document");
        }
        createdOrder = firstOrder;

        if (options._testCrashAfterStep === "after_order_created") {
          throw new Error("Simulated crash: after_order_created");
        }

        // Step 4: Move stock from listed to sold (SELL)
        await markStockSold({
          farmerId: listing.farmerId.toString(),
          cropId: listing.cropId.toString(),
          quantityKg: listing.quantityKg,
          listingId: validListingId,
          orderId: createdOrder._id.toString(),
          operationId: `close-sell-${validListingId}`,
          note: `Sold on auction ${validListingId}`,
          session,
        });

        if (options._testCrashAfterStep === "after_stock_moved") {
          throw new Error("Simulated crash: after_stock_moved");
        }

        // Step 5: Add PLATFORM MarketPrice row
        await recordPlatformSalePrice(
          listing.cropId.toString(),
          listing.location.division,
          pricePerKg,
          now,
          session,
        );

        if (options._testCrashAfterStep === "after_market_price") {
          throw new Error("Simulated crash: after_market_price");
        }
      } else {
        // EXPIRED_UNSOLD: Release stock from listed back to available
        await releaseStock({
          farmerId: listing.farmerId.toString(),
          cropId: listing.cropId.toString(),
          quantityKg: listing.quantityKg,
          listingId: validListingId,
          operationId: `close-release-${validListingId}`,
          note: `Released from expired unsold auction ${validListingId}`,
          session,
        });

        if (options._testCrashAfterStep === "after_stock_moved") {
          throw new Error("Simulated crash: after_stock_moved");
        }
      }

      result = {
        listingId: validListingId,
        status: targetStatus,
        closedAt: now.toISOString(),
        ...(winningBid
          ? {
              winningBidId: winningBid._id.toString(),
              winningBidderId: winningBid.buyerId.toString(),
              winningAmountPerKg: winningBid.amountPerKg,
              totalAmount: winningBid.totalAmount,
            }
          : {}),
        ...(createdOrder ? { order: mapOrderToMinimalOrder(createdOrder) } : {}),
        isIdempotentReplay: false,
      };
    });

    transactionSucceeded = true;
  } catch (error: unknown) {
    if (options._testCrashAfterStep) {
      throw error;
    }
    if (error instanceof AppError) {
      throw error;
    }
    if (!isTransactionUnsupported(error)) {
      throw error;
    }
    logger.info(
      { listingId: validListingId },
      "Mongo transactions unavailable; executing ordered crash-recoverable closing steps",
    );
  } finally {
    await session.endSession();
  }

  // If transaction succeeded and result is ready, emit events and return
  if (transactionSucceeded && result) {
    emitClosingEvents(result);
    return result;
  }

  // Standalone Mongo Execution with Ordered Crash-Recoverable Steps (D-42)
  return executeStandaloneClosing(
    listing,
    targetStatus,
    winningBid,
    now,
    feeBps,
    options,
  );
}

/**
 * Standalone closing execution providing ordered idempotence and crash recovery.
 * Logged as Decision D-42 (Task 4.4 / prompt D-20).
 */
async function executeStandaloneClosing(
  listing: RawListingDoc,
  targetStatus: typeof ListingStatus.SOLD | typeof ListingStatus.EXPIRED_UNSOLD,
  winningBid: RawBidDoc | null,
  now: Date,
  feeBps: number,
  options: CloseAuctionOptions,
): Promise<CloseAuctionResult> {
  const validListingId = listing._id.toString();
  const isSold = targetStatus === ListingStatus.SOLD;

  // Step 1: Conditionally transition listing
  const updatedListing = (await Listing.findOneAndUpdate(
    { _id: validListingId, status: ListingStatus.ACTIVE },
    {
      $set: {
        status: targetStatus,
        closedAt: now,
        ...(isSold && winningBid ? { winningBidId: winningBid._id } : {}),
      },
    },
    { new: true },
  )) as unknown as RawListingDoc | null;

  if (!updatedListing) {
    // If conditional update didn't match, verify if listing is already closed
    const current = (await Listing.findById(validListingId)) as unknown as RawListingDoc | null;
    if (!current) throw new AppError(404, "NOT_FOUND", "Listing not found");
    if (current.status !== targetStatus) {
      throw new AppError(
        409,
        "CONFLICT",
        `Listing status changed concurrently to '${current.status}'`,
      );
    }
  }

  if (options._testCrashAfterStep === "after_listing_update") {
    throw new Error("Simulated crash: after_listing_update");
  }

  let finalOrder: RawOrderDoc | null = null;

  if (isSold && winningBid) {
    // Step 2: Mark bids WON / LOST
    await Bid.updateOne(
      { _id: winningBid._id },
      { $set: { status: BidStatus.WON } },
    );
    await Bid.updateMany(
      { listingId: validListingId, _id: { $ne: winningBid._id } },
      { $set: { status: BidStatus.LOST } },
    );

    if (options._testCrashAfterStep === "after_bids_marked") {
      throw new Error("Simulated crash: after_bids_marked");
    }

    // Step 3: Create Order (unique per listingId)
    const pricePerKg = winningBid.amountPerKg;
    const subtotal = calculateSubtotal(pricePerKg, listing.quantityKg);
    const { platformFee, farmerNet } = calculateFeeAndNet(subtotal, feeBps);

    let existingOrder = (await Order.findOne({ listingId: validListingId })) as unknown as RawOrderDoc | null;
    if (!existingOrder) {
      try {
        const createdOrders = (await Order.create([
          {
            _id: new ObjectId(validListingId),
            listingId: validListingId,
            farmerId: listing.farmerId,
            buyerId: winningBid.buyerId,
            cropId: listing.cropId,
            quantityKg: listing.quantityKg,
            grade: listing.aiAssessment.grade,
            pricePerKg,
            subtotal,
            platformFee,
            farmerNet,
            status: "PENDING",
            payment: { status: "UNPAID" },
          },
        ])) as unknown as RawOrderDoc[];
        existingOrder = createdOrders[0] ?? null;
      } catch (orderCreateErr: unknown) {
        if (!isDuplicateKey(orderCreateErr)) throw orderCreateErr;
        existingOrder = (await Order.findOne({ listingId: validListingId })) as unknown as RawOrderDoc | null;
      }
    }

    if (!existingOrder) {
      throw new AppError(500, "INTERNAL", "Failed to retrieve or create order");
    }
    finalOrder = existingOrder;

    if (options._testCrashAfterStep === "after_order_created") {
      throw new Error("Simulated crash: after_order_created");
    }

    // Step 4: Move stock from listed to sold (SELL)
    await markStockSold({
      farmerId: listing.farmerId.toString(),
      cropId: listing.cropId.toString(),
      quantityKg: listing.quantityKg,
      listingId: validListingId,
      orderId: finalOrder._id.toString(),
      operationId: `close-sell-${validListingId}`,
      note: `Sold on auction ${validListingId}`,
    });

    if (options._testCrashAfterStep === "after_stock_moved") {
      throw new Error("Simulated crash: after_stock_moved");
    }

    // Step 5: Add PLATFORM MarketPrice row
    await recordPlatformSalePrice(
      listing.cropId.toString(),
      listing.location.division,
      pricePerKg,
      now,
    );

    if (options._testCrashAfterStep === "after_market_price") {
      throw new Error("Simulated crash: after_market_price");
    }
  } else {
    // EXPIRED_UNSOLD: Release stock from listed to available
    await releaseStock({
      farmerId: listing.farmerId.toString(),
      cropId: listing.cropId.toString(),
      quantityKg: listing.quantityKg,
      listingId: validListingId,
      operationId: `close-release-${validListingId}`,
      note: `Released from expired unsold auction ${validListingId}`,
    });

    if (options._testCrashAfterStep === "after_stock_moved") {
      throw new Error("Simulated crash: after_stock_moved");
    }
  }

  const result: CloseAuctionResult = {
    listingId: validListingId,
    status: targetStatus,
    closedAt: now.toISOString(),
    ...(winningBid
      ? {
          winningBidId: winningBid._id.toString(),
          winningBidderId: winningBid.buyerId.toString(),
          winningAmountPerKg: winningBid.amountPerKg,
          totalAmount: winningBid.totalAmount,
        }
      : {}),
    ...(finalOrder ? { order: mapOrderToMinimalOrder(finalOrder) } : {}),
    isIdempotentReplay: false,
  };

  emitClosingEvents(result);
  return result;
}

/**
 * Handles a listing that is already in terminal SOLD or EXPIRED_UNSOLD state.
 * Performs crash recovery checks to ensure any incomplete downstream operations
 * converge to full consistency, and returns the result without double-counting.
 */
async function handleAlreadyClosedListing(
  listing: RawListingDoc,
  feeBps: number,
): Promise<CloseAuctionResult> {
  const listingId = listing._id.toString();
  const closedAt = (listing.closedAt ?? new Date()).toISOString();

  if (listing.status === ListingStatus.SOLD) {
    const winningBid = (await Bid.findOne({ listingId })
      .sort({ amountPerKg: -1, seq: -1 })
      .lean()) as unknown as RawBidDoc | null;

    if (winningBid) {
      // Ensure bids are marked correctly in case previous run crashed before step 2
      await Bid.updateOne(
        { _id: winningBid._id, status: { $ne: BidStatus.WON } },
        { $set: { status: BidStatus.WON } },
      );
      await Bid.updateMany(
        { listingId, _id: { $ne: winningBid._id }, status: { $ne: BidStatus.LOST } },
        { $set: { status: BidStatus.LOST } },
      );
    }

    // Ensure Order exists in case previous run crashed before step 3
    let order = (await Order.findOne({ listingId })) as unknown as RawOrderDoc | null;
    if (!order && winningBid) {
      const pricePerKg = winningBid.amountPerKg;
      const subtotal = calculateSubtotal(pricePerKg, listing.quantityKg);
      const { platformFee, farmerNet } = calculateFeeAndNet(subtotal, feeBps);

      try {
        const createdOrders = (await Order.create([
          {
            _id: new ObjectId(listingId),
            listingId,
            farmerId: listing.farmerId,
            buyerId: winningBid.buyerId,
            cropId: listing.cropId,
            quantityKg: listing.quantityKg,
            grade: listing.aiAssessment.grade,
            pricePerKg,
            subtotal,
            platformFee,
            farmerNet,
            status: "PENDING",
            payment: { status: "UNPAID" },
          },
        ])) as unknown as RawOrderDoc[];
        order = createdOrders[0] ?? null;
      } catch (orderCreateErr: unknown) {
        if (!isDuplicateKey(orderCreateErr)) throw orderCreateErr;
        order = (await Order.findOne({ listingId })) as unknown as RawOrderDoc | null;
      }
    }

    // Ensure stock movement exists in case previous run crashed before step 4
    if (order) {
      await markStockSold({
        farmerId: listing.farmerId.toString(),
        cropId: listing.cropId.toString(),
        quantityKg: listing.quantityKg,
        listingId,
        orderId: order._id.toString(),
        operationId: `close-sell-${listingId}`,
        note: `Sold on auction ${listingId}`,
      });
    }

    // Ensure MarketPrice row exists in case previous run crashed before step 5
    if (winningBid) {
      await recordPlatformSalePrice(
        listing.cropId.toString(),
        listing.location.division,
        winningBid.amountPerKg,
        listing.closedAt ?? new Date(),
      );
    }

    return {
      listingId,
      status: ListingStatus.SOLD,
      closedAt,
      ...(winningBid
        ? {
            winningBidId: winningBid._id.toString(),
            winningBidderId: winningBid.buyerId.toString(),
            winningAmountPerKg: winningBid.amountPerKg,
            totalAmount: winningBid.totalAmount,
          }
        : {}),
      ...(order ? { order: mapOrderToMinimalOrder(order) } : {}),
      isIdempotentReplay: true,
    };
  }

  // EXPIRED_UNSOLD: Ensure stock is released in case previous run crashed before release
  await releaseStock({
    farmerId: listing.farmerId.toString(),
    cropId: listing.cropId.toString(),
    quantityKg: listing.quantityKg,
    listingId,
    operationId: `close-release-${listingId}`,
    note: `Released from expired unsold auction ${listingId}`,
  });

  return {
    listingId,
    status: ListingStatus.EXPIRED_UNSOLD,
    closedAt,
    isIdempotentReplay: true,
  };
}

/**
 * Emits the auction.closed and order.created domain events.
 */
function emitClosingEvents(result: CloseAuctionResult): void {
  const emitter = getDomainEventEmitter();

  emitter.emit(DomainEventName.AUCTION_CLOSED, {
    listingId: result.listingId,
    status: result.status,
    closedAt: result.closedAt,
    ...(result.winningBidId ? { winningBidId: result.winningBidId } : {}),
    ...(result.winningBidderId ? { winningBidderId: result.winningBidderId } : {}),
    ...(result.winningAmountPerKg ? { winningAmountPerKg: result.winningAmountPerKg } : {}),
    ...(result.totalAmount ? { totalAmount: result.totalAmount } : {}),
  });

  if (result.order) {
    emitter.emit(DomainEventName.ORDER_CREATED, {
      orderId: result.order.id,
      listingId: result.order.listingId,
      farmerId: result.order.farmerId,
      buyerId: result.order.buyerId,
      cropId: result.order.cropId,
      quantityKg: result.order.quantityKg,
      pricePerKg: result.order.pricePerKg,
      totalAmount: result.order.subtotal,
      platformFee: result.order.platformFee,
      farmerNet: result.order.farmerNet,
      createdAt: result.order.createdAt,
    });
  }
}
