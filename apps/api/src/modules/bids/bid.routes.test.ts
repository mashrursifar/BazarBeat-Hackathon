import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  ListingStatus,
  type PublicUser,
  UserRole,
  anonymizedBidHistoryResponseSchema,
  bidResponseSchema,
} from "@bazarbeat/shared";

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
import { Listing } from "../listings/listing.model.js";
import { User } from "../users/user.model.js";
import { Bid } from "./bid.model.js";

const farmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const buyerTwoId = new Types.ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmer: {
    id: farmerId,
    role: UserRole.FARMER,
    name: "Farmer Roy",
    division: "Rajshahi",
    district: "Bogra",
    language: "en",
  },
  buyer: {
    id: buyerId,
    role: UserRole.BUYER,
    name: "Buyer Kabir",
    division: "Dhaka",
    district: "Dhaka",
    organization: "Kabir Foods",
    language: "en",
  },
  buyerTwo: {
    id: buyerTwoId,
    role: UserRole.BUYER,
    name: "Buyer Salam",
    division: "Chittagong",
    district: "Chittagong",
    organization: "Salam Trading",
    language: "en",
  },
};

let mongoReplicaSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;

beforeAll(async () => {
  mongoReplicaSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplicaSet.getUri());
  await Promise.all([Listing.init(), Bid.init(), User.init()]);
  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (user === undefined) throw new Error("Unexpected test access token");
    return user;
  });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplicaSet !== undefined) await mongoReplicaSet.stop();
});

beforeEach(async () => {
  testClock = new TestClock(new Date("2026-11-14T10:00:00.000Z"));
  setClock(testClock);
  setDomainEventEmitter(new DomainEventEmitter());
  await Promise.all([Listing.deleteMany({}), Bid.deleteMany({}), User.deleteMany({})]);
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

async function createSampleListing(
  overrides: Partial<Record<string, unknown>> = {},
): Promise<InstanceType<typeof Listing>> {
  const now = testClock.now();
  const endsAt = new Date(now.getTime() + 60 * 60 * 1000);

  return Listing.create({
    farmerId,
    cropId: new Types.ObjectId(),
    quantityKg: 100,
    images: [{ url: "/sample.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.95, B: 0.05, C: 0 },
      qualityNotes: ["High quality"],
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
      explanation: ["High quality"],
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
}

describe("Bid HTTP Routes", () => {
  describe("POST /api/v1/listings/:id/bids", () => {
    it("requires authentication (401)", async () => {
      const listing = await createSampleListing();

      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5500 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("requires BUYER role (403 FORBIDDEN for farmers)", async () => {
      const listing = await createSampleListing();

      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=farmer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5500 });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("requires CSRF protection header (403 FORBIDDEN)", async () => {
      const listing = await createSampleListing();

      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .send({ amountPerKg: 5500 });

      expect(response.status).toBe(403);
    });

    it("validates body payload (400 VALIDATION_ERROR on non-integer or zero)", async () => {
      const listing = await createSampleListing();

      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("successfully accepts a valid opening bid (201)", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000 });

      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      expect(response.status).toBe(201);
      const parsed = bidResponseSchema.parse(response.body);
      expect(parsed.data.amountPerKg).toBe(5200);
      expect(parsed.data.totalAmount).toBe(520000);
      expect(parsed.data.status).toBe("ACCEPTED");
      expect(parsed.meta.serverTime).toBe(testClock.iso());

      const updated = await Listing.findById(listing._id);
      expect(updated?.currentBidPerKg).toBe(5200);
      expect(updated?.bidCount).toBe(1);
    });

    it("returns 409 CONFLICT if current highest bidder attempts to outbid self", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000 });

      // First bid by buyer
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      // Immediate second bid by same buyer
      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5400 });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("CONFLICT");
    });

    it("returns 400 BID_TOO_LOW if bid does not meet minIncrement", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });

      // First bid
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      // Second bid with increment less than 100
      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5250 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("BID_TOO_LOW");
    });
  });

  describe("GET /api/v1/listings/:id/bids", () => {
    it("requires authentication (401)", async () => {
      const listing = await createSampleListing();

      const response = await request(app).get(`/api/v1/listings/${listing._id}/bids`);

      expect(response.status).toBe(401);
    });

    it("returns anonymized bid history with serverTime (200)", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });

      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5000 });

      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"]);

      expect(response.status).toBe(200);
      const parsed = anonymizedBidHistoryResponseSchema.parse(response.body);
      expect(parsed.data).toHaveLength(2);
      const firstBid = parsed.data[0];
      const secondBid = parsed.data[1];
      expect(firstBid).toBeDefined();
      expect(secondBid).toBeDefined();
      if (firstBid && secondBid) {
        expect(firstBid.amountPerKg).toBe(5200);
        expect(firstBid.bidderLabel).toBe("Buyer #2");
        expect(firstBid.isMyBid).toBe(false);

        expect(secondBid.amountPerKg).toBe(5000);
        expect(secondBid.bidderLabel).toBe("Buyer #1");
        expect(secondBid.isMyBid).toBe(true);
      }

      expect(parsed.meta.serverTime).toBe(testClock.iso());
    });
  });
});
