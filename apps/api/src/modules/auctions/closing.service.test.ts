import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AuctionCloseTrigger,
  BidStatus,
  CropGrade,
  DomainEventName,
  ListingStatus,
  type PublicUser,
  UserRole,
  calculateFeeAndNet,
  calculateSubtotal,
} from "@bazarbeat/shared";

import { app } from "../../app.js";
import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { createSessionTokens } from "../auth/tokens.js";
import { Bid } from "../bids/bid.model.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { addStock, reserveStockForListing } from "../inventory/inventory.service.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { Listing } from "../listings/listing.model.js";
import { MarketPrice } from "../market-prices/market-price.model.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { type CrashInjectionPoint, closeAuction } from "./closing.service.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

const farmerUser: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.FARMER,
  name: "Abdul Farmer",
  division: "Rajshahi",
  district: "Bogra",
  language: "en",
};

const otherFarmerUser: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.FARMER,
  name: "Rahim Farmer",
  division: "Rangpur",
  district: "Dinajpur",
  language: "en",
};

const buyerOne: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.BUYER,
  name: "Buyer One",
  division: "Dhaka",
  district: "Dhaka",
  organization: "Dhaka Agro Trading",
  language: "en",
};

const buyerTwo: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.BUYER,
  name: "Buyer Two",
  division: "Chittagong",
  district: "Chittagong",
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
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

interface CreateListingWithStockOptions {
  farmerId?: string;
  quantityKg?: number;
  floorPricePerKg?: number;
  durationMinutes?: number;
  initialAvailableKg?: number;
  division?: string;
}

