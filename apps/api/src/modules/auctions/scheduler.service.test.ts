import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  BidStatus,
  CropGrade,
  ListingStatus,
  type PublicUser,
  UserRole,
  getSchedulerIntervalMs,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { Bid } from "../bids/bid.model.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { addStock, reserveStockForListing } from "../inventory/inventory.service.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { Listing } from "../listings/listing.model.js";
import { MarketPrice } from "../market-prices/market-price.model.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import {
  AuctionScheduler,
  closeDueListings,
  resetSchedulerState,
  runSchedulerTick,
  runStartupCatchUp,
  startScheduler,
  stopScheduler,
} from "./scheduler.service.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

const farmerUser: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.FARMER,
  name: "Fazlur Rahman",
  division: "Rajshahi",
  district: "Bogra",
  language: "en",
};

const buyerUser: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.BUYER,
  name: "Tareq Agro",
  division: "Dhaka",
  district: "Dhaka",
  organization: "Tareq Wholesale",
  language: "en",
};

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplSet.getUri());
  await Promise.all([
    Listing.init(),
    Bid.init(),
    Order.init(),
    User.init(),
    InventoryItem.init(),
    StockMovement.init(),
    MarketPrice.init(),
  ]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet !== undefined) {
    await mongoReplSet.stop();
  }
});

beforeEach(async () => {
  testClock = new TestClock(new Date("2026-11-14T10:00:00.000Z"));
  setClock(testClock);
  eventEmitter = new DomainEventEmitter();
  setDomainEventEmitter(eventEmitter);

  await Promise.all([
    Listing.deleteMany({}),
    Bid.deleteMany({}),
    Order.deleteMany({}),
    User.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    MarketPrice.deleteMany({}),
  ]);

  resetSchedulerState();
});

afterEach(() => {
  resetSchedulerState();
  resetClock();
  resetDomainEventEmitter();
});

interface CreateListingOptions {
  farmerId?: string;
  quantityKg?: number;
  floorPricePerKg?: number;
  durationMinutes?: number;
  initialStockKg?: number;
  startsAt?: Date;
  endsAt?: Date;
  status?: string;
  extensionCount?: number;
}

