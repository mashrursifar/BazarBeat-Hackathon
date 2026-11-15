import { ObjectId } from "bson";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  ListingStatus,
  type PublicUser,
  UserRole,
  buyerListingDetailResponseSchema,
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
  await Promise.all([Listing.init(), Crop.init(), Bid.init()]);

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

  await Promise.all([Listing.deleteMany({}), Crop.deleteMany({}), Bid.deleteMany({})]);

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

interface CreateListingOptions {
  status?: string;
  farmerIdOverride?: string;
  currentBidderId?: string | null;
  currentBidPerKg?: number | null;
  bidCount?: number;
  pickupNote?: string;
}

async function createSampleListingDoc(
  options: CreateListingOptions = {},
): Promise<InstanceType<typeof Listing>> {
  const listingId = new ObjectId();
  const startsAt = new Date("2026-11-14T08:00:00.000Z");
  const endsAt = new Date("2026-11-14T16:00:00.000Z");

  return await Listing.create({
    _id: listingId,
    farmerId: new ObjectId(options.farmerIdOverride ?? farmerId),
    cropId: new ObjectId(onionCropId),
    quantityKg: 500,
    images: [
      { url: "https://images.bazarbeat.com/sample1.jpg", width: 800, height: 600 },
      { url: "https://images.bazarbeat.com/sample2.jpg", width: 800, height: 600 },
    ],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.94,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.94, B: 0.05, C: 0.01 },
      qualityNotes: ["Firm skin", "Even reddish hue", "No fungal spots"],
      cropMatch: true,
      modelVersion: "mock-v1",
      provider: "mock",
      degraded: false,
      assessedAt: new Date("2026-11-14T07:55:00.000Z"),
    },
    aiPriceGuidance: {
      lowPerKg: 4000,
      expectedPerKg: 4800,
      highPerKg: 5500,
      trend: "UP",
      confidence: 0.91,
      explanation: ["Strong seasonal demand", "Limited supply in Gazipur"],
      modelVersion: "mock-v1",
      provider: "mock",
      degraded: false,
      generatedAt: new Date("2026-11-14T07:55:00.000Z"),
      suggestedFloorPerKg: 4200,
    },
    floorPricePerKg: 4200,
    minIncrementPerKg: 100,
    ...(options.currentBidPerKg !== undefined && options.currentBidPerKg !== null
      ? { currentBidPerKg: options.currentBidPerKg }
      : {}),
    currentBidderId: options.currentBidderId ? new ObjectId(options.currentBidderId) : null,
    bidCount: options.bidCount ?? 0,
    startsAt,
    endsAt,
    originalEndsAt: endsAt,
    extensionCount: 0,
    status: options.status ?? ListingStatus.ACTIVE,
    location: {
      division: "Dhaka",
      district: "Gazipur",
      upazila: "Sreepur",
    },
    pickupNote: options.pickupNote ?? "Near Sreepur Rail Station, call 01700000000",
  });
}