async function createListingWithReservedStock(
  options: CreateListingWithStockOptions = {},
): Promise<{ listing: InstanceType<typeof Listing>; cropId: string }> {
  const farmerId = options.farmerId ?? farmerUser.id;
  const cropId = new Types.ObjectId().toString();
  const quantityKg = options.quantityKg ?? 50;
  const initialAvailableKg = options.initialAvailableKg ?? 100;
  const floorPricePerKg = options.floorPricePerKg ?? 5000;
  const durationMinutes = options.durationMinutes ?? 60;
  const division = options.division ?? "Rajshahi";

  // 1. Initial stock addition
  await addStock({
    farmerId,
    cropId,
    quantityKg: initialAvailableKg,
    operationId: `seed-add-${cropId}`,
  });

  const now = testClock.now();
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const listingId = new Types.ObjectId().toString();

  // 2. Reserve stock for listing
  await reserveStockForListing({
    farmerId,
    cropId,
    quantityKg,
    listingId,
    operationId: `list-${listingId}`,
  });

  // 3. Create active listing
  const listing = await Listing.create({
    _id: listingId,
    farmerId,
    cropId,
    quantityKg,
    images: [{ url: "/sample.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.95, B: 0.05, C: 0.0 },
      qualityNotes: ["Premium quality"],
      cropMatch: true,
      modelVersion: "mock-1.0.0",
      provider: "mock",
      degraded: false,
      assessedAt: now,
      imageHashes: ["mock-hash"],
    },
    aiPriceGuidance: {
      lowPerKg: 4500,
      expectedPerKg: 5200,
      highPerKg: 6000,
      trend: "UP",
      confidence: 0.9,
      explanation: ["Strong market demand"],
      modelVersion: "mock-1.0.0",
      provider: "mock",
      degraded: false,
      generatedAt: now,
      suggestedFloorPerKg: 5000,
    },
    floorPricePerKg,
    minIncrementPerKg: 100,
    startsAt: now,
    endsAt,
    originalEndsAt: endsAt,
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    bidCount: 0,
    location: {
      division,
      district: "Bogra",
      upazila: "Sadar",
    },
  });

  return { listing, cropId };
}

async function addBidToListing(
  listing: InstanceType<typeof Listing>,
  buyer: PublicUser,
  amountPerKg: number,
  seq: number,
): Promise<InstanceType<typeof Bid>> {
  const totalAmount = Math.round(amountPerKg * listing.quantityKg);
  const bid = await Bid.create({
    listingId: listing._id,
    buyerId: buyer.id,
    amountPerKg,
    totalAmount,
    seq,
    status: BidStatus.ACCEPTED,
    placedAt: testClock.now(),
  });

  await Listing.updateOne(
    { _id: listing._id },
    {
      $set: {
        currentBidPerKg: amountPerKg,
        currentBidderId: buyer.id,
        bidCount: seq,
      },
    },
  );

  return bid;
}

async function verifyLedgerReconciliation(
  farmerId: string,
  cropId: string,
): Promise<void> {
  const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
  expect(inventory).not.toBeNull();

  const movements = await StockMovement.find({ farmerId, cropId, status: "APPLIED" }).lean();
  expect(movements.length).toBeGreaterThan(0);

  const ledgerTotals = movements.reduce(
    (totals, movement) => {
      const quantity = movement.quantityKg;
      if (movement.type === "ADD" || movement.type === "ADJUST") {
        totals.availableKg += quantity;
      }
      if (movement.type === "LIST") {
        totals.availableKg -= quantity;
        totals.listedKg += quantity;
      }
      if (movement.type === "RELEASE") {
        totals.availableKg += quantity;
        totals.listedKg -= quantity;
      }
      if (movement.type === "SELL") {
        totals.listedKg -= quantity;
        totals.soldKg += quantity;
      }
      return totals;
    },
    { availableKg: 0, listedKg: 0, soldKg: 0 },
  );

  expect(inventory?.availableKg).toBeCloseTo(ledgerTotals.availableKg, 5);
  expect(inventory?.listedKg).toBeCloseTo(ledgerTotals.listedKg, 5);
  expect(inventory?.soldKg).toBeCloseTo(ledgerTotals.soldKg, 5);
}

describe("Auction Closing Service (Task 4.4)", () => {
  describe("Trigger: TIMER_EXPIRED (Sold Outcome)", () => {
    it("closes auction as SOLD, creates Order, marks bids, moves stock to SELL, and emits events", async () => {
      const { listing, cropId } = await createListingWithReservedStock({
        quantityKg: 20,
        initialAvailableKg: 100,
        floorPricePerKg: 5000,
      });

      // Add 2 bids: buyerOne bids 5000, buyerTwo outbids with 5200
      const bid1 = await addBidToListing(listing, buyerOne, 5000, 1);
      const bid2 = await addBidToListing(listing, buyerTwo, 5200, 2);

      // Advance clock past endsAt
      testClock.advanceBy(61 * 60 * 1000);

      const closedEvents: unknown[] = [];
      const orderCreatedEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.AUCTION_CLOSED, (p) => { closedEvents.push(p); });
      eventEmitter.on(DomainEventName.ORDER_CREATED, (p) => { orderCreatedEvents.push(p); });

      const result = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.TIMER_EXPIRED,
      });

      expect(result.status).toBe(ListingStatus.SOLD);
      expect(result.isIdempotentReplay).toBe(false);
      expect(result.winningBidId).toBe(bid2._id.toString());
      expect(result.winningBidderId).toBe(buyerTwo.id);
      expect(result.winningAmountPerKg).toBe(5200);
      expect(result.totalAmount).toBe(104000); // 5200 * 20
      expect(result.order).toBeDefined();

      // Check Order document in database
      const orderInDb = await Order.findOne({ listingId: listing._id }).lean();
      expect(orderInDb).not.toBeNull();
      expect(orderInDb?.farmerId.toString()).toBe(farmerUser.id);
      expect(orderInDb?.buyerId.toString()).toBe(buyerTwo.id);
      expect(orderInDb?.cropId.toString()).toBe(cropId);
      expect(orderInDb?.quantityKg).toBe(20);
      expect(orderInDb?.grade).toBe(CropGrade.A);
      expect(orderInDb?.pricePerKg).toBe(5200);
      expect(orderInDb?.subtotal).toBe(104000);
      expect(orderInDb?.platformFee).toBe(2080); // 104,000 * 200 / 10,000 = 2,080 poisha
      expect(orderInDb?.farmerNet).toBe(101920); // 104,000 - 2,080 = 101,920 poisha
      expect(orderInDb?.status).toBe("PENDING");
      expect(orderInDb?.payment.status).toBe("UNPAID");

      // Verify bid statuses
      const updatedBid1 = await Bid.findById(bid1._id);
      const updatedBid2 = await Bid.findById(bid2._id);
      expect(updatedBid1?.status).toBe(BidStatus.LOST);
      expect(updatedBid2?.status).toBe(BidStatus.WON);

      // Verify Listing status
      const updatedListing = await Listing.findById(listing._id);
      expect(updatedListing?.status).toBe(ListingStatus.SOLD);
      expect(updatedListing?.closedAt).toBeDefined();
      expect(updatedListing?.winningBidId?.toString()).toBe(bid2._id.toString());

      // Verify ledger reconciliation (stock moved listed -> sold)
      await verifyLedgerReconciliation(farmerUser.id, cropId);
      const inventory = await InventoryItem.findOne({ farmerId: farmerUser.id, cropId });
      expect(inventory?.availableKg).toBe(80);
      expect(inventory?.listedKg).toBe(0);
      expect(inventory?.soldKg).toBe(20);

      // Verify MarketPrice PLATFORM row recorded
      const marketPriceRow = await MarketPrice.findOne({
        cropId,
        source: "PLATFORM",
      }).lean();
      expect(marketPriceRow).not.toBeNull();
      expect(marketPriceRow?.division).toBe("rajshahi");
      expect(marketPriceRow?.minPricePerKg).toBe(5200);
      expect(marketPriceRow?.maxPricePerKg).toBe(5200);
      expect(marketPriceRow?.avgPricePerKg).toBe(5200);

      // Verify emitted domain events
      expect(closedEvents).toHaveLength(1);
      expect(closedEvents[0]).toMatchObject({
        listingId: listing._id.toString(),
        status: ListingStatus.SOLD,
        winningBidId: bid2._id.toString(),
      });
      expect(orderCreatedEvents).toHaveLength(1);
      expect(orderCreatedEvents[0]).toMatchObject({
        orderId: orderInDb?._id.toString(),
        listingId: listing._id.toString(),
        farmerId: farmerUser.id,
        buyerId: buyerTwo.id,
        pricePerKg: 5200,
        totalAmount: 104000,
        platformFee: 2080,
        farmerNet: 101920,
      });
    });

    it("rejects TIMER_EXPIRED closing if auction timer has not elapsed yet with 400 AUCTION_NOT_EXPIRED", async () => {
      const { listing } = await createListingWithReservedStock({
        durationMinutes: 60,
      });

      // Still active, only 10 minutes elapsed
      testClock.advanceBy(10 * 60 * 1000);

      await expect(
        closeAuction(listing._id.toString(), {
          trigger: AuctionCloseTrigger.TIMER_EXPIRED,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "AUCTION_NOT_EXPIRED",
      });

      const unchanged = await Listing.findById(listing._id);
      expect(unchanged?.status).toBe(ListingStatus.ACTIVE);
    });
  });

  describe("Trigger: TIMER_EXPIRED (Unsold Outcome)", () => {
    it("closes auction as EXPIRED_UNSOLD when zero bids exist, releases stock back to available, and does not create order", async () => {
      const { listing, cropId } = await createListingWithReservedStock({
        quantityKg: 35,
        initialAvailableKg: 100,
      });

      // Zero bids placed. Advance clock past endsAt.
      testClock.advanceBy(61 * 60 * 1000);

      const closedEvents: unknown[] = [];
      const orderCreatedEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.AUCTION_CLOSED, (p) => { closedEvents.push(p); });
      eventEmitter.on(DomainEventName.ORDER_CREATED, (p) => { orderCreatedEvents.push(p); });

      const result = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.TIMER_EXPIRED,
      });

      expect(result.status).toBe(ListingStatus.EXPIRED_UNSOLD);
      expect(result.winningBidId).toBeUndefined();
      expect(result.order).toBeUndefined();

      // No order created
      const orderCount = await Order.countDocuments({ listingId: listing._id });
      expect(orderCount).toBe(0);

      // Listing status updated
      const updatedListing = await Listing.findById(listing._id);
      expect(updatedListing?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
      expect(updatedListing?.closedAt).toBeDefined();

      // Inventory released from listed back to available
      await verifyLedgerReconciliation(farmerUser.id, cropId);
      const inventory = await InventoryItem.findOne({ farmerId: farmerUser.id, cropId });
      expect(inventory?.availableKg).toBe(100); // 65 + 35 released = 100
      expect(inventory?.listedKg).toBe(0);
      expect(inventory?.soldKg).toBe(0);

      // Event verification
      expect(closedEvents).toHaveLength(1);
      expect(closedEvents[0]).toMatchObject({
        listingId: listing._id.toString(),
        status: ListingStatus.EXPIRED_UNSOLD,
      });
      expect(orderCreatedEvents).toHaveLength(0);

      // No MarketPrice recorded
      const marketPriceCount = await MarketPrice.countDocuments({ cropId, source: "PLATFORM" });
      expect(marketPriceCount).toBe(0);
    });
  });

  describe("Trigger: FARMER_ACCEPT (Early Accept)", () => {
    it("closes auction early when owner farmer accepts qualifying bid before timer expires", async () => {
      const { listing, cropId } = await createListingWithReservedStock({
        quantityKg: 15,
        initialAvailableKg: 50,
        floorPricePerKg: 4000,
        durationMinutes: 120,
      });

      await addBidToListing(listing, buyerOne, 4200, 1);

      // Only 15 minutes in (well before endsAt)
      testClock.advanceBy(15 * 60 * 1000);

      const result = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.FARMER_ACCEPT,
        farmerId: farmerUser.id,
      });

      expect(result.status).toBe(ListingStatus.SOLD);
      expect(result.winningAmountPerKg).toBe(4200);
      expect(result.order).toBeDefined();
      expect(result.order?.subtotal).toBe(63000); // 4200 * 15

      const orderInDb = await Order.findOne({ listingId: listing._id });
      expect(orderInDb).not.toBeNull();

      // Inventory correctly sold
      await verifyLedgerReconciliation(farmerUser.id, cropId);
      const inventory = await InventoryItem.findOne({ farmerId: farmerUser.id, cropId });
      expect(inventory?.availableKg).toBe(35);
      expect(inventory?.listedKg).toBe(0);
      expect(inventory?.soldKg).toBe(15);
    });

    it("rejects early accept if requested by non-owner farmer with 403 FORBIDDEN", async () => {
      const { listing } = await createListingWithReservedStock({
        floorPricePerKg: 4000,
      });

      await addBidToListing(listing, buyerOne, 4500, 1);

      await expect(
        closeAuction(listing._id.toString(), {
          trigger: AuctionCloseTrigger.FARMER_ACCEPT,
          farmerId: otherFarmerUser.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });

    it("rejects early accept if there are zero bids with 400 NO_BIDS", async () => {
      const { listing } = await createListingWithReservedStock({
        floorPricePerKg: 4000,
      });

      await expect(
        closeAuction(listing._id.toString(), {
          trigger: AuctionCloseTrigger.FARMER_ACCEPT,
          farmerId: farmerUser.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "NO_BIDS",
      });
    });
  });

  describe("Re-Run Safety and Idempotence", () => {
    it("running the closer twice on a sold listing yields exactly one Order and one set of ledger entries", async () => {
      const { listing, cropId } = await createListingWithReservedStock({
        quantityKg: 10,
        initialAvailableKg: 50,
        floorPricePerKg: 3000,
      });

      await addBidToListing(listing, buyerOne, 3500, 1);
      testClock.advanceBy(61 * 60 * 1000);

      // First run
      const firstResult = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.TIMER_EXPIRED,
      });
      expect(firstResult.status).toBe(ListingStatus.SOLD);
      expect(firstResult.isIdempotentReplay).toBe(false);

      // Second run (re-run)
      const secondResult = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.TIMER_EXPIRED,
      });
      expect(secondResult.status).toBe(ListingStatus.SOLD);
      expect(secondResult.isIdempotentReplay).toBe(true);
      expect(secondResult.order?.id).toBe(firstResult.order?.id);

      // Third run via SCHEDULER
      const thirdResult = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.SCHEDULER,
      });
      expect(thirdResult.isIdempotentReplay).toBe(true);

      // Invariant: Exactly 1 order in database
      const orderDocs = await Order.find({ listingId: listing._id });
      expect(orderDocs).toHaveLength(1);

      // Invariant: Exactly 1 SELL movement in ledger
      const sellMovements = await StockMovement.find({
        listingId: listing._id.toString(),
        type: "SELL",
      });
      expect(sellMovements).toHaveLength(1);

      // Invariant: Ledger reconciliation passes cleanly
      await verifyLedgerReconciliation(farmerUser.id, cropId);
      const inventory = await InventoryItem.findOne({ farmerId: farmerUser.id, cropId });
      expect(inventory?.availableKg).toBe(40);
      expect(inventory?.listedKg).toBe(0);
      expect(inventory?.soldKg).toBe(10);
    });

    it("running the closer twice on an unsold listing yields exactly one RELEASE ledger entry", async () => {
      const { listing, cropId } = await createListingWithReservedStock({
        quantityKg: 25,
        initialAvailableKg: 60,
      });

      testClock.advanceBy(61 * 60 * 1000);

      // First run
      const firstResult = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.TIMER_EXPIRED,
      });
      expect(firstResult.isIdempotentReplay).toBe(false);

      // Second run
      const secondResult = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.SCHEDULER,
      });
      expect(secondResult.isIdempotentReplay).toBe(true);

      // Invariant: Exactly 1 RELEASE movement in ledger
      const releaseMovements = await StockMovement.find({
        listingId: listing._id.toString(),
        type: "RELEASE",
      });
      expect(releaseMovements).toHaveLength(1);

      await verifyLedgerReconciliation(farmerUser.id, cropId);
      const inventory = await InventoryItem.findOne({ farmerId: farmerUser.id, cropId });
      expect(inventory?.availableKg).toBe(60);
      expect(inventory?.listedKg).toBe(0);
    });
  });

  describe("Crash Injection and Convergence", () => {
    const crashSteps: CrashInjectionPoint[] = [
      "after_listing_update",
      "after_bids_marked",
      "after_order_created",
      "after_stock_moved",
      "after_market_price",
    ];

    for (const step of crashSteps) {
      it(`converges to a consistent state when crashed at '${step}' followed by re-run`, async () => {
        const { listing, cropId } = await createListingWithReservedStock({
          quantityKg: 30,
          initialAvailableKg: 100,
          floorPricePerKg: 4000,
        });

        await addBidToListing(listing, buyerOne, 4500, 1);
        await addBidToListing(listing, buyerTwo, 4800, 2);
        testClock.advanceBy(61 * 60 * 1000);

        // 1. Crash injection
        await expect(
          closeAuction(listing._id.toString(), {
            trigger: AuctionCloseTrigger.TIMER_EXPIRED,
            _testCrashAfterStep: step,
          }),
        ).rejects.toThrow(`Simulated crash: ${step}`);

        // 2. Re-run closer without crash injection
        const recoveryResult = await closeAuction(listing._id.toString(), {
          trigger: AuctionCloseTrigger.TIMER_EXPIRED,
        });

        expect(recoveryResult.status).toBe(ListingStatus.SOLD);
        expect(recoveryResult.order).toBeDefined();

        // 3. Verify convergence: Exactly 1 order in DB
        const orders = await Order.find({ listingId: listing._id });
        expect(orders).toHaveLength(1);

        // 4. Verify convergence: Exactly 1 SELL movement in ledger
        const sellMovements = await StockMovement.find({
          listingId: listing._id.toString(),
          type: "SELL",
        });
        expect(sellMovements).toHaveLength(1);

        // 5. Verify ledger reconciliation
        await verifyLedgerReconciliation(farmerUser.id, cropId);
        const inventory = await InventoryItem.findOne({ farmerId: farmerUser.id, cropId });
        expect(inventory?.availableKg).toBe(70);
        expect(inventory?.listedKg).toBe(0);
        expect(inventory?.soldKg).toBe(30);

        // 6. Verify winning and lost bids
        const bids = await Bid.find({ listingId: listing._id }).sort({ seq: 1 });
        expect(bids[0]?.status).toBe(BidStatus.LOST);
        expect(bids[1]?.status).toBe(BidStatus.WON);

        // 7. Third run to confirm steady-state idempotence after recovery
        const subsequentResult = await closeAuction(listing._id.toString(), {
          trigger: AuctionCloseTrigger.TIMER_EXPIRED,
        });
        expect(subsequentResult.isIdempotentReplay).toBe(true);
        expect(await Order.countDocuments({ listingId: listing._id })).toBe(1);
        expect(
          await StockMovement.countDocuments({
            listingId: listing._id.toString(),
            type: "SELL",
          }),
        ).toBe(1);
      });
    }
  });

  describe("Fee and Net Math Coverage", () => {
    it("strictly computes subtotal, platformFee, and farmerNet using shared helper with no poisha discrepancy", async () => {
      const { listing } = await createListingWithReservedStock({
        quantityKg: 33.3, // fractional kg
        initialAvailableKg: 100,
        floorPricePerKg: 3333,
      });

      await addBidToListing(listing, buyerOne, 3333, 1);
      testClock.advanceBy(61 * 60 * 1000);

      const feeBps = 250; // 2.5%
      const result = await closeAuction(listing._id.toString(), {
        trigger: AuctionCloseTrigger.TIMER_EXPIRED,
        platformFeeBps: feeBps,
      });

      const subtotal = calculateSubtotal(3333, 33.3); // 3333 * 33.3 = 110,988.9 -> 110,989 poisha
      const { platformFee, farmerNet } = calculateFeeAndNet(subtotal, feeBps);

      expect(result.order?.pricePerKg).toBe(3333);
      expect(result.order?.quantityKg).toBe(33.3);
      expect(result.order?.subtotal).toBe(subtotal);
      expect(result.order?.platformFee).toBe(platformFee);
      expect(result.order?.farmerNet).toBe(farmerNet);
      expect(platformFee + farmerNet).toBe(subtotal);

      const orderInDb = await Order.findOne({ listingId: listing._id }).lean();
      expect(orderInDb?.platformFee).toBe(platformFee);
      expect(orderInDb?.farmerNet).toBe(farmerNet);
      expect(orderInDb?.subtotal).toBe(subtotal);
    });
  });

  describe("HTTP Route: POST /api/v1/listings/:id/accept-current-bid", () => {
    it("allows the listing farmer owner to accept the current bid early via the HTTP endpoint", async () => {
      // 1. Create farmer user in database and generate session tokens
      const dbFarmer = await User.create({
        role: UserRole.FARMER,
        name: "Farmer Karim",
        phone: "+8801712345678",
        passwordHash: "$2b$12$e8x/kO2b.FqXpT89z.2Ppe85xG8r2uH9/qL9wE1j.y0R9xL0t.0W6",
        division: "dhaka",
        district: "gazipur",
        language: "en",
      });

      const { accessToken } = createSessionTokens(dbFarmer._id.toString());
      const accessCookie = `accessToken=${accessToken}`;

      // 2. Create listing owned by this authenticated farmer
      const { listing } = await createListingWithReservedStock({
        farmerId: dbFarmer._id.toString(),
        quantityKg: 10,
        floorPricePerKg: 4000,
      });

      await addBidToListing(listing, buyerOne, 4500, 1);

      // 3. Post to /accept-current-bid with CSRF and auth cookie
      const acceptRes = await request(app)
        .post(`/api/v1/listings/${listing._id}/accept-current-bid`)
        .set("Cookie", accessCookie)
        .set("X-CSRF-Protection", "1");

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data).toBeDefined();
      expect(acceptRes.body.data.pricePerKg).toBe(4500);
      expect(acceptRes.body.data.subtotal).toBe(45000);
      expect(acceptRes.body.meta.serverTime).toBeDefined();

      const updatedListing = await Listing.findById(listing._id);
      expect(updatedListing?.status).toBe(ListingStatus.SOLD);
    });
  });
});
