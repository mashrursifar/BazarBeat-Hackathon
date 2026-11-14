import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  BidStatus,
  CropGrade,
  ListingStatus,
  type PublicUser,
  UserRole,
  calculateFeeAndNet,
  calculateSubtotal,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { env } from "../../config/env.js";
import { Bid } from "../bids/bid.model.js";
import { placeBid } from "../bids/bid.service.js";
import { Crop } from "../crops/crop.model.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { addStock, reserveStockForListing } from "../inventory/inventory.service.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { Listing } from "../listings/listing.model.js";
import { MarketPrice } from "../market-prices/market-price.model.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { closeDueListings } from "./scheduler.service.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

// Setup test users
const farmers: PublicUser[] = [
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.FARMER,
    name: "Farmer Bogra",
    division: "Rajshahi",
    district: "Bogra",
    language: "en",
  },
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.FARMER,
    name: "Farmer Dinajpur",
    division: "Rangpur",
    district: "Dinajpur",
    language: "en",
  },
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.FARMER,
    name: "Farmer Jessore",
    division: "Khulna",
    district: "Jessore",
    language: "en",
  },
];

const buyers: PublicUser[] = [
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.BUYER,
    name: "Buyer Dhaka One",
    division: "Dhaka",
    district: "Dhaka",
    organization: "Agro Traders 1",
    language: "en",
  },
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.BUYER,
    name: "Buyer Dhaka Two",
    division: "Dhaka",
    district: "Gazipur",
    organization: "Fresh Mart",
    language: "en",
  },
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.BUYER,
    name: "Buyer Chittagong",
    division: "Chittagong",
    district: "Chittagong",
    organization: "Port Bidders",
    language: "en",
  },
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.BUYER,
    name: "Buyer Sylhet",
    division: "Sylhet",
    district: "Sylhet",
    organization: "Surma Produce",
    language: "en",
  },
  {
    id: new Types.ObjectId().toString(),
    role: UserRole.BUYER,
    name: "Buyer Barisal",
    division: "Barisal",
    district: "Barisal",
    language: "en",
  },
];

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
    Crop.init(),
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
    Crop.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    MarketPrice.deleteMany({}),
  ]);
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

interface SeedListingResult {
  listing: InstanceType<typeof Listing>;
  crop: InstanceType<typeof Crop>;
  farmer: PublicUser;
  initialStockKg: number;
}

async function seedListingWithStock(options: {
  farmer: PublicUser;
  cropName: string;
  slug: string;
  quantityKg: number;
  initialStockKg: number;
  floorPricePerKg: number;
  minIncrementPerKg: number;
  durationMinutes: number;
}): Promise<SeedListingResult> {
  const crop = await Crop.create({
    slug: options.slug,
    nameEn: options.cropName,
    nameBn: options.cropName,
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 2000,
    shelfLifeHours: 120,
    minIncrementPerKg: options.minIncrementPerKg,
    imageUrl: `/${options.slug}.svg`,
    gradeGuide: {
      A: "Grade A description",
      B: "Grade B description",
      C: "Grade C description",
    },
    isActive: true,
  });

  // Seed inventory: add stock then reserve for listing
  await addStock({
    farmerId: options.farmer.id,
    cropId: crop._id.toString(),
    quantityKg: options.initialStockKg,
    operationId: `add-${options.farmer.id}-${crop._id.toString()}`,
    note: "Harvest intake",
  });

  const listingId = new Types.ObjectId().toString();
  await reserveStockForListing({
    farmerId: options.farmer.id,
    cropId: crop._id.toString(),
    quantityKg: options.quantityKg,
    listingId,
    operationId: `reserve-${listingId}`,
  });

  const startsAt = testClock.now();
  const endsAt = new Date(startsAt.getTime() + options.durationMinutes * 60 * 1000);

  const listing = await Listing.create({
    _id: listingId,
    farmerId: options.farmer.id,
    cropId: crop._id,
    quantityKg: options.quantityKg,
    images: [{ url: `/${options.slug}.jpg`, width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.9, B: 0.08, C: 0.02 },
      qualityNotes: ["Top market quality"],
      cropMatch: true,
      modelVersion: "mock-1.0",
      provider: "mock",
      degraded: false,
      assessedAt: startsAt,
    },
    aiPriceGuidance: {
      lowPerKg: options.floorPricePerKg - 500,
      expectedPerKg: options.floorPricePerKg,
      highPerKg: options.floorPricePerKg + 1000,
      trend: "UP",
      confidence: 0.9,
      explanation: ["Strong market demand"],
      modelVersion: "mock-price-1.0",
      provider: "mock",
      degraded: false,
      generatedAt: startsAt,
      suggestedFloorPerKg: options.floorPricePerKg,
    },
    floorPricePerKg: options.floorPricePerKg,
    minIncrementPerKg: options.minIncrementPerKg,
    startsAt,
    endsAt,
    originalEndsAt: endsAt,
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    bidCount: 0,
    location: {
      division: options.farmer.division,
      district: options.farmer.district,
    },
  });

  return {
    listing,
    crop,
    farmer: options.farmer,
    initialStockKg: options.initialStockKg,
  };
}

