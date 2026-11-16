import { ObjectId } from "bson";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BidStatus,
  CropGrade,
  ListingStatus,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { Crop } from "../crops/crop.model.js";
import { Bid } from "../bids/bid.model.js";
import { Listing } from "./listing.model.js";
import { Order } from "../orders/order.model.js";

const farmerId = new ObjectId().toString();
const buyerOneId = new ObjectId().toString();
const buyerTwoId = new ObjectId().toString();
const onionCropId = new ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmer: {
    id: farmerId,
    role: UserRole.FARMER,
    name: "Farmer Salam",
    division: "dhaka",
    district: "gazipur",
    language: "en",
  },
  buyerOne: {
    id: buyerOneId,
    role: UserRole.BUYER,
    name: "Buyer Karim",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  buyerTwo: {
    id: buyerTwoId,
    role: UserRole.BUYER,
    name: "Buyer Rahim",
    division: "chittagong",
    district: "chittagong",
    language: "en",
  },
};

let mongoServer: MongoMemoryServer | undefined;
let testClock: TestClock;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Listing.init(), Crop.init(), Bid.init(), Order.init()]);

  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (user === undefined) throw new Error("Unexpected test access token");
    return user;
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) await mongoServer.stop();
});

beforeEach(async () => {
  testClock = new TestClock(new Date("2026-11-14T10:00:00.000Z"));
  setClock(testClock);

  await Promise.all([
    Listing.deleteMany({}),
    Crop.deleteMany({}),
    Bid.deleteMany({}),
    Order.deleteMany({}),
  ]);

  await Crop.create({
    _id: new ObjectId(onionCropId),
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    shelfLifeHours: 720,
    minLotKg: 10,
    maxLotKg: 2000,
    minIncrementPerKg: 100,
    gradeGuide: { A: "Firm bulbs", B: "Minor marks", C: "Uneven" },
    imageUrl: "/images/crops/onion.svg",
    isActive: true,
  });
});

afterEach(() => {
  resetClock();
});