async function createTestListing(
  options: CreateListingOptions = {},
): Promise<{ listingId: string; cropId: string }> {
  const farmerId = options.farmerId ?? farmerUser.id;
  const cropId = new Types.ObjectId().toString();
  const quantityKg = options.quantityKg ?? 100;
  const initialStockKg = options.initialStockKg ?? 200;
  const floorPricePerKg = options.floorPricePerKg ?? 4000;
  const durationMinutes = options.durationMinutes ?? 60;
  const listingId = new Types.ObjectId().toString();

  await addStock({
    farmerId,
    cropId,
    quantityKg: initialStockKg,
    operationId: `stock-add-${cropId}-${listingId}`,
  });

  await reserveStockForListing({
    farmerId,
    cropId,
    quantityKg,
    listingId,
    operationId: `stock-list-${listingId}`,
  });

  const now = options.startsAt ?? testClock.now();
  const endsAt = options.endsAt ?? new Date(now.getTime() + durationMinutes * 60 * 1000);

  await Listing.create({
    _id: listingId,
    farmerId,
    cropId,
    quantityKg,
    images: [{ url: "/potato.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.95, B: 0.05, C: 0.0 },
      qualityNotes: ["High quality grade A potato"],
      cropMatch: true,
      modelVersion: "mock-1.0.0",
      provider: "mock",
      degraded: false,
      assessedAt: now,
      imageHashes: ["hash-potato-a"],
    },
    aiPriceGuidance: {
      lowPerKg: 3800,
      expectedPerKg: 4200,
      highPerKg: 4800,
      trend: "FLAT",
      confidence: 0.9,
      explanation: ["Stable market"],
      modelVersion: "mock-1.0.0",
      provider: "mock",
      degraded: false,
      generatedAt: now,
      suggestedFloorPerKg: 4000,
    },
    floorPricePerKg,
    minIncrementPerKg: 100,
    startsAt: now,
    endsAt,
    originalEndsAt: endsAt,
    extensionCount: options.extensionCount ?? 0,
    status: options.status ?? ListingStatus.ACTIVE,
    bidCount: 0,
    location: {
      division: "Rajshahi",
      district: "Bogra",
      upazila: "Sadar",
    },
  });

  return { listingId, cropId };
}

async function placeAcceptedBid(
  listingId: string,
  buyer: PublicUser,
  amountPerKg: number,
  seq = 1,
): Promise<void> {
  const listing = await Listing.findById(listingId);
  if (!listing) throw new Error("Listing not found for bid");

  const totalAmount = Math.round(amountPerKg * listing.quantityKg);

  await Bid.create({
    listingId,
    buyerId: buyer.id,
    amountPerKg,
    totalAmount,
    seq,
    status: BidStatus.ACCEPTED,
    placedAt: testClock.now(),
  });

  await Listing.updateOne(
    { _id: listingId },
    {
      $set: {
        currentBidPerKg: amountPerKg,
        currentBidderId: buyer.id,
        bidCount: seq,
      },
    },
  );
}

describe("Task 4.5 — Auction Scheduler and Startup Catch-Up", () => {
  describe("Due listings closing", () => {
    it("closes due active listings when endsAt has passed (both SOLD with bids and EXPIRED_UNSOLD without bids)", async () => {
      // Listing 1: Has qualifying bid -> should close SOLD
      const { listingId: soldId } = await createTestListing({
        durationMinutes: 30,
        floorPricePerKg: 4000,
      });
      await placeAcceptedBid(soldId, buyerUser, 4500, 1);

      // Listing 2: Has 0 bids -> should close EXPIRED_UNSOLD
      const { listingId: unsoldId } = await createTestListing({
        durationMinutes: 30,
        floorPricePerKg: 4000,
      });

      // Advance clock past the 30m duration
      testClock.advanceBy(31 * 60 * 1000);

      const summary = await closeDueListings({ clock: testClock });

      expect(summary.found).toBe(2);
      expect(summary.closed).toBe(2);
      expect(summary.failed).toBe(0);

      const soldDoc = await Listing.findById(soldId);
      expect(soldDoc?.status).toBe(ListingStatus.SOLD);
      expect(soldDoc?.closedAt).toBeDefined();

      const orderDoc = await Order.findOne({ listingId: soldId });
      expect(orderDoc).not.toBeNull();
      expect(orderDoc?.pricePerKg).toBe(4500);

      const winningBid = await Bid.findOne({ listingId: soldId });
      expect(winningBid?.status).toBe(BidStatus.WON);

      const unsoldDoc = await Listing.findById(unsoldId);
      expect(unsoldDoc?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
      expect(unsoldDoc?.closedAt).toBeDefined();
    });

    it("allows passing a Date object directly as asOf time", async () => {
      const { listingId } = await createTestListing({ durationMinutes: 10 });
      const targetTime = new Date(testClock.now().getTime() + 15 * 60 * 1000);

      // Call closeDueListings passing targetTime Date directly
      const summary = await closeDueListings(targetTime);

      expect(summary.found).toBe(1);
      expect(summary.closed).toBe(1);
      expect(summary.failed).toBe(0);

      const doc = await Listing.findById(listingId);
      expect(doc?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
    });
  });

  describe("Not-yet-due listings stay open", () => {
    it("keeps a not-yet-due listing ACTIVE while closing an expired one", async () => {
      // Listing A: expires in 10 minutes
      const { listingId: expiredId } = await createTestListing({ durationMinutes: 10 });

      // Listing B: expires in 60 minutes
      const { listingId: activeId } = await createTestListing({ durationMinutes: 60 });

      // Advance clock by 15 minutes (past Listing A, but before Listing B)
      testClock.advanceBy(15 * 60 * 1000);

      const summary = await closeDueListings({ clock: testClock });

      expect(summary.found).toBe(1);
      expect(summary.closed).toBe(1);
      expect(summary.results[0]?.listingId).toBe(expiredId);

      const expiredDoc = await Listing.findById(expiredId);
      expect(expiredDoc?.status).toBe(ListingStatus.EXPIRED_UNSOLD);

      const activeDoc = await Listing.findById(activeId);
      expect(activeDoc?.status).toBe(ListingStatus.ACTIVE);
      expect(activeDoc?.closedAt).toBeUndefined();
    });
  });

  describe("Extended listing closes at its new end time", () => {
    it("respects anti-sniping extension: remains ACTIVE past originalEndsAt, closes after new endsAt", async () => {
      const initialNow = testClock.now();
      const originalEndsAt = new Date(initialNow.getTime() + 10 * 60 * 1000); // T0 + 10m
      const extendedEndsAt = new Date(initialNow.getTime() + 12 * 60 * 1000); // T0 + 12m (extended by 2m)

      const { listingId } = await createTestListing({
        startsAt: initialNow,
        endsAt: extendedEndsAt,
        durationMinutes: 12,
        extensionCount: 1,
      });

      // Update originalEndsAt to simulate anti-sniping extension from T0 + 10m
      await Listing.updateOne(
        { _id: listingId },
        {
          $set: {
            originalEndsAt,
            endsAt: extendedEndsAt,
            extensionCount: 1,
          },
        },
      );
      await placeAcceptedBid(listingId, buyerUser, 4500, 1);

      // Phase 1: Advance time to T0 + 10m 30s (past originalEndsAt, but BEFORE extendedEndsAt)
      testClock.advanceTo(new Date(initialNow.getTime() + 10 * 60 * 1000 + 30 * 1000));

      const tick1 = await closeDueListings({ clock: testClock });
      expect(tick1.found).toBe(0);
      expect(tick1.closed).toBe(0);

      const midDoc = await Listing.findById(listingId);
      expect(midDoc?.status).toBe(ListingStatus.ACTIVE);

      // Phase 2: Advance time past extendedEndsAt (T0 + 12m 5s)
      testClock.advanceTo(new Date(extendedEndsAt.getTime() + 5 * 1000));

      const tick2 = await closeDueListings({ clock: testClock });
      expect(tick2.found).toBe(1);
      expect(tick2.closed).toBe(1);
      expect(tick2.results[0]?.status).toBe(ListingStatus.SOLD);

      const finalDoc = await Listing.findById(listingId);
      expect(finalDoc?.status).toBe(ListingStatus.SOLD);
    });
  });

  describe("Overlapping ticks not double-closing", () => {
    it("skips a tick if the previous tick is still in progress (concurrency guard)", async () => {
      // Create a deferred promise to keep the first tick executing
      let finishFirstTick!: (value: unknown) => void;
      const blockerPromise = new Promise((resolve) => {
        finishFirstTick = resolve;
      });

      // Create due listing
      await createTestListing({ durationMinutes: 5 });
      testClock.advanceBy(6 * 60 * 1000);

      // Mock closeAuctionFn on the scheduler to pause during execution
      const schedulerWithBlocker = new AuctionScheduler({
        clock: testClock,
        closeAuctionFn: async (id): Promise<import("./closing.service.js").CloseAuctionResult> => {
          await blockerPromise;
          return {
            listingId: id,
            status: ListingStatus.EXPIRED_UNSOLD,
            closedAt: testClock.iso(),
            isIdempotentReplay: false,
          };
        },
      });

      // Start the first tick (will pause inside closer)
      const tick1Promise = schedulerWithBlocker.tick();

      // Ensure tick 1 is currently in progress
      expect(schedulerWithBlocker.isTickInProgress()).toBe(true);

      // Trigger a second overlapping tick while tick 1 is still running
      const tick2Result = await schedulerWithBlocker.tick();

      // Guard must skip tick 2 and return null
      expect(tick2Result).toBeNull();

      // Resolve blocker to complete tick 1
      finishFirstTick(true);
      const tick1Result = await tick1Promise;

      expect(tick1Result).not.toBeNull();
      expect(tick1Result?.found).toBe(1);
      expect(schedulerWithBlocker.isTickInProgress()).toBe(false);
    });

    it("ensures concurrent closeDueListings runs are idempotent and never double-create orders", async () => {
      const { listingId } = await createTestListing({ durationMinutes: 5 });
      await placeAcceptedBid(listingId, buyerUser, 5000, 1);

      testClock.advanceBy(6 * 60 * 1000);

      // Fire two closeDueListings simultaneously
      const [runA, runB] = await Promise.all([
        closeDueListings({ clock: testClock }),
        closeDueListings({ clock: testClock }),
      ]);

      // Exactly one order must exist
      const orders = await Order.find({ listingId });
      expect(orders.length).toBe(1);

      const listing = await Listing.findById(listingId);
      expect(listing?.status).toBe(ListingStatus.SOLD);

      // Total successful close across both calls
      const totalClosed = runA.closed + runB.closed;
      expect(totalClosed).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Error isolation per listing", () => {
    it("isolates errors per listing so one failing listing does not block the others", async () => {
      // Listing 1: Valid due listing
      const { listingId: id1 } = await createTestListing({ durationMinutes: 5 });
      await placeAcceptedBid(id1, buyerUser, 4200, 1);

      // Listing 2: Will be configured to throw an isolated error
      const { listingId: id2 } = await createTestListing({ durationMinutes: 5 });

      // Listing 3: Valid due listing
      const { listingId: id3 } = await createTestListing({ durationMinutes: 5 });

      testClock.advanceBy(10 * 60 * 1000);

      // Inject failure specifically for listing 2
      const customCloser = async (
        listingId: string,
        options: import("./closing.service.js").CloseAuctionOptions,
      ): Promise<import("./closing.service.js").CloseAuctionResult> => {
        if (listingId === id2) {
          throw new Error("Simulated isolated error for listing 2");
        }
        const { closeAuction } = await import("./closing.service.js");
        return closeAuction(listingId, options);
      };

      const summary = await closeDueListings({
        clock: testClock,
        closeAuctionFn: customCloser,
      });

      expect(summary.found).toBe(3);
      expect(summary.closed).toBe(2);
      expect(summary.failed).toBe(1);

      // Verify listing 1 and listing 3 succeeded
      const outcome1 = summary.results.find((r) => r.listingId === id1);
      expect(outcome1?.success).toBe(true);
      expect(outcome1?.status).toBe(ListingStatus.SOLD);

      const outcome2 = summary.results.find((r) => r.listingId === id2);
      expect(outcome2?.success).toBe(false);
      expect(outcome2?.error).toBeDefined();

      const outcome3 = summary.results.find((r) => r.listingId === id3);
      expect(outcome3?.success).toBe(true);
      expect(outcome3?.status).toBe(ListingStatus.EXPIRED_UNSOLD);

      // Database verification
      const doc1 = await Listing.findById(id1);
      expect(doc1?.status).toBe(ListingStatus.SOLD);

      const doc2 = await Listing.findById(id2);
      expect(doc2?.status).toBe(ListingStatus.ACTIVE); // remains active because closer threw

      const doc3 = await Listing.findById(id3);
      expect(doc3?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
    });
  });

  describe("Startup catch-up pass", () => {
    it("closes listings that expired while the server was down", async () => {
      // Simulate two listings that expired in the past before server started
      const { listingId: id1 } = await createTestListing({ durationMinutes: 10 });
      const { listingId: id2 } = await createTestListing({ durationMinutes: 20 });
      await placeAcceptedBid(id1, buyerUser, 4500, 1);

      // 40 minutes elapsed while server was down
      testClock.advanceBy(40 * 60 * 1000);

      // Run startup catch-up pass
      const catchUpSummary = await runStartupCatchUp({ clock: testClock });

      expect(catchUpSummary.found).toBe(2);
      expect(catchUpSummary.closed).toBe(2);
      expect(catchUpSummary.failed).toBe(0);

      const doc1 = await Listing.findById(id1);
      expect(doc1?.status).toBe(ListingStatus.SOLD);

      const doc2 = await Listing.findById(id2);
      expect(doc2?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
    });
  });

  describe("Scheduler tick interval and lifecycle", () => {
    it("uses 10s default interval and 2s demo interval according to ARCHITECTURE §6", () => {
      expect(getSchedulerIntervalMs(false)).toBe(10_000);
      expect(getSchedulerIntervalMs(true)).toBe(2_000);

      const defaultScheduler = new AuctionScheduler();
      expect(defaultScheduler.getIntervalMs()).toBe(10_000);

      const customScheduler = new AuctionScheduler({ intervalMs: 2_000 });
      expect(customScheduler.getIntervalMs()).toBe(2_000);
    });

    it("starts and stops periodic timer cleanly", () => {
      const scheduler = startScheduler({ intervalMs: 5_000 });
      expect(scheduler.isRunning()).toBe(true);

      // Starting again is a no-op
      const sameScheduler = startScheduler();
      expect(sameScheduler).toBe(scheduler);

      stopScheduler();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("runs runSchedulerTick through active scheduler", async () => {
      const { listingId } = await createTestListing({ durationMinutes: 5 });
      testClock.advanceBy(6 * 60 * 1000);

      const result = await runSchedulerTick({ clock: testClock });
      expect(result).not.toBeNull();
      expect(result?.closed).toBe(1);

      const doc = await Listing.findById(listingId);
      expect(doc?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
    });
  });
});