describe("GET /api/v1/listings/:id — Buyer Listing Detail & Visibility", () => {
  describe("Visibility rules", () => {
    it("allows a buyer to open any ACTIVE listing (200 OK)", async () => {
      const listing = await createSampleListingDoc({ status: ListingStatus.ACTIVE });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.id).toBe(listing._id.toString());
      expect(parsed.data.status).toBe(ListingStatus.ACTIVE);
      expect(parsed.data.myStatus).toBe("NONE");
      expect(parsed.data.myHighestBidPerKg).toBeNull();
    });

    it("rejects a buyer viewing an ended listing (SOLD) that they have NOT bid on with 404 NOT_FOUND", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.SOLD,
        currentBidderId: buyerTwoId,
        currentBidPerKg: 5000,
        bidCount: 1,
      });

      // BuyerTwo placed a bid
      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerTwoId),
        amountPerKg: 5000,
        totalAmount: 2500000,
        seq: 1,
        status: "WON",
        placedAt: new Date("2026-11-14T09:00:00.000Z"),
      });

      // BuyerOne has NOT bid on it -> must return 404
      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects a buyer viewing an ended listing (EXPIRED_UNSOLD) that they have NOT bid on with 404 NOT_FOUND", async () => {
      const listing = await createSampleListingDoc({ status: ListingStatus.EXPIRED_UNSOLD });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("allows a buyer to open an ended listing (SOLD) that they HAVE bid on (own ended listing) (200 OK)", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.SOLD,
        currentBidderId: buyerOneId,
        currentBidPerKg: 5200,
        bidCount: 2,
      });

      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerOneId),
        amountPerKg: 5200,
        totalAmount: 2600000,
        seq: 2,
        status: "WON",
        placedAt: new Date("2026-11-14T09:30:00.000Z"),
      });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.id).toBe(listing._id.toString());
      expect(parsed.data.status).toBe(ListingStatus.SOLD);
      expect(parsed.data.myStatus).toBe("WON");
      expect(parsed.data.myHighestBidPerKg).toBe(5200);
    });

    it("allows a buyer to open an ended listing (EXPIRED_UNSOLD / CANCELLED) that they HAVE bid on (200 OK)", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.EXPIRED_UNSOLD,
        currentBidderId: null,
        bidCount: 1,
      });

      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerOneId),
        amountPerKg: 4000,
        totalAmount: 2000000,
        seq: 1,
        status: "LOST",
        placedAt: new Date("2026-11-14T09:00:00.000Z"),
      });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.id).toBe(listing._id.toString());
      expect(parsed.data.status).toBe(ListingStatus.EXPIRED_UNSOLD);
      expect(parsed.data.myStatus).toBe("LOST");
      expect(parsed.data.myHighestBidPerKg).toBe(4000);
    });

    it("rejects non-owner buyers from viewing DRAFT listings with 404 NOT_FOUND", async () => {
      const listing = await createSampleListingDoc({ status: ListingStatus.DRAFT });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("allows the owner farmer to view their listing in any status (DRAFT, ACTIVE, SOLD)", async () => {
      const listing = await createSampleListingDoc({ status: ListingStatus.DRAFT });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=farmer"]);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(listing._id.toString());
      expect(response.body.data.pickupNote).toBeDefined(); // Owner farmer sees pickup note
    });
  });

  describe("Own-status derivation in all five states", () => {
    it("State 1: NONE — buyer has never bid on the listing", async () => {
      const listing = await createSampleListingDoc({ status: ListingStatus.ACTIVE });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.myStatus).toBe("NONE");
      expect(parsed.data.myHighestBidPerKg).toBeNull();
    });

    it("State 2: WINNING — listing is ACTIVE and calling buyer is current highest bidder", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.ACTIVE,
        currentBidderId: buyerOneId,
        currentBidPerKg: 5000,
        bidCount: 1,
      });

      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerOneId),
        amountPerKg: 5000,
        totalAmount: 2500000,
        seq: 1,
        status: "ACCEPTED",
        placedAt: new Date("2026-11-14T09:00:00.000Z"),
      });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.myStatus).toBe("WINNING");
      expect(parsed.data.myHighestBidPerKg).toBe(5000);
    });

    it("State 3: OUTBID — listing is ACTIVE, buyer has bid, but another buyer is highest bidder", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.ACTIVE,
        currentBidderId: buyerTwoId,
        currentBidPerKg: 5200,
        bidCount: 2,
      });

      // Buyer 1 placed opening bid at 5000
      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerOneId),
        amountPerKg: 5000,
        totalAmount: 2500000,
        seq: 1,
        status: "ACCEPTED",
        placedAt: new Date("2026-11-14T09:00:00.000Z"),
      });

      // Buyer 2 outbid at 5200
      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerTwoId),
        amountPerKg: 5200,
        totalAmount: 2600000,
        seq: 2,
        status: "ACCEPTED",
        placedAt: new Date("2026-11-14T09:10:00.000Z"),
      });

      // Check as buyerOne -> OUTBID
      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.myStatus).toBe("OUTBID");
      expect(parsed.data.myHighestBidPerKg).toBe(5000);

      // Check as buyerTwo -> WINNING
      const responseTwo = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerTwo"]);

      const parsedTwo = buyerListingDetailResponseSchema.parse(responseTwo.body);
      expect(parsedTwo.data.myStatus).toBe("WINNING");
      expect(parsedTwo.data.myHighestBidPerKg).toBe(5200);
    });

    it("State 4: WON — listing is SOLD and calling buyer was the winning bidder", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.SOLD,
        currentBidderId: buyerOneId,
        currentBidPerKg: 5300,
        bidCount: 3,
      });

      await Bid.create([
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerOneId),
          amountPerKg: 5000,
          totalAmount: 2500000,
          seq: 1,
          status: "ACCEPTED",
          placedAt: new Date("2026-11-14T09:00:00.000Z"),
        },
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerTwoId),
          amountPerKg: 5200,
          totalAmount: 2600000,
          seq: 2,
          status: "LOST",
          placedAt: new Date("2026-11-14T09:10:00.000Z"),
        },
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerOneId),
          amountPerKg: 5300,
          totalAmount: 2650000,
          seq: 3,
          status: "WON",
          placedAt: new Date("2026-11-14T09:20:00.000Z"),
        },
      ]);

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.myStatus).toBe("WON");
      expect(parsed.data.myHighestBidPerKg).toBe(5300);
    });

    it("State 5: LOST — listing is SOLD (won by other buyer) or EXPIRED_UNSOLD for bidder", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.SOLD,
        currentBidderId: buyerTwoId,
        currentBidPerKg: 5400,
        bidCount: 2,
      });

      await Bid.create([
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerOneId),
          amountPerKg: 5100,
          totalAmount: 2550000,
          seq: 1,
          status: "LOST",
          placedAt: new Date("2026-11-14T09:00:00.000Z"),
        },
        {
          listingId: listing._id,
          buyerId: new ObjectId(buyerTwoId),
          amountPerKg: 5400,
          totalAmount: 2700000,
          seq: 2,
          status: "WON",
          placedAt: new Date("2026-11-14T09:15:00.000Z"),
        },
      ]);

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data.myStatus).toBe("LOST");
      expect(parsed.data.myHighestBidPerKg).toBe(5100);
    });
  });

  describe("Privacy & DTO completeness: strictly no leaked private fields", () => {
    it("never exposes pickup note, farmerId, or bidder identities to buyers", async () => {
      const listing = await createSampleListingDoc({
        status: ListingStatus.ACTIVE,
        currentBidderId: buyerTwoId,
        currentBidPerKg: 4900,
        bidCount: 1,
        pickupNote: "PRIVATE_FARMER_PICKUP_NOTE_SECRET",
      });

      await Bid.create({
        listingId: listing._id,
        buyerId: new ObjectId(buyerTwoId),
        amountPerKg: 4900,
        totalAmount: 2450000,
        seq: 1,
        status: "ACCEPTED",
        placedAt: new Date("2026-11-14T09:00:00.000Z"),
      });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(response.status).toBe(200);

      // Verify schema compliance
      const parsed = buyerListingDetailResponseSchema.parse(response.body);
      expect(parsed.data).toBeDefined();

      // Check required buyer fields
      expect(parsed.data.images).toHaveLength(2);
      expect(parsed.data.grade).toBe(CropGrade.A);
      expect(parsed.data.confidenceBand).toBe("HIGH");
      expect(parsed.data.reasons).toEqual(["Firm skin", "Even reddish hue", "No fungal spots"]);
      expect(parsed.data.aiPriceSnapshot).toEqual({
        lowPerKg: 4000,
        expectedPerKg: 4800,
        highPerKg: 5500,
        trend: "UP",
      });
      expect(parsed.data.provider).toBe("mock");
      expect(parsed.data.degraded).toBe(false);
      expect(parsed.data.quantityKg).toBe(500);
      expect(parsed.data.floorPricePerKg).toBe(4200);
      expect(parsed.data.displayPricePerKg).toBe(4900);
      expect(parsed.data.displayTotalCost).toBe(2450000);
      expect(parsed.data.bidCount).toBe(1);
      expect(parsed.data.location).toEqual({
        division: "Dhaka",
        district: "Gazipur",
      });

      // Strict leak assertions on serialized JSON payload
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain("PRIVATE_FARMER_PICKUP_NOTE_SECRET");
      expect(jsonString).not.toContain("pickupNote");
      expect(jsonString).not.toContain(farmerId);
      expect(jsonString).not.toContain(buyerTwoId);
      expect(jsonString).not.toContain("Sreepur"); // Upazila / local address stripped
      expect(jsonString).not.toContain("01700000000"); // Phone number stripped
    });
  });
});