describe("AUCTION_RULES Hardening & Concurrency Stress Test", () => {
  it("executes 50 concurrent bids across 3 listings with scheduler running on a test clock, verifying ledger, orders, and listing summaries afterwards", async () => {
    // 1. Seed 3 active listings
    // Listing A: 50 kg, floor 4000, 30 min duration (expires at 10:30)
    const seedA = await seedListingWithStock({
      farmer: farmers[0]!,
      cropName: "Bitter Gourd",
      slug: "bitter-gourd",
      quantityKg: 50,
      initialStockKg: 200,
      floorPricePerKg: 4000,
      minIncrementPerKg: 100,
      durationMinutes: 30,
    });

    // Listing B: 100 kg, floor 3500, 30 min duration (expires at 10:30)
    const seedB = await seedListingWithStock({
      farmer: farmers[1]!,
      cropName: "Pointed Gourd",
      slug: "pointed-gourd",
      quantityKg: 100,
      initialStockKg: 300,
      floorPricePerKg: 3500,
      minIncrementPerKg: 100,
      durationMinutes: 30,
    });

    // Listing C: 80 kg, floor 5000, 120 min duration (expires at 12:00, remains active)
    const seedC = await seedListingWithStock({
      farmer: farmers[2]!,
      cropName: "Yardlong Bean",
      slug: "yardlong-bean",
      quantityKg: 80,
      initialStockKg: 250,
      floorPricePerKg: 5000,
      minIncrementPerKg: 100,
      durationMinutes: 120,
    });

    const listingAId = seedA.listing._id.toString();
    const listingBId = seedB.listing._id.toString();
    const listingCId = seedC.listing._id.toString();

    // 2. Prepare 50 concurrent bids across the 3 listings
    // Listing A: 22 bid attempts (amounts from 3900 [invalid] up to 6000)
    // Listing B: 18 bid attempts (amounts from 3400 [invalid] up to 5500)
    // Listing C: 10 bid attempts (amounts from 4900 [invalid] up to 6200)
    interface BidAttempt {
      listingId: string;
      buyer: PublicUser;
      amountPerKg: number;
    }

    const bidAttempts: BidAttempt[] = [];

    // 22 bids for Listing A
    for (let i = 0; i < 22; i += 1) {
      const buyer = buyers[i % buyers.length]!;
      // Some below floor (3900), some valid increasing amounts, some duplicate amounts to trigger races
      let amount = 4000 + i * 100;
      if (i === 0) amount = 3900; // Below floor -> will be rejected
      if (i === 5) amount = 4300; // Duplicate amount -> race with earlier bid
      if (i === 12) amount = 4800; // Duplicate amount -> race
      bidAttempts.push({ listingId: listingAId, buyer, amountPerKg: amount });
    }

    // 18 bids for Listing B
    for (let i = 0; i < 18; i += 1) {
      const buyer = buyers[(i + 1) % buyers.length]!;
      let amount = 3500 + i * 100;
      if (i === 0) amount = 3400; // Below floor -> rejected
      if (i === 7) amount = 4000; // Duplicate -> race
      bidAttempts.push({ listingId: listingBId, buyer, amountPerKg: amount });
    }

    // 10 bids for Listing C
    for (let i = 0; i < 10; i += 1) {
      const buyer = buyers[(i + 2) % buyers.length]!;
      let amount = 5000 + i * 100;
      if (i === 0) amount = 4900; // Below floor -> rejected
      if (i === 3) amount = 5200; // Duplicate -> race
      bidAttempts.push({ listingId: listingCId, buyer, amountPerKg: amount });
    }

    expect(bidAttempts).toHaveLength(50);

    // 3. Fire all 50 bids concurrently
    const bidResults = await Promise.allSettled(
      bidAttempts.map((attempt) =>
        placeBid(attempt.buyer, attempt.listingId, {
          amountPerKg: attempt.amountPerKg,
        }),
      ),
    );

    // Verify all attempts either fulfilled or rejected with a valid domain error
    for (const result of bidResults) {
      if (result.status === "rejected") {
        expect(["BID_TOO_LOW", "CONFLICT"]).toContain(result.reason.code);
      }
    }

    const acceptedA = await Bid.find({ listingId: listingAId }).sort({ seq: 1 });
    const acceptedB = await Bid.find({ listingId: listingBId }).sort({ seq: 1 });
    const acceptedC = await Bid.find({ listingId: listingCId }).sort({ seq: 1 });

    const totalAccepted = acceptedA.length + acceptedB.length + acceptedC.length;
    const fulfilledCount = bidResults.filter((r) => r.status === "fulfilled").length;
    expect(fulfilledCount).toBe(totalAccepted);
    expect(totalAccepted).toBeGreaterThan(0);

    // 4. Advance clock past expiration of Listings A and B (to 10:35, where endsAt was 10:30)
    // Note: anti-sniping may have pushed endsAt for A and B. Let's inspect max endsAt.
    const dbListingA = await Listing.findById(listingAId);
    const dbListingB = await Listing.findById(listingBId);
    const dbListingC = await Listing.findById(listingCId);

    expect(dbListingA).toBeDefined();
    expect(dbListingB).toBeDefined();
    expect(dbListingC).toBeDefined();

    const maxEndsAtAB = Math.max(
      dbListingA!.endsAt.getTime(),
      dbListingB!.endsAt.getTime(),
    );

    // Set clock to 10 seconds past the latest endsAt for A and B, but well before C's endsAt (12:00)
    testClock.setTime(new Date(maxEndsAtAB + 10 * 1000));

    // 5. Run scheduler closing pass
    const summary = await closeDueListings({ asOf: testClock.now(), clock: testClock });
    expect(summary.found).toBe(2);
    expect(summary.closed).toBe(2);
    expect(summary.failed).toBe(0);

    // 6. Detailed Post-Condition & Ledger Verification
    // --- LISTING A VERIFICATION ---
    const closedA = await Listing.findById(listingAId);
    expect(closedA?.status).toBe(ListingStatus.SOLD);
    expect(closedA?.closedAt).toBeDefined();

    // Listing summary matches accepted bids
    expect(closedA?.bidCount).toBe(acceptedA.length);
    const maxBidA = Math.max(...acceptedA.map((b) => b.amountPerKg));
    expect(closedA?.currentBidPerKg).toBe(maxBidA);

    // Sequence invariants: 1..N with zero gaps
    const seqsA = acceptedA.map((b) => b.seq);
    expect(seqsA).toEqual(Array.from({ length: acceptedA.length }, (_, i) => i + 1));

    // Exactly one Order created for Listing A
    const ordersA = await Order.find({ listingId: listingAId });
    expect(ordersA).toHaveLength(1);
    const orderA = ordersA[0]!;
    expect(orderA.pricePerKg).toBe(maxBidA);
    expect(orderA.quantityKg).toBe(seedA.listing.quantityKg);

    const expectedSubtotalA = calculateSubtotal(maxBidA, seedA.listing.quantityKg);
    const feeNetA = calculateFeeAndNet(expectedSubtotalA, env.PLATFORM_FEE_BPS);
    expect(orderA.subtotal).toBe(expectedSubtotalA);
    expect(orderA.platformFee).toBe(feeNetA.platformFee);
    expect(orderA.farmerNet).toBe(feeNetA.farmerNet);
    expect(orderA.subtotal - orderA.platformFee).toBe(orderA.farmerNet);

    // Winning bid marked WON, others LOST
    const wonBidsA = await Bid.find({ listingId: listingAId, status: BidStatus.WON });
    const lostBidsA = await Bid.find({ listingId: listingAId, status: BidStatus.LOST });
    expect(wonBidsA).toHaveLength(1);
    expect(wonBidsA[0]?.amountPerKg).toBe(maxBidA);
    expect(lostBidsA).toHaveLength(acceptedA.length - 1);

    // Inventory ledger for Farmer 1:
    // Started with 200 kg. 50 kg was listed, then sold.
    // Available: 150 kg, Listed: 0 kg, Sold: 50 kg. Total: 200 kg.
    const invA = await InventoryItem.findOne({
      farmerId: farmers[0]!.id,
      cropId: seedA.crop._id,
    });
    expect(invA?.availableKg).toBe(150);
    expect(invA?.listedKg).toBe(0);
    expect(invA?.soldKg).toBe(50);
    expect(invA!.availableKg + invA!.listedKg + invA!.soldKg).toBe(seedA.initialStockKg);

    const movementsA = await StockMovement.find({
      farmerId: farmers[0]!.id,
      cropId: seedA.crop._id,
    }).sort({ createdAt: 1 });
    expect(movementsA.map((m) => m.type)).toEqual(["ADD", "LIST", "SELL"]);

    // --- LISTING B VERIFICATION ---
    const closedB = await Listing.findById(listingBId);
    expect(closedB?.status).toBe(ListingStatus.SOLD);
    expect(closedB?.bidCount).toBe(acceptedB.length);
    const maxBidB = Math.max(...acceptedB.map((b) => b.amountPerKg));
    expect(closedB?.currentBidPerKg).toBe(maxBidB);

    const ordersB = await Order.find({ listingId: listingBId });
    expect(ordersB).toHaveLength(1);
    expect(ordersB[0]?.pricePerKg).toBe(maxBidB);
    expect(ordersB[0]?.quantityKg).toBe(seedB.listing.quantityKg);

    const invB = await InventoryItem.findOne({
      farmerId: farmers[1]!.id,
      cropId: seedB.crop._id,
    });
    expect(invB?.availableKg).toBe(200); // 300 - 100
    expect(invB?.listedKg).toBe(0);
    expect(invB?.soldKg).toBe(100);
    expect(invB!.availableKg + invB!.listedKg + invB!.soldKg).toBe(seedB.initialStockKg);

    const movementsB = await StockMovement.find({
      farmerId: farmers[1]!.id,
      cropId: seedB.crop._id,
    }).sort({ createdAt: 1 });
    expect(movementsB.map((m) => m.type)).toEqual(["ADD", "LIST", "SELL"]);

    // --- LISTING C VERIFICATION (STILL ACTIVE) ---
    const activeC = await Listing.findById(listingCId);
    expect(activeC?.status).toBe(ListingStatus.ACTIVE);
    expect(activeC?.closedAt).toBeUndefined();
    expect(activeC?.bidCount).toBe(acceptedC.length);
    const maxBidC = Math.max(...acceptedC.map((b) => b.amountPerKg));
    expect(activeC?.currentBidPerKg).toBe(maxBidC);

    const ordersC = await Order.find({ listingId: listingCId });
    expect(ordersC).toHaveLength(0); // Zero orders because still active

    const invC = await InventoryItem.findOne({
      farmerId: farmers[2]!.id,
      cropId: seedC.crop._id,
    });
    expect(invC?.availableKg).toBe(170); // 250 - 80
    expect(invC?.listedKg).toBe(80);
    expect(invC?.soldKg).toBe(0);
    expect(invC!.availableKg + invC!.listedKg + invC!.soldKg).toBe(seedC.initialStockKg);

    const movementsC = await StockMovement.find({
      farmerId: farmers[2]!.id,
      cropId: seedC.crop._id,
    }).sort({ createdAt: 1 });
    expect(movementsC.map((m) => m.type)).toEqual(["ADD", "LIST"]);
  });

  it("handles concurrent bids alongside an expired unsold listing, correctly releasing unsold stock back to available inventory without creating an order", async () => {
    // Listing 1 has bids and sells
    const seedActive = await seedListingWithStock({
      farmer: farmers[0]!,
      cropName: "Bitter Gourd",
      slug: "bitter-gourd-unsold-test",
      quantityKg: 40,
      initialStockKg: 100,
      floorPricePerKg: 4000,
      minIncrementPerKg: 100,
      durationMinutes: 10,
    });

    // Listing 2 receives zero bids and expires unsold
    const seedUnsold = await seedListingWithStock({
      farmer: farmers[1]!,
      cropName: "Pointed Gourd",
      slug: "pointed-gourd-unsold-test",
      quantityKg: 60,
      initialStockKg: 150,
      floorPricePerKg: 3500,
      minIncrementPerKg: 100,
      durationMinutes: 10,
    });

    // Place bids on Listing 1 only
    await placeBid(buyers[0]!, seedActive.listing._id.toString(), { amountPerKg: 4200 });
    await placeBid(buyers[1]!, seedActive.listing._id.toString(), { amountPerKg: 4400 });
    await placeBid(buyers[2]!, seedActive.listing._id.toString(), { amountPerKg: 4600 });

    // Advance clock past expiration (15 minutes)
    testClock.setTime(new Date(testClock.now().getTime() + 15 * 60 * 1000));

    // Run scheduler closing
    const summary = await closeDueListings({ asOf: testClock.now(), clock: testClock });
    expect(summary.closed).toBe(2);

    // Verify Unsold listing
    const closedUnsold = await Listing.findById(seedUnsold.listing._id);
    expect(closedUnsold?.status).toBe(ListingStatus.EXPIRED_UNSOLD);
    expect(closedUnsold?.bidCount).toBe(0);

    // No order created for unsold listing
    const unsoldOrders = await Order.find({ listingId: seedUnsold.listing._id });
    expect(unsoldOrders).toHaveLength(0);

    // Stock released back to available inventory: available 150, listed 0, sold 0
    const invUnsold = await InventoryItem.findOne({
      farmerId: farmers[1]!.id,
      cropId: seedUnsold.crop._id,
    });
    expect(invUnsold?.availableKg).toBe(150);
    expect(invUnsold?.listedKg).toBe(0);
    expect(invUnsold?.soldKg).toBe(0);

    const movementsUnsold = await StockMovement.find({
      farmerId: farmers[1]!.id,
      cropId: seedUnsold.crop._id,
    }).sort({ createdAt: 1 });
    expect(movementsUnsold.map((m) => m.type)).toEqual(["ADD", "LIST", "RELEASE"]);
  });
});
