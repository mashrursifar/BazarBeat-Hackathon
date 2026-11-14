import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AUCTION_TIMING,
  type AuctionExtendedEventPayload,
  type BidPlacedEventPayload,
  BidStatus,
  CropGrade,
  DomainEventName,
  ListingStatus,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { env } from "../../config/env.js";
import { Listing } from "../listings/listing.model.js";
import { User } from "../users/user.model.js";
import { Bid } from "./bid.model.js";
import { IdempotencyRecord } from "./idempotency-record.model.js";
import { getListingBids, placeBid } from "./bid.service.js";

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

const buyerThree: PublicUser = {
  id: new Types.ObjectId().toString(),
  role: UserRole.BUYER,
  name: "Buyer Three",
  division: "Khulna",
  district: "Khulna",
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
    User.init(),
    IdempotencyRecord.init(),
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
    User.deleteMany({}),
    IdempotencyRecord.deleteMany({}),
  ]);
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

async function createSampleListing(
  overrides: Partial<Record<string, unknown>> = {},
): Promise<InstanceType<typeof Listing>> {
  const now = testClock.now();
  const endsAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour duration

  const listing = await Listing.create({
    farmerId: farmerUser.id,
    cropId: new Types.ObjectId(),
    quantityKg: 50,
    images: [{ url: "/sample.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.95, B: 0.05, C: 0 },
      qualityNotes: ["Uniform dry skin"],
      cropMatch: true,
      modelVersion: "mock-1.0",
      provider: "mock",
      degraded: false,
      assessedAt: now,
      imageHashes: ["hash-1"],
    },
    aiPriceGuidance: {
      lowPerKg: 4000,
      expectedPerKg: 5000,
      highPerKg: 6000,
      trend: "UP",
      confidence: 0.9,
      explanation: ["Strong market demand"],
      modelVersion: "mock-price-1.0",
      provider: "mock",
      degraded: false,
      generatedAt: now,
      suggestedFloorPerKg: 4500,
    },
    floorPricePerKg: 5000,
    minIncrementPerKg: 100,
    startsAt: now,
    endsAt,
    originalEndsAt: endsAt,
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    bidCount: 0,
    location: { division: "Rajshahi", district: "Bogra" },
    ...overrides,
  });

  return listing;
}

describe("Bid Placement Service (AUCTION_RULES §4, §5, §6)", () => {
  describe("AUCTION_RULES §4 Rule Enforcement", () => {
    it("Rule 1: rejects non-buyer actors with 403 FORBIDDEN", async () => {
      const listing = await createSampleListing();

      await expect(
        placeBid(farmerUser, listing._id.toString(), { amountPerKg: 5500 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 403,
          code: "FORBIDDEN",
        }),
      );
    });

    it("Rule 1: rejects buyer bidding on their own listing with 403 OWN_LISTING", async () => {
      // Buyer is also the farmer of the listing
      const listing = await createSampleListing({
        farmerId: buyerOne.id,
      });

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5500 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 403,
          code: "OWN_LISTING",
        }),
      );
    });

    it("Rule 2: rejects bids when listing status is not ACTIVE with 400 AUCTION_CLOSED", async () => {
      const nonActiveStatuses = [
        ListingStatus.DRAFT,
        ListingStatus.SOLD,
        ListingStatus.EXPIRED_UNSOLD,
        ListingStatus.CANCELLED,
      ];

      for (const status of nonActiveStatuses) {
        const listing = await createSampleListing({ status });

        await expect(
          placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5500 }),
        ).rejects.toThrowError(
          expect.objectContaining({
            statusCode: 400,
            code: "AUCTION_CLOSED",
          }),
        );
      }
    });

    it("Rule 2: rejects bids when server time is past endsAt with 400 AUCTION_CLOSED", async () => {
      const listing = await createSampleListing();
      // Advance clock past endsAt
      testClock.advanceTo(new Date(listing.endsAt.getTime() + 1000));

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5500 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "AUCTION_CLOSED",
        }),
      );
    });

    it("Rule 2 exact boundary: rejects bid placed exactly at endsAt with 400 AUCTION_CLOSED", async () => {
      const listing = await createSampleListing();
      // Set clock exactly to listing.endsAt
      testClock.setTime(listing.endsAt);

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5500 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "AUCTION_CLOSED",
        }),
      );
    });

    it("Rule 3: rejects opening bid below floor price with 400 BID_TOO_LOW", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000 });

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 4999 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "BID_TOO_LOW",
        }),
      );
    });

    it("Rule 3: accepts opening bid equal to or greater than floor price", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000 });

      const result = await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });
      expect(result.bid.amountPerKg).toBe(5000);
      expect(result.seq).toBe(1);

      const updated = await Listing.findById(listing._id);
      expect(updated?.currentBidPerKg).toBe(5000);
      expect(updated?.bidCount).toBe(1);
      expect(updated?.currentBidderId?.toString()).toBe(buyerOne.id);
    });

    it("Rule 4: rejects subsequent bids below current bid + minIncrement with 400 BID_TOO_LOW", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });
      await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });

      // Needs at least 5100
      await expect(
        placeBid(buyerTwo, listing._id.toString(), { amountPerKg: 5099 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "BID_TOO_LOW",
        }),
      );
    });

    it("Rule 4: accepts subsequent bids meeting current bid + minIncrement", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });
      await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });

      const second = await placeBid(buyerTwo, listing._id.toString(), { amountPerKg: 5100 });
      expect(second.bid.amountPerKg).toBe(5100);
      expect(second.seq).toBe(2);

      const updated = await Listing.findById(listing._id);
      expect(updated?.currentBidPerKg).toBe(5100);
      expect(updated?.bidCount).toBe(2);
      expect(updated?.currentBidderId?.toString()).toBe(buyerTwo.id);
    });

    it("Rule 5: rejects zero, negative, or fractional poisha amounts with 400 VALIDATION_ERROR", async () => {
      const listing = await createSampleListing();

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 0 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }),
      );

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: -500 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }),
      );

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000.5 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }),
      );
    });

    it("Rule 6: prevents highest bidder from outbidding self with 409 CONFLICT", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000 });
      await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });

      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5200 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          code: "CONFLICT",
        }),
      );
    });
  });

  describe("AUCTION_RULES §6 Anti-Sniping Extensions & Events", () => {
    it("does not extend when bid is placed outside the anti-sniping window", async () => {
      const listing = await createSampleListing();
      const extendedEvents: AuctionExtendedEventPayload[] = [];
      eventEmitter.on(DomainEventName.AUCTION_EXTENDED, (payload) => {
        extendedEvents.push(payload);
      });

      // 1 hour remaining; trigger window is 2 minutes
      const result = await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });

      expect(result.wasExtended).toBe(false);
      expect(extendedEvents).toHaveLength(0);

      const updated = await Listing.findById(listing._id);
      expect(updated?.extensionCount).toBe(0);
      expect(updated?.endsAt.getTime()).toBe(listing.endsAt.getTime());
    });

    it("atomically extends endsAt and emits auction.extended when remaining time is under 2 minutes", async () => {
      const listing = await createSampleListing();
      const extendedEvents: AuctionExtendedEventPayload[] = [];
      const placedEvents: BidPlacedEventPayload[] = [];
      eventEmitter.on(DomainEventName.AUCTION_EXTENDED, (payload) => {
        extendedEvents.push(payload);
      });
      eventEmitter.on(DomainEventName.BID_PLACED, (payload) => {
        placedEvents.push(payload);
      });

      // Advance clock so remaining time is 90 seconds (< 120s window)
      const bidInstant = new Date(listing.endsAt.getTime() - 90 * 1000);
      testClock.setTime(bidInstant);

      const result = await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });

      expect(result.wasExtended).toBe(true);
      expect(result.newExtensionCount).toBe(1);

      const expectedNewEndsAt = new Date(
        bidInstant.getTime() + AUCTION_TIMING.ANTI_SNIPING_EXTENSION_DURATION_MS,
      );
      expect(result.newEndsAt?.getTime()).toBe(expectedNewEndsAt.getTime());

      // Confirm in DB
      const updated = await Listing.findById(listing._id);
      expect(updated?.extensionCount).toBe(1);
      expect(updated?.endsAt.getTime()).toBe(expectedNewEndsAt.getTime());

      // Events
      expect(extendedEvents).toHaveLength(1);
      expect(extendedEvents[0]).toMatchObject({
        listingId: listing._id.toString(),
        endsAt: expectedNewEndsAt.toISOString(),
        extensionCount: 1,
        extendedAt: bidInstant.toISOString(),
      });

      expect(placedEvents).toHaveLength(1);
      expect(placedEvents[0]).toMatchObject({
        listingId: listing._id.toString(),
        amountPerKg: 5000,
        bidCount: 1,
        bidderLabel: "Buyer #1",
      });
    });

    it("caps extensions at 5: sixth extension does NOT apply", async () => {
      const listing = await createSampleListing({ extensionCount: 5 });
      const extendedEvents: AuctionExtendedEventPayload[] = [];
      eventEmitter.on(DomainEventName.AUCTION_EXTENDED, (payload) => {
        extendedEvents.push(payload);
      });

      // Advance clock to under 2 minutes remaining
      const bidInstant = new Date(listing.endsAt.getTime() - 60 * 1000);
      testClock.setTime(bidInstant);

      const result = await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });

      // Bid is accepted, but extension is NOT applied
      expect(result.bid.amountPerKg).toBe(5000);
      expect(result.wasExtended).toBe(false);
      expect(extendedEvents).toHaveLength(0);

      const updated = await Listing.findById(listing._id);
      expect(updated?.extensionCount).toBe(5);
      expect(updated?.endsAt.getTime()).toBe(listing.endsAt.getTime());
    });

    it("scales windows down proportionally in demo mode (15 seconds trigger, 15 seconds extension)", async () => {
      const originalDemoMode = env.DEMO_MODE;
      try {
        (env as { DEMO_MODE: boolean }).DEMO_MODE = true;
        const listing = await createSampleListing();
        const extendedEvents: AuctionExtendedEventPayload[] = [];
        eventEmitter.on(DomainEventName.AUCTION_EXTENDED, (payload) => {
          extendedEvents.push(payload);
        });

        // 1. Outside demo trigger window (20 seconds before endsAt): does NOT extend
        testClock.setTime(new Date(listing.endsAt.getTime() - 20 * 1000));
        const res1 = await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 });
        expect(res1.wasExtended).toBe(false);
        expect(extendedEvents).toHaveLength(0);

        // 2. Inside demo trigger window (10 seconds before endsAt < 15s): extends by 15s
        const bidInstant = new Date(listing.endsAt.getTime() - 10 * 1000);
        testClock.setTime(bidInstant);
        const res2 = await placeBid(buyerTwo, listing._id.toString(), { amountPerKg: 5200 });
        expect(res2.wasExtended).toBe(true);
        expect(res2.newExtensionCount).toBe(1);

        const expectedNewEndsAt = new Date(
          bidInstant.getTime() + AUCTION_TIMING.DEMO_ANTI_SNIPING_EXTENSION_DURATION_MS,
        );
        expect(res2.newEndsAt?.getTime()).toBe(expectedNewEndsAt.getTime());
        expect(extendedEvents).toHaveLength(1);
      } finally {
        (env as { DEMO_MODE: boolean }).DEMO_MODE = originalDemoMode;
      }
    });
  });

  describe("Bid Model Properties and Invariants", () => {
    it("persists append-only bid with seq, totalAmount, placedAt, and unique (listingId, seq)", async () => {
      const listing = await createSampleListing({ quantityKg: 25.5, floorPricePerKg: 4000 });

      const result = await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 4000 });

      expect(result.bid.seq).toBe(1);
      expect(result.bid.totalAmount).toBe(Math.round(4000 * 25.5)); // 102,000 poisha
      expect(result.bid.status).toBe(BidStatus.ACCEPTED);

      const storedBid = await Bid.findById(result.bid.id);
      expect(storedBid).not.toBeNull();
      expect(storedBid?.seq).toBe(1);

      // Attempting to delete a bid must throw (append-only)
      await expect(storedBid?.deleteOne()).rejects.toThrow("Bids are append-only and cannot be deleted");
    });

    it("handles idempotency key safe retry", async () => {
      const listing = await createSampleListing();
      const idempotencyKey = "client-tx-1001";

      const first = await placeBid(buyerOne, listing._id.toString(), {
        amountPerKg: 5000,
        idempotencyKey,
      });

      const retry = await placeBid(buyerOne, listing._id.toString(), {
        amountPerKg: 5000,
        idempotencyKey,
      });

      expect(retry.bid.id).toBe(first.bid.id);
      expect(retry.bid.seq).toBe(first.bid.seq);
      expect(retry.isReplay).toBe(true);

      const storedRecord = await IdempotencyRecord.findOne({
        key: idempotencyKey,
        userId: buyerOne.id,
      });
      expect(storedRecord).toBeDefined();
      expect(storedRecord?.listingId.toString()).toBe(listing._id.toString());
      expect(storedRecord?.bidId.toString()).toBe(first.bid.id);

      const allBids = await Bid.find({ listingId: listing._id });
      expect(allBids).toHaveLength(1);
    });

    it("returns anonymized bid history with sequential labels", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 4000, minIncrementPerKg: 100 });

      await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 4000 });
      await placeBid(buyerTwo, listing._id.toString(), { amountPerKg: 4200 });
      await placeBid(buyerOne, listing._id.toString(), { amountPerKg: 4400 });

      const history = await getListingBids(listing._id.toString(), buyerOne);

      expect(history).toHaveLength(3);
      const bid0 = history[0];
      const bid1 = history[1];
      const bid2 = history[2];
      expect(bid0).toBeDefined();
      expect(bid1).toBeDefined();
      expect(bid2).toBeDefined();
      if (bid0 && bid1 && bid2) {
        expect(bid0.amountPerKg).toBe(4400);
        expect(bid0.bidderLabel).toBe("Buyer #1");
        expect(bid0.isMyBid).toBe(true);

        expect(bid1.amountPerKg).toBe(4200);
        expect(bid1.bidderLabel).toBe("Buyer #2");
        expect(bid1.isMyBid).toBe(false);

        expect(bid2.amountPerKg).toBe(4000);
        expect(bid2.bidderLabel).toBe("Buyer #1");
        expect(bid2.isMyBid).toBe(true);
      }
    });
  });

  describe("Standalone Mongo Compensation Fallback", () => {
    it("compensates listing update if appending the Bid document fails", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000 });

      // Pre-insert a duplicate bid with seq 1 to trigger duplicate key error on Bid.create in standalone mode
      await Bid.create({
        listingId: listing._id,
        buyerId: buyerTwo.id,
        amountPerKg: 9999,
        totalAmount: 99990,
        seq: 1,
        status: BidStatus.ACCEPTED,
        placedAt: testClock.now(),
      });

      // Now place bid which will fail during Bid insert
      await expect(
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 }),
      ).rejects.toThrow();

      // Verify compensating listing rollback restored state
      const restored = await Listing.findById(listing._id);
      expect(restored?.bidCount).toBe(0);
      expect(restored?.currentBidPerKg).toBeUndefined();
      expect(restored?.currentBidderId).toBeUndefined();
    });
  });

  describe("High Concurrency Parallel Test (20+ concurrent bids)", () => {
    it("AUCTION_RULES §12: exactly two simultaneous valid bids: exactly one wins the ordering, the other is rejected with BID_TOO_LOW", async () => {
      const listing = await createSampleListing({
        floorPricePerKg: 5000,
        minIncrementPerKg: 100,
      });

      // Two different buyers place the exact same opening bid simultaneously
      const [res1, res2] = await Promise.allSettled([
        placeBid(buyerOne, listing._id.toString(), { amountPerKg: 5000 }),
        placeBid(buyerTwo, listing._id.toString(), { amountPerKg: 5000 }),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
      const rejected = [res1, res2].filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedReason).toMatchObject({
        statusCode: 400,
        code: "BID_TOO_LOW",
      });

      const dbListing = await Listing.findById(listing._id);
      expect(dbListing?.bidCount).toBe(1);
      expect(dbListing?.currentBidPerKg).toBe(5000);
      const bids = await Bid.find({ listingId: listing._id });
      expect(bids).toHaveLength(1);
      expect(bids[0]?.seq).toBe(1);
    });

    it("proves highest bid equals maximum valid amount, bidCount equals accepted bids, seq 1..N has no gaps, and amounts are strictly ascending by increment", async () => {
      const minIncrementPerKg = 100;
      const floorPricePerKg = 5000;
      const listing = await createSampleListing({
        floorPricePerKg,
        minIncrementPerKg,
        quantityKg: 20,
      });

      // Create 24 concurrent bids from 4 distinct buyers with varied amounts
      // Some valid high increments, some lower/duplicate amounts
      const buyers: PublicUser[] = [
        buyerOne,
        buyerTwo,
        buyerThree,
        {
          id: new Types.ObjectId().toString(),
          role: UserRole.BUYER,
          name: "Buyer Four",
          division: "Barisal",
          district: "Barisal",
          language: "en",
        },
      ];

      // Amounts ranging from 4900 (invalid, below floor) up to 8000
      const bidAttempts = [
        { buyer: buyers[0], amount: 4900 }, // Invalid below floor
        { buyer: buyers[1], amount: 5000 }, // Valid floor
        { buyer: buyers[2], amount: 5100 },
        { buyer: buyers[3], amount: 5150 },
        { buyer: buyers[0], amount: 5200 },
        { buyer: buyers[1], amount: 5300 },
        { buyer: buyers[2], amount: 5400 },
        { buyer: buyers[3], amount: 5500 },
        { buyer: buyers[0], amount: 5550 },
        { buyer: buyers[1], amount: 5600 },
        { buyer: buyers[2], amount: 5700 },
        { buyer: buyers[3], amount: 5800 },
        { buyer: buyers[0], amount: 5900 },
        { buyer: buyers[1], amount: 6000 },
        { buyer: buyers[2], amount: 6100 },
        { buyer: buyers[3], amount: 6200 },
        { buyer: buyers[0], amount: 6300 },
        { buyer: buyers[1], amount: 6400 },
        { buyer: buyers[2], amount: 6500 },
        { buyer: buyers[3], amount: 6600 },
        { buyer: buyers[0], amount: 6700 },
        { buyer: buyers[1], amount: 6800 },
        { buyer: buyers[2], amount: 6900 },
        { buyer: buyers[3], amount: 7000 },
      ];

      expect(bidAttempts.length).toBeGreaterThanOrEqual(20);

      // Execute all 24 bids concurrently
      const results = await Promise.allSettled(
        bidAttempts.map((attempt) => {
          if (!attempt.buyer) {
            throw new Error("Missing buyer in attempt");
          }
          return placeBid(attempt.buyer, listing._id.toString(), {
            amountPerKg: attempt.amount,
          });
        }),
      );

      // Query database state
      const finalListing = await Listing.findById(listing._id);
      expect(finalListing).not.toBeNull();

      const acceptedBids = await Bid.find({ listingId: listing._id }).sort({ seq: 1 });
      const successfulSettled = results.filter((r) => r.status === "fulfilled");

      // 1. Final bid count equals stored accepted bids
      expect(finalListing?.bidCount).toBe(acceptedBids.length);
      expect(successfulSettled.length).toBe(acceptedBids.length);

      // 2. Final highest bid equals maximum valid amount accepted
      const maxAcceptedAmount = Math.max(...acceptedBids.map((b) => b.amountPerKg));
      expect(finalListing?.currentBidPerKg).toBe(maxAcceptedAmount);
      const lastBid = acceptedBids[acceptedBids.length - 1];
      expect(lastBid).toBeDefined();
      expect(finalListing?.currentBidderId?.toString()).toBe(
        lastBid?.buyerId.toString(),
      );

      // 3. seq values are 1 to N with no gaps
      const expectedSeqs = Array.from({ length: acceptedBids.length }, (_, i) => i + 1);
      const actualSeqs = acceptedBids.map((b) => b.seq);
      expect(actualSeqs).toEqual(expectedSeqs);

      // 4. Every accepted amount is higher than previous by at least minIncrementPerKg
      for (let i = 1; i < acceptedBids.length; i += 1) {
        const prevBid = acceptedBids[i - 1];
        const currBid = acceptedBids[i];
        expect(prevBid).toBeDefined();
        expect(currBid).toBeDefined();
        if (prevBid && currBid) {
          expect(currBid.amountPerKg).toBeGreaterThanOrEqual(
            prevBid.amountPerKg + minIncrementPerKg,
          );
        }
      }

      // 5. Total amount matches quantityKg
      for (const b of acceptedBids) {
        expect(b.totalAmount).toBe(Math.round(b.amountPerKg * listing.quantityKg));
      }
    });
  });
});