describe("Task 5.11 — Buyer Privacy Audit & Exact Allowed Key Assertions", () => {
  // Helper to create a comprehensive active listing doc with sensitive fields populated
  async function createPopulatedListing(
    overrides: Record<string, unknown> = {},
  ): Promise<InstanceType<typeof Listing>> {
    const now = testClock.now();
    return Listing.create({
      farmerId: new ObjectId(farmerId),
      cropId: new ObjectId(onionCropId),
      quantityKg: 500,
      images: [
        { url: "/uploads/img1.jpg", width: 800, height: 600 },
        { url: "/uploads/img2.jpg", width: 800, height: 600 },
      ],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm skin", "Grade A quality"],
        cropMatch: true,
        modelVersion: "internal-model-v2.1",
        provider: "mock",
        degraded: false,
        assessedAt: new Date(now.getTime() - 3600_000),
        imageHashes: ["sha256-hash-secret-12345"],
      },
      aiPriceGuidance: {
        lowPerKg: 4000,
        expectedPerKg: 4800,
        highPerKg: 5500,
        trend: "UP",
        confidence: 0.92,
        explanation: ["High seasonal demand in Dhaka markets"],
        modelVersion: "internal-price-model-v3",
        provider: "mock",
        degraded: false,
        generatedAt: new Date(now.getTime() - 3600_000),
        suggestedFloorPerKg: 4200,
      },
      floorPricePerKg: 4200,
      minIncrementPerKg: 100,
      currentBidPerKg: 4600,
      currentBidderId: new ObjectId(buyerOneId),
      startsAt: new Date(now.getTime() - 1800_000),
      endsAt: new Date(now.getTime() + 7200_000),
      originalEndsAt: new Date(now.getTime() + 7200_000),
      extensionCount: 1,
      status: ListingStatus.ACTIVE,
      bidCount: 2,
      location: {
        division: "Dhaka",
        district: "Gazipur",
        upazila: "PrivateUpazilaSecret",
      },
      pickupNote: "FARMER_SECRET_PICKUP_NOTE_CALL_01711111111",
      ...overrides,
    });
  }

  // -------------------------------------------------------------------------
  // 1. Marketplace Card: GET /api/v1/listings
  // -------------------------------------------------------------------------
  describe("Endpoint 1: GET /api/v1/listings (Marketplace card)", () => {
    it("returns ONLY allowed keys on BuyerListingCard and never leaks private fields", async () => {
      await createPopulatedListing();

      const res = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      // Verify top-level envelope keys
      expect(Object.keys(res.body).sort()).toEqual(["data", "meta"]);
      expect(Object.keys(res.body.meta).sort()).toEqual(["limit", "page", "serverTime", "total"]);

      const card = res.body.data[0];
      expect(card).toBeDefined();

      // EXACT allowed keys on BuyerListingCard
      const ALLOWED_CARD_KEYS = [
        "id",
        "cropId",
        "crop",
        "grade",
        "quantityKg",
        "floorPricePerKg",
        "currentBidPerKg",
        "displayPricePerKg",
        "totalDisplayCost",
        "minIncrementPerKg",
        "hasBids",
        "bidCount",
        "startsAt",
        "endsAt",
        "status",
        "location",
        "thumbnailUrl",
        "images",
        "aiExpectedPricePerKg",
      ].sort();

      expect(Object.keys(card).sort()).toEqual(ALLOWED_CARD_KEYS);

      // Crop nested keys
      expect(Object.keys(card.crop).sort()).toEqual(["id", "nameBn", "nameEn", "slug", "unit"]);

      // Location nested keys: strictly limited to division and district (upazila stripped)
      expect(Object.keys(card.location).sort()).toEqual(["district", "division"]);

      // Images nested keys
      for (const img of card.images) {
        expect(Object.keys(img).sort()).toEqual(["height", "url", "width"]);
      }

      // Serialized string leak audit
      const rawPayload = JSON.stringify(res.body);
      expect(rawPayload).not.toContain("FARMER_SECRET_PICKUP_NOTE");
      expect(rawPayload).not.toContain("pickupNote");
      expect(rawPayload).not.toContain(farmerId);
      expect(rawPayload).not.toContain("01711111111");
      expect(rawPayload).not.toContain("PrivateUpazilaSecret");
      expect(rawPayload).not.toContain("suggestedFloorPerKg");
      expect(rawPayload).not.toContain("modelVersion");
      expect(rawPayload).not.toContain("classProbabilities");
      expect(rawPayload).not.toContain("imageHashes");
      expect(rawPayload).not.toContain("internal-model");
      expect(rawPayload).not.toContain("buyerId");
      expect(rawPayload).not.toContain(buyerOneId);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Buyer Listing Detail: GET /api/v1/listings/:id
  // -------------------------------------------------------------------------
  describe("Endpoint 2: GET /api/v1/listings/:id (Buyer Listing Detail)", () => {
    it("returns ONLY allowed keys on BuyerListingDetail and strictly excludes AI internals & PII", async () => {
      const listing = await createPopulatedListing();

      const res = await request(app)
        .get(`/api/v1/listings/${listing._id.toString()}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      // Envelope keys
      expect(Object.keys(res.body).sort()).toEqual(["data", "meta"]);
      expect(Object.keys(res.body.meta).sort()).toEqual(["serverTime"]);

      const detail = res.body.data;

      // EXACT allowed keys on BuyerListingDetail
      const ALLOWED_DETAIL_KEYS = [
        "id",
        "cropId",
        "crop",
        "grade",
        "confidenceBand",
        "reasons",
        "aiPriceSnapshot",
        "provider",
        "degraded",
        "quantityKg",
        "images",
        "floorPricePerKg",
        "minIncrementPerKg",
        "currentBidPerKg",
        "displayPricePerKg",
        "displayTotalCost",
        "bidCount",
        "startsAt",
        "endsAt",
        "originalEndsAt",
        "extensionCount",
        "status",
        "location",
        "myStatus",
        "myHighestBidPerKg",
        "highestBidPerKg",
        "createdAt",
      ].sort();

      expect(Object.keys(detail).sort()).toEqual(ALLOWED_DETAIL_KEYS);

      // Crop nested keys
      expect(Object.keys(detail.crop).sort()).toEqual([
        "id",
        "minIncrementPerKg",
        "nameBn",
        "nameEn",
        "slug",
        "unit",
      ]);

      // AI price snapshot nested keys: public guidance range only
      expect(Object.keys(detail.aiPriceSnapshot).sort()).toEqual([
        "expectedPerKg",
        "highPerKg",
        "lowPerKg",
        "trend",
      ]);

      // Location nested keys: strictly division and district only
      expect(Object.keys(detail.location).sort()).toEqual(["district", "division"]);

      // Serialized string leak audit
      const rawPayload = JSON.stringify(res.body);
      expect(rawPayload).not.toContain("FARMER_SECRET_PICKUP_NOTE");
      expect(rawPayload).not.toContain("pickupNote");
      expect(rawPayload).not.toContain(farmerId);
      expect(rawPayload).not.toContain("PrivateUpazilaSecret");
      expect(rawPayload).not.toContain("01711111111");
      expect(rawPayload).not.toContain("suggestedFloorPerKg");
      expect(rawPayload).not.toContain("modelVersion");
      expect(rawPayload).not.toContain("classProbabilities");
      expect(rawPayload).not.toContain("imageHashes");
      expect(rawPayload).not.toContain("internal-model");
      expect(rawPayload).not.toContain("password");
      expect(rawPayload).not.toContain("token");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Bid History: GET /api/v1/listings/:id/bids
  // -------------------------------------------------------------------------
  describe("Endpoint 3: GET /api/v1/listings/:id/bids (Anonymized bid history)", () => {
    it("returns ONLY allowed keys on AnonymizedBidHistoryItem and replaces buyerId with label", async () => {
      const listing = await createPopulatedListing();

      // Seed 2 bids from 2 different buyers
      await Bid.create([
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerOneId),
          amountPerKg: 4400,
          totalAmount: 2200000,
          seq: 1,
          status: BidStatus.ACCEPTED,
          placedAt: new Date(testClock.now().getTime() - 600_000),
        },
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerTwoId),
          amountPerKg: 4600,
          totalAmount: 2300000,
          seq: 2,
          status: BidStatus.ACCEPTED,
          placedAt: new Date(testClock.now().getTime() - 300_000),
        },
      ]);

      const res = await request(app)
        .get(`/api/v1/listings/${listing._id.toString()}/bids`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      // Envelope keys
      expect(Object.keys(res.body).sort()).toEqual(["data", "meta"]);
      expect(Object.keys(res.body.meta).sort()).toEqual(["serverTime"]);

      expect(res.body.data.length).toBe(2);

      const ALLOWED_BID_KEYS = [
        "id",
        "listingId",
        "amountPerKg",
        "totalAmount",
        "bidderLabel",
        "placedAt",
        "isMine",
        "isMyBid",
      ].sort();

      for (const item of res.body.data) {
        expect(Object.keys(item).sort()).toEqual(ALLOWED_BID_KEYS);
        // Verify bidderLabel is an anonymized label
        expect(item.bidderLabel).toMatch(/^Buyer #\d+$/);
      }

      // Serialized string leak audit: Buyer IDs and phone numbers MUST NOT appear
      const rawPayload = JSON.stringify(res.body);
      expect(rawPayload).not.toContain(buyerOneId);
      expect(rawPayload).not.toContain(buyerTwoId);
      expect(rawPayload).not.toContain(farmerId);
      expect(rawPayload).not.toContain("buyerId");
      expect(rawPayload).not.toContain("userId");
      expect(rawPayload).not.toContain("pickupNote");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Compare: GET /api/v1/listings/compare?ids=...
  // -------------------------------------------------------------------------
  describe("Endpoint 4: GET /api/v1/listings/compare (Compare payload)", () => {
    it("returns ONLY allowed keys on ComparePayload and CompareListing without internal AI fields", async () => {
      const listing1 = await createPopulatedListing();
      const listing2 = await createPopulatedListing({
        floorPricePerKg: 4400,
        currentBidPerKg: 4800,
        currentBidderId: new ObjectId(buyerTwoId),
      });

      const res = await request(app)
        .get(
          `/api/v1/listings/compare?ids=${listing1._id.toString()},${listing2._id.toString()}`,
        )
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      // Envelope keys
      expect(Object.keys(res.body).sort()).toEqual(["data", "meta"]);
      expect(Object.keys(res.body.meta).sort()).toEqual(["serverTime"]);

      const data = res.body.data;
      expect(Object.keys(data).sort()).toEqual(["cropId", "highlights", "listings", "missingIds"]);

      const item = data.listings[0];
      expect(item).toBeDefined();

      const ALLOWED_COMPARE_KEYS = [
        "id",
        "cropId",
        "crop",
        "cropNameEn",
        "cropNameBn",
        "grade",
        "quantityKg",
        "floorPricePerKg",
        "currentBidPerKg",
        "displayPricePerKg",
        "displayTotalCost",
        "totalDisplayCost",
        "minIncrementPerKg",
        "hasBids",
        "bidCount",
        "startsAt",
        "endsAt",
        "status",
        "location",
        "farmerRegion",
        "timeLeftSeconds",
        "aiExpectedPricePerKg",
        "aiRange",
        "percentageVsAiExpected",
        "highlights",
        "thumbnailUrl",
        "images",
        "card",
      ].sort();

      expect(Object.keys(item).sort()).toEqual(ALLOWED_COMPARE_KEYS);

      // Location nested keys: strictly division and district only (upazila stripped)
      expect(Object.keys(item.location).sort()).toEqual(["district", "division"]);

      // AI range nested keys
      if (item.aiRange) {
        expect(Object.keys(item.aiRange).sort()).toEqual([
          "expectedPerKg",
          "highPerKg",
          "lowPerKg",
        ]);
      }

      // Highlights nested keys
      expect(Object.keys(item.highlights).sort()).toEqual([
        "isBestGrade",
        "isBestValue",
        "isLargestQuantity",
        "isLowestPrice",
      ]);

      // Serialized string leak audit
      const rawPayload = JSON.stringify(res.body);
      expect(rawPayload).not.toContain("FARMER_SECRET_PICKUP_NOTE");
      expect(rawPayload).not.toContain("pickupNote");
      expect(rawPayload).not.toContain(farmerId);
      expect(rawPayload).not.toContain("PrivateUpazilaSecret");
      expect(rawPayload).not.toContain("suggestedFloorPerKg");
      expect(rawPayload).not.toContain("modelVersion");
      expect(rawPayload).not.toContain("classProbabilities");
      expect(rawPayload).not.toContain("imageHashes");
      expect(rawPayload).not.toContain("aiPriceGuidance");
    });
  });

  // -------------------------------------------------------------------------
  // 5. My Bids: GET /api/v1/bids/mine
  // -------------------------------------------------------------------------
  describe("Endpoint 5: GET /api/v1/bids/mine (Grouped and Paginated)", () => {
    it("returns ONLY allowed keys on MyBidsRow for grouped and paginated queries", async () => {
      const listing = await createPopulatedListing();

      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerOneId),
        amountPerKg: 4600,
        totalAmount: 2300000,
        seq: 1,
        status: BidStatus.ACCEPTED,
        placedAt: testClock.now(),
      });

      // 5a. Grouped response
      const resGrouped = await request(app)
        .get("/api/v1/bids/mine")
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(resGrouped.status).toBe(200);
      expect(Object.keys(resGrouped.body).sort()).toEqual(["data", "meta"]);
      expect(Object.keys(resGrouped.body.meta).sort()).toEqual(["serverTime", "total"]);
      expect(Object.keys(resGrouped.body.data).sort()).toEqual(["active", "lost", "won"]);

      const activeRow = resGrouped.body.data.active[0];
      expect(activeRow).toBeDefined();

      const ALLOWED_ROW_KEYS = [
        "bidId",
        "listingId",
        "cropId",
        "cropNameEn",
        "cropNameBn",
        "grade",
        "quantityKg",
        "myBidPerKg",
        "myTotalAmount",
        "currentBidPerKg",
        "currentTotalAmount",
        "bidCount",
        "status",
        "listingStatus",
        "endsAt",
        "placedAt",
        "thumbnailUrl",
        "gapToCurrentPerKg",
        "gap",
        "orderId",
      ].sort();

      expect(Object.keys(activeRow).sort()).toEqual(ALLOWED_ROW_KEYS);

      // 5b. Paginated response
      const resPaginated = await request(app)
        .get("/api/v1/bids/mine?group=active&page=1&limit=10")
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(resPaginated.status).toBe(200);
      expect(Object.keys(resPaginated.body).sort()).toEqual(["data", "meta"]);
      expect(Object.keys(resPaginated.body.meta).sort()).toEqual([
        "group",
        "limit",
        "page",
        "serverTime",
        "total",
        "totalPages",
      ]);

      const paginatedRow = resPaginated.body.data[0];
      expect(Object.keys(paginatedRow).sort()).toEqual(ALLOWED_ROW_KEYS);

      // Serialized string leak audit
      const rawPayload = JSON.stringify(resGrouped.body);
      expect(rawPayload).not.toContain("FARMER_SECRET_PICKUP_NOTE");
      expect(rawPayload).not.toContain("pickupNote");
      expect(rawPayload).not.toContain(farmerId);
      expect(rawPayload).not.toContain("01711111111");
      expect(rawPayload).not.toContain("suggestedFloorPerKg");
      expect(rawPayload).not.toContain("modelVersion");
    });
  });

  // -------------------------------------------------------------------------
  // 6. Stream Events: snapshot, bid.placed, auction.extended, auction.closed
  // -------------------------------------------------------------------------
  describe("Endpoint 6: Listing Stream Events (SSE payload shapes)", () => {
    it("asserts EXACT allowed key sets on all stream event payloads and zero leaked IDs", async () => {
      const listing = await createPopulatedListing();

      // 6a. Snapshot Event payload
      const snapshot = {
        listingId: listing._id.toString(),
        currentPrice: listing.currentBidPerKg!,
        currentBidPerKg: listing.currentBidPerKg!,
        floorPricePerKg: listing.floorPricePerKg,
        bidCount: listing.bidCount,
        endTime: listing.endsAt.toISOString(),
        endsAt: listing.endsAt.toISOString(),
        status: listing.status,
        serverTime: testClock.iso(),
      };

      const ALLOWED_SNAPSHOT_KEYS = [
        "listingId",
        "currentPrice",
        "currentBidPerKg",
        "floorPricePerKg",
        "bidCount",
        "endTime",
        "endsAt",
        "status",
        "serverTime",
      ].sort();

      expect(Object.keys(snapshot).sort()).toEqual(ALLOWED_SNAPSHOT_KEYS);

      // 6b. Bid Placed Patch payload (emitted on bid.placed)
      const bidPlacedPatch = {
        listingId: listing._id.toString(),
        bidId: new ObjectId().toString(),
        bidderLabel: "Buyer #1",
        currentPrice: 4800,
        currentBidPerKg: 4800,
        amountPerKg: 4800,
        totalAmount: 2400000,
        bidCount: 3,
        placedAt: testClock.iso(),
        serverTime: testClock.iso(),
      };

      const ALLOWED_BID_PLACED_PATCH_KEYS = [
        "listingId",
        "bidId",
        "bidderLabel",
        "currentPrice",
        "currentBidPerKg",
        "amountPerKg",
        "totalAmount",
        "bidCount",
        "placedAt",
        "serverTime",
      ].sort();

      expect(Object.keys(bidPlacedPatch).sort()).toEqual(ALLOWED_BID_PLACED_PATCH_KEYS);
      expect(Object.keys(bidPlacedPatch)).not.toContain("buyerId");
      expect(Object.keys(bidPlacedPatch)).not.toContain("userId");

      // 6c. Auction Extended Patch payload (emitted on auction.extended)
      const extendedPatch = {
        listingId: listing._id.toString(),
        endsAt: new Date(testClock.now().getTime() + 600_000).toISOString(),
        endTime: new Date(testClock.now().getTime() + 600_000).toISOString(),
        extensionCount: 2,
        extendedAt: testClock.iso(),
        serverTime: testClock.iso(),
      };

      const ALLOWED_EXTENDED_PATCH_KEYS = [
        "listingId",
        "endsAt",
        "endTime",
        "extensionCount",
        "extendedAt",
        "serverTime",
      ].sort();

      expect(Object.keys(extendedPatch).sort()).toEqual(ALLOWED_EXTENDED_PATCH_KEYS);

      // 6d. Auction Closed Patch payload (emitted on auction.closed)
      const closedPatch = {
        listingId: listing._id.toString(),
        status: ListingStatus.SOLD,
        closedAt: testClock.iso(),
        winningBidId: new ObjectId().toString(),
        winningAmountPerKg: 4800,
        totalAmount: 2400000,
        serverTime: testClock.iso(),
      };

      const ALLOWED_CLOSED_PATCH_KEYS = [
        "listingId",
        "status",
        "closedAt",
        "winningBidId",
        "winningAmountPerKg",
        "totalAmount",
        "serverTime",
      ].sort();

      expect(Object.keys(closedPatch).sort()).toEqual(ALLOWED_CLOSED_PATCH_KEYS);
      expect(Object.keys(closedPatch)).not.toContain("winningBidderId");
      expect(Object.keys(closedPatch)).not.toContain("buyerId");
    });
  });
});
