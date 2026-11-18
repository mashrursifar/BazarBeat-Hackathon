import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CropGrade,
  ListingStatus,
  NotificationType,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

const farmerId = new ObjectId().toString();
const buyerAId = new ObjectId().toString();
const buyerBId = new ObjectId().toString();
const cropId = new ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmer: {
    id: farmerId,
    role: UserRole.FARMER,
    name: "Farmer Salam",
    division: "dhaka",
    district: "gazipur",
    language: "en",
  },
  buyerA: {
    id: buyerAId,
    role: UserRole.BUYER,
    name: "Buyer Alice",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  buyerB: {
    id: buyerBId,
    role: UserRole.BUYER,
    name: "Buyer Bob",
    division: "chattogram",
    district: "chattogram",
    language: "en",
  },
};

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { Crop } from "../crops/crop.model.js";
import { Listing } from "../listings/listing.model.js";
import { Notification } from "../notifications/notification.model.js";
import { runEndingSoonJob } from "../notifications/ending-soon.job.js";
import { WatchlistItem } from "./watchlist.model.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

describe("Watchlist Backend (Task 8.5)", () => {
  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(mongoReplSet.getUri());
    await Promise.all([
      WatchlistItem.init(),
      Listing.init(),
      Crop.init(),
      Notification.init(),
    ]);

    authenticateAccessTokenMock.mockImplementation(async (token) => {
      const user = sessionUsers[token];
      if (user === undefined) throw new Error("Unexpected test access token");
      return user;
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoReplSet) {
      await mongoReplSet.stop();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      WatchlistItem.deleteMany({}),
      Listing.deleteMany({}),
      Crop.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    testClock = new TestClock(new Date("2026-11-18T10:00:00.000Z"));
    setClock(testClock);

    eventEmitter = new DomainEventEmitter();
    setDomainEventEmitter(eventEmitter);

    await Crop.create({
      _id: new ObjectId(cropId),
      slug: "potato",
      nameEn: "Potato",
      nameBn: "আলু",
      unit: "KG",
      minLotKg: 50,
      maxLotKg: 2000,
      shelfLifeHours: 120,
      gradeGuide: { A: "Firm dry", B: "Slight split", C: "Small cut" },
      minIncrementPerKg: 100,
      imageUrl: "https://example.com/potato.jpg",
      isActive: true,
    });
  });

  afterEach(() => {
    resetDomainEventEmitter();
    resetClock();
  });

  async function createListing(overrides: Record<string, unknown> = {}): Promise<InstanceType<typeof Listing>> {
    const now = testClock.now();
    const endsAt = new Date(now.getTime() + 2 * 3600 * 1000);

    return Listing.create({
      farmerId: new ObjectId(farmerId),
      cropId: new ObjectId(cropId),
      quantityKg: 500,
      images: [{ url: "/uploads/p1.jpg", width: 800, height: 600 }],
      aiAssessment: {
        cropMatch: true,
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Uniform color and size"],
        reasons: ["Uniform color and size"],
        suggestedGrade: CropGrade.A,
        modelVersion: "mock-v1",
        provider: "mock",
        degraded: false,
        assessedAt: now,
      },
      aiPriceGuidance: {
        confidence: 0.9,
        lowPerKg: 3000,
        expectedPerKg: 3500,
        highPerKg: 4000,
        trend: "UP",
        modelVersion: "mock-price-1.0",
        provider: "mock",
        degraded: false,
        generatedAt: now,
        suggestedFloorPerKg: 3200,
      },
      floorPricePerKg: 3200,
      minIncrementPerKg: 100,
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      currentBidPerKg: undefined,
      bidCount: 0,
      location: {
        division: "Dhaka",
        district: "Gazipur",
        upazila: "Sreepur",
      },
      ...overrides,
    });
  }

  describe("POST /api/v1/watchlist", () => {
    it("rejects non-buyer roles with 403 FORBIDDEN", async () => {
      const listing = await createListing();
      const res = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=farmer"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: listing._id.toString() });

      expect(res.status).toBe(403);
    });

    it("allows a buyer to add an ACTIVE listing idempotently", async () => {
      const listing = await createListing();
      const listingIdStr = listing._id.toString();

      // First add
      const res1 = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: listingIdStr });

      expect(res1.status).toBe(200);
      expect(res1.body.data).toEqual({
        success: true,
        listingId: listingIdStr,
        isWatched: true,
      });

      // Second add: idempotent, does not fail or duplicate
      const res2 = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: listingIdStr });

      expect(res2.status).toBe(200);
      expect(res2.body.data).toEqual({
        success: true,
        listingId: listingIdStr,
        isWatched: true,
      });

      const count = await WatchlistItem.countDocuments({
        userId: new ObjectId(buyerAId),
        listingId: new ObjectId(listingIdStr),
      });
      expect(count).toBe(1);
    });

    it("rejects adding a non-active listing (e.g. DRAFT or SOLD) with 400 LISTING_NOT_ACTIVE", async () => {
      const soldListing = await createListing({ status: ListingStatus.SOLD });
      const resSold = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: soldListing._id.toString() });

      expect(resSold.status).toBe(400);
      expect(resSold.body.error.code).toBe("LISTING_NOT_ACTIVE");

      const draftListing = await createListing({ status: ListingStatus.DRAFT });
      const resDraft = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: draftListing._id.toString() });

      expect(resDraft.status).toBe(400);
      expect(resDraft.body.error.code).toBe("LISTING_NOT_ACTIVE");
    });

    it("rejects nonexistent listing with 404 NOT_FOUND", async () => {
      const res = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: new ObjectId().toString() });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("enforces 50 item cap with 400 WATCHLIST_CAP_EXCEEDED", async () => {
      // Pre-seed 50 items for buyerA
      const bulkItems = [];
      for (let i = 0; i < 50; i++) {
        bulkItems.push({
          userId: new ObjectId(buyerAId),
          listingId: new ObjectId(),
          createdAt: testClock.now(),
          updatedAt: testClock.now(),
        });
      }
      await WatchlistItem.insertMany(bulkItems);

      const listing = await createListing();
      const res = await request(app)
        .post("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1")
        .send({ listingId: listing._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("WATCHLIST_CAP_EXCEEDED");
    });
  });

  describe("DELETE /api/v1/watchlist/:listingId", () => {
    it("removes a listing idempotently", async () => {
      const listing = await createListing();
      const listingIdStr = listing._id.toString();

      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: new ObjectId(listingIdStr),
        createdAt: testClock.now(),
        updatedAt: testClock.now(),
      });

      // Remove existing
      const res1 = await request(app)
        .delete(`/api/v1/watchlist/${listingIdStr}`)
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1");

      expect(res1.status).toBe(200);
      expect(res1.body.data).toEqual({
        success: true,
        listingId: listingIdStr,
        isWatched: false,
      });

      // Remove again: idempotent
      const res2 = await request(app)
        .delete(`/api/v1/watchlist/${listingIdStr}`)
        .set("Cookie", ["accessToken=buyerA"])
        .set("X-CSRF-Protection", "1");

      expect(res2.status).toBe(200);
      expect(res2.body.data.isWatched).toBe(false);

      const exists = await WatchlistItem.exists({
        userId: new ObjectId(buyerAId),
        listingId: new ObjectId(listingIdStr),
      });
      expect(exists).toBeNull();
    });
  });

  describe("GET /api/v1/watchlist", () => {
    it("returns paginated buyer listing cards with isWatched: true, sorted newest saved first", async () => {
      const listing1 = await createListing({ quantityKg: 100 });
      const listing2 = await createListing({ quantityKg: 200 });

      testClock.advanceBy(1000);
      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: listing1._id,
        createdAt: testClock.now(),
        updatedAt: testClock.now(),
      });

      testClock.advanceBy(1000);
      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: listing2._id,
        createdAt: testClock.now(),
        updatedAt: testClock.now(),
      });

      const res = await request(app)
        .get("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // Newest saved first: listing2 then listing1
      expect(res.body.data[0].id).toBe(listing2._id.toString());
      expect(res.body.data[0].isWatched).toBe(true);
      expect(res.body.data[1].id).toBe(listing1._id.toString());
      expect(res.body.data[1].isWatched).toBe(true);
      expect(res.body.meta.total).toBe(2);

      // Buyer B has empty watchlist
      const resB = await request(app)
        .get("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerB"]);

      expect(resB.status).toBe(200);
      expect(resB.body.data).toEqual([]);
      expect(resB.body.meta.total).toBe(0);
    });

    it("displays ended listings (read-only) with current status in watchlist", async () => {
      const endedListing = await createListing({ status: ListingStatus.SOLD });
      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: endedListing._id,
        createdAt: testClock.now(),
        updatedAt: testClock.now(),
      });

      const res = await request(app)
        .get("/api/v1/watchlist")
        .set("Cookie", ["accessToken=buyerA"]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe(ListingStatus.SOLD);
      expect(res.body.data[0].isWatched).toBe(true);
    });
  });

  describe("Visibility Extension & isWatched Flag (Decision D-34)", () => {
    it("allows a buyer to open an ended listing if it is in their watchlist (read-only)", async () => {
      const endedListing = await createListing({ status: ListingStatus.SOLD });
      const listingIdStr = endedListing._id.toString();

      // Buyer B did not bid and did not watch -> 404 NOT_FOUND
      const resUnwatched = await request(app)
        .get(`/api/v1/listings/${listingIdStr}`)
        .set("Cookie", ["accessToken=buyerB"]);

      expect(resUnwatched.status).toBe(404);

      // Buyer A saved to watchlist -> 200 OK with isWatched: true
      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: endedListing._id,
        createdAt: testClock.now(),
        updatedAt: testClock.now(),
      });

      const resWatched = await request(app)
        .get(`/api/v1/listings/${listingIdStr}`)
        .set("Cookie", ["accessToken=buyerA"]);

      expect(resWatched.status).toBe(200);
      expect(resWatched.body.data.id).toBe(listingIdStr);
      expect(resWatched.body.data.isWatched).toBe(true);
      expect(resWatched.body.data.status).toBe(ListingStatus.SOLD);
    });

    it("accurately annotates isWatched on marketplace cards using a single batch lookup", async () => {
      const l1 = await createListing();
      const l2 = await createListing();

      // Buyer A watches l1 only
      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: l1._id,
        createdAt: testClock.now(),
        updatedAt: testClock.now(),
      });

      const resA = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", ["accessToken=buyerA"]);

      expect(resA.status).toBe(200);
      const card1A = resA.body.data.find((c: { id: string }) => c.id === l1._id.toString());
      const card2A = resA.body.data.find((c: { id: string }) => c.id === l2._id.toString());
      expect(card1A.isWatched).toBe(true);
      expect(card2A.isWatched).toBe(false);

      // Buyer B watches neither
      const resB = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", ["accessToken=buyerB"]);

      expect(resB.status).toBe(200);
      for (const card of resB.body.data) {
        expect(card.isWatched).toBe(false);
      }
    });

    it("notifies watchers when ending-soon job runs even if they have not bid", async () => {
      // Create listing ending in 10 minutes (within 15 min window)
      const now = testClock.now();
      const endsAt = new Date(now.getTime() + 10 * 60 * 1000);
      const endingSoonListing = await createListing({ endsAt, originalEndsAt: endsAt });

      // Buyer A watches the listing (no bids placed)
      await WatchlistItem.create({
        userId: new ObjectId(buyerAId),
        listingId: endingSoonListing._id,
        createdAt: now,
        updatedAt: now,
      });

      // Run ending soon scheduler pass
      const summary = await runEndingSoonJob({ clock: testClock, isDemoMode: false });
      expect(summary.foundListings).toBe(1);

      // Buyer A should receive ENDING_SOON notification
      const buyerANotifs = await Notification.find({ userId: new ObjectId(buyerAId) });
      expect(buyerANotifs).toHaveLength(1);
      expect(buyerANotifs[0]!.type).toBe(NotificationType.ENDING_SOON);
      expect(buyerANotifs[0]!.params).toMatchObject({
        listingId: endingSoonListing._id.toString(),
        cropSlug: "potato",
      });
    });
  });
});
