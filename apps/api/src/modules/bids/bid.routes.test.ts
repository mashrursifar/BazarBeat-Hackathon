import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  ListingStatus,
  OrderStatus,
  type PublicUser,
  UserRole,
  anonymizedBidHistoryResponseSchema,
  bidResponseSchema,
  bidTooLowDetailsSchema,
  myBidsResponseSchema,
  paginatedMyBidsResponseSchema,
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
import { Crop } from "../crops/crop.model.js";
import { Listing } from "../listings/listing.model.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { Bid } from "./bid.model.js";
import { IdempotencyRecord } from "./idempotency-record.model.js";

const farmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const buyerTwoId = new Types.ObjectId().toString();
const buyerThreeId = new Types.ObjectId().toString();

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
  buyerThree: {
    id: buyerThreeId,
    role: UserRole.BUYER,
    name: "Buyer Amin",
    division: "Sylhet",
    district: "Sylhet",
    organization: "Amin Produce",
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
  await Promise.all([
    Listing.init(),
    Bid.init(),
    User.init(),
    IdempotencyRecord.init(),
    Crop.init(),
    Order.init(),
  ]);
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
  await Promise.all([
    Listing.deleteMany({}),
    Bid.deleteMany({}),
    User.deleteMany({}),
    IdempotencyRecord.deleteMany({}),
    Crop.deleteMany({}),
    Order.deleteMany({}),
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

    it("returns 400 BID_TOO_LOW with error details if opening bid is below floor price", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });

      const response = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4900 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("BID_TOO_LOW");
      expect(response.body.error.details).toBeDefined();

      const details = bidTooLowDetailsSchema.parse(response.body.error.details);
      expect(details).toEqual({
        minimumRequiredPerKg: 5000,
        currentBidPerKg: null,
        floorPricePerKg: 5000,
        minIncrementPerKg: 100,
      });
    });

    it("returns 400 BID_TOO_LOW with error details if subsequent bid does not meet minIncrement", async () => {
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
      expect(response.body.error.details).toBeDefined();

      const details = bidTooLowDetailsSchema.parse(response.body.error.details);
      expect(details).toEqual({
        minimumRequiredPerKg: 5300,
        currentBidPerKg: 5200,
        floorPricePerKg: 5000,
        minIncrementPerKg: 100,
      });
    });

    describe("Idempotency-Key support through IdempotencyRecord", () => {
      it("returns original result on replay and never creates a second bid", async () => {
        const listing = await createSampleListing({ floorPricePerKg: 5000 });
        const idempotencyKey = "client-req-uuid-999";

        // First attempt with Idempotency-Key
        const firstRes = await request(app)
          .post(`/api/v1/listings/${listing._id}/bids`)
          .set("Cookie", ["accessToken=buyer"])
          .set("X-CSRF-Protection", "1")
          .set("Idempotency-Key", idempotencyKey)
          .send({ amountPerKg: 5300 });

        expect(firstRes.status).toBe(201);
        const firstParsed = bidResponseSchema.parse(firstRes.body);
        expect(firstParsed.data.amountPerKg).toBe(5300);

        // Verify IdempotencyRecord is persisted in MongoDB
        const storedRecord = await IdempotencyRecord.findOne({
          key: idempotencyKey,
          userId: buyerId,
        });
        expect(storedRecord).toBeDefined();
        expect(storedRecord?.listingId.toString()).toBe(listing._id.toString());
        expect(storedRecord?.bidId.toString()).toBe(firstParsed.data.id);

        // Second attempt with exact same Idempotency-Key (replay)
        const replayRes = await request(app)
          .post(`/api/v1/listings/${listing._id}/bids`)
          .set("Cookie", ["accessToken=buyer"])
          .set("X-CSRF-Protection", "1")
          .set("Idempotency-Key", idempotencyKey)
          .send({ amountPerKg: 5300 });

        expect(replayRes.status).toBe(201);
        const replayParsed = bidResponseSchema.parse(replayRes.body);
        expect(replayParsed.data.id).toBe(firstParsed.data.id);
        expect(replayParsed.data.amountPerKg).toBe(firstParsed.data.amountPerKg);
        expect(replayParsed.data.totalAmount).toBe(firstParsed.data.totalAmount);
        expect(replayParsed.meta.serverTime).toBe(testClock.iso());

        // Crucial invariant: never creates a second bid in the database
        const totalBidsInDb = await Bid.countDocuments({ listingId: listing._id });
        expect(totalBidsInDb).toBe(1);

        const updatedListing = await Listing.findById(listing._id);
        expect(updatedListing?.bidCount).toBe(1);
      });

      it("rejects replaying an idempotency key across different listings with 409 CONFLICT", async () => {
        const listingOne = await createSampleListing({ floorPricePerKg: 5000 });
        const listingTwo = await createSampleListing({ floorPricePerKg: 4000 });
        const sharedKey = "cross-listing-key-1";

        // Place on listingOne
        const resOne = await request(app)
          .post(`/api/v1/listings/${listingOne._id}/bids`)
          .set("Cookie", ["accessToken=buyer"])
          .set("X-CSRF-Protection", "1")
          .set("Idempotency-Key", sharedKey)
          .send({ amountPerKg: 5200 });
        expect(resOne.status).toBe(201);

        // Attempt replay on listingTwo with the same key
        const resTwo = await request(app)
          .post(`/api/v1/listings/${listingTwo._id}/bids`)
          .set("Cookie", ["accessToken=buyer"])
          .set("X-CSRF-Protection", "1")
          .set("Idempotency-Key", sharedKey)
          .send({ amountPerKg: 4200 });

        expect(resTwo.status).toBe(409);
        expect(resTwo.body.error.code).toBe("CONFLICT");
      });

      it("rejects empty idempotency key with 400 VALIDATION_ERROR", async () => {
        const listing = await createSampleListing({ floorPricePerKg: 5000 });

        const res = await request(app)
          .post(`/api/v1/listings/${listing._id}/bids`)
          .set("Cookie", ["accessToken=buyer"])
          .set("X-CSRF-Protection", "1")
          .set("Idempotency-Key", "   ")
          .send({ amountPerKg: 5200 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
    });

    describe("Rate limiting (20 bids per minute per user)", () => {
      it("enforces rate limit of 20 bids per minute per user and allows other users", async () => {
        const rateLimitBuyerId = new Types.ObjectId().toString();
        const otherBuyerId = new Types.ObjectId().toString();

        sessionUsers["rateBuyer"] = {
          id: rateLimitBuyerId,
          role: UserRole.BUYER,
          name: "Rate Buyer",
          division: "Dhaka",
          district: "Dhaka",
          organization: "Rate Traders",
          language: "en",
        };

        sessionUsers["otherBuyer"] = {
          id: otherBuyerId,
          role: UserRole.BUYER,
          name: "Other Buyer",
          division: "Dhaka",
          district: "Dhaka",
          organization: "Other Traders",
          language: "en",
        };

        // 20 requests by rateBuyer (they can fail on validation or succeed, rate limiter counts all hits to the endpoint)
        const listing = await createSampleListing({ floorPricePerKg: 5000 });

        for (let i = 0; i < 20; i++) {
          const res = await request(app)
            .post(`/api/v1/listings/${listing._id}/bids`)
            .set("Cookie", ["accessToken=rateBuyer"])
            .set("X-CSRF-Protection", "1")
            .send({ amountPerKg: 0 }); // Intentionally invalid body to trigger quick validation after rate limiter
          expect(res.status).toBe(400);
          expect(res.body.error.code).toBe("VALIDATION_ERROR");
        }

        // 21st request by rateBuyer is rate limited
        const rateLimitedRes = await request(app)
          .post(`/api/v1/listings/${listing._id}/bids`)
          .set("Cookie", ["accessToken=rateBuyer"])
          .set("X-CSRF-Protection", "1")
          .send({ amountPerKg: 5100 });

        expect(rateLimitedRes.status).toBe(429);
        expect(rateLimitedRes.body).toMatchObject({
          error: {
            code: "RATE_LIMITED",
            message: expect.stringContaining("20 bids per minute per user"),
          },
        });

        // otherBuyer is unaffected
        const otherRes = await request(app)
          .post(`/api/v1/listings/${listing._id}/bids`)
          .set("Cookie", ["accessToken=otherBuyer"])
          .set("X-CSRF-Protection", "1")
          .send({ amountPerKg: 5100 });

        expect(otherRes.status).toBe(201);
      });
    });
  });

  describe("GET /api/v1/listings/:id/bids", () => {
    it("requires authentication (401 UNAUTHENTICATED)", async () => {
      const listing = await createSampleListing();

      const response = await request(app).get(`/api/v1/listings/${listing._id}/bids`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
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

    it("verifies stable anonymization by order of each buyer's first bid without leaking PII", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });

      const buyerThreeId = new Types.ObjectId().toString();
      sessionUsers["buyerThree"] = {
        id: buyerThreeId,
        role: UserRole.BUYER,
        name: "Buyer Three Tarek",
        division: "Sylhet",
        district: "Sylhet",
        organization: "Sylhet Spices",
        language: "en",
      };

      // Bid 1: Buyer Kabir -> Buyer #1
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5100 });

      // Bid 2: Buyer Salam -> Buyer #2
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      // Bid 3: Buyer Tarek -> Buyer #3
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerThree"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5300 });

      // Bid 4: Buyer Kabir bids again -> must still be Buyer #1!
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5400 });

      // Inspect history as buyerTwo
      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"]);

      expect(response.status).toBe(200);
      const parsed = anonymizedBidHistoryResponseSchema.parse(response.body);
      expect(parsed.data).toHaveLength(4);

      // Newest first order
      expect(parsed.data[0]?.amountPerKg).toBe(5400);
      expect(parsed.data[0]?.bidderLabel).toBe("Buyer #1"); // Kabir's second bid is still Buyer #1
      expect(parsed.data[0]?.isMyBid).toBe(false);
      expect(parsed.data[0]?.isMine).toBe(false);

      expect(parsed.data[1]?.amountPerKg).toBe(5300);
      expect(parsed.data[1]?.bidderLabel).toBe("Buyer #3");
      expect(parsed.data[1]?.isMyBid).toBe(false);
      expect(parsed.data[1]?.isMine).toBe(false);

      expect(parsed.data[2]?.amountPerKg).toBe(5200);
      expect(parsed.data[2]?.bidderLabel).toBe("Buyer #2");
      expect(parsed.data[2]?.isMyBid).toBe(true); // Salam's own bid
      expect(parsed.data[2]?.isMine).toBe(true);

      expect(parsed.data[3]?.amountPerKg).toBe(5100);
      expect(parsed.data[3]?.bidderLabel).toBe("Buyer #1");
      expect(parsed.data[3]?.isMyBid).toBe(false);
      expect(parsed.data[3]?.isMine).toBe(false);

      // STRICT PII CHECK: Ensure buyer IDs, names, organizations or phone numbers are NEVER exposed
      const jsonStr = JSON.stringify(response.body);
      expect(jsonStr).not.toContain(buyerId);
      expect(jsonStr).not.toContain(buyerTwoId);
      expect(jsonStr).not.toContain(buyerThreeId);
      expect(jsonStr).not.toContain("Kabir");
      expect(jsonStr).not.toContain("Salam");
      expect(jsonStr).not.toContain("Tarek");
    });

    it("returns anonymized history with amounts and times only to the farmer (isMyBid false, no PII)", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });

      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      const response = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=farmer"]);

      expect(response.status).toBe(200);
      const parsed = anonymizedBidHistoryResponseSchema.parse(response.body);
      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]?.bidderLabel).toBe("Buyer #1");
      expect(parsed.data[0]?.amountPerKg).toBe(5200);
      expect(parsed.data[0]?.isMyBid).toBe(false);
      expect(parsed.data[0]?.isMine).toBe(false);

      // Verify no PII leak to farmer
      const jsonStr = JSON.stringify(response.body);
      expect(jsonStr).not.toContain(buyerId);
      expect(jsonStr).not.toContain("Kabir");
    });

    it("blocks buyers from viewing bids of non-active listings (404 NOT_FOUND), while allowing the farmer owner", async () => {
      const draftListing = await createSampleListing({
        floorPricePerKg: 5000,
        status: ListingStatus.DRAFT,
      });

      // Buyer receives 404 NOT_FOUND on non-active listing
      const buyerRes = await request(app)
        .get(`/api/v1/listings/${draftListing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"]);

      expect(buyerRes.status).toBe(404);
      expect(buyerRes.body.error.code).toBe("NOT_FOUND");

      // Farmer owner can view their own listing bids
      const farmerRes = await request(app)
        .get(`/api/v1/listings/${draftListing._id}/bids`)
        .set("Cookie", ["accessToken=farmer"]);

      expect(farmerRes.status).toBe(200);
      expect(farmerRes.body.data).toEqual([]);
    });

    it("verifies isMine correctness between two distinct buyers", async () => {
      const listing = await createSampleListing({ floorPricePerKg: 5000, minIncrementPerKg: 100 });

      // Bid 1: buyerOne
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5100 });

      // Bid 2: buyerTwo
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5300 });

      // As buyerOne:
      const resBuyerOne = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"]);

      expect(resBuyerOne.status).toBe(200);
      const dataOne = anonymizedBidHistoryResponseSchema.parse(resBuyerOne.body).data;
      expect(dataOne).toHaveLength(2);
      // Newest first: dataOne[0] is 5300 (buyerTwo), dataOne[1] is 5100 (buyerOne)
      expect(dataOne[0]?.amountPerKg).toBe(5300);
      expect(dataOne[0]?.isMine).toBe(false);
      expect(dataOne[0]?.isMyBid).toBe(false);

      expect(dataOne[1]?.amountPerKg).toBe(5100);
      expect(dataOne[1]?.isMine).toBe(true);
      expect(dataOne[1]?.isMyBid).toBe(true);

      // As buyerTwo:
      const resBuyerTwo = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"]);

      expect(resBuyerTwo.status).toBe(200);
      const dataTwo = anonymizedBidHistoryResponseSchema.parse(resBuyerTwo.body).data;
      expect(dataTwo).toHaveLength(2);
      expect(dataTwo[0]?.amountPerKg).toBe(5300);
      expect(dataTwo[0]?.isMine).toBe(true);
      expect(dataTwo[0]?.isMyBid).toBe(true);

      expect(dataTwo[1]?.amountPerKg).toBe(5100);
      expect(dataTwo[1]?.isMine).toBe(false);
      expect(dataTwo[1]?.isMyBid).toBe(false);

      // As farmer:
      const resFarmer = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=farmer"]);

      expect(resFarmer.status).toBe(200);
      const dataFarmer = anonymizedBidHistoryResponseSchema.parse(resFarmer.body).data;
      expect(dataFarmer[0]?.isMine).toBe(false);
      expect(dataFarmer[1]?.isMine).toBe(false);
    });

    it("allows a buyer who bid on an ended listing to view bid history (200 OK), but rejects non-bidders with 404 NOT_FOUND", async () => {
      const listing = await createSampleListing({
        floorPricePerKg: 5000,
        minIncrementPerKg: 100,
      });

      // buyerOne bids
      await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5200 });

      // Update listing to SOLD
      await Listing.findByIdAndUpdate(listing._id, {
        status: ListingStatus.SOLD,
        closedAt: new Date(),
      });

      // buyerOne (bidder) can view bids
      const bidderRes = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyer"]);

      expect(bidderRes.status).toBe(200);
      const parsed = anonymizedBidHistoryResponseSchema.parse(bidderRes.body);
      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]?.isMine).toBe(true);

      // buyerTwo (non-bidder) gets 404 NOT_FOUND
      const nonBidderRes = await request(app)
        .get(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=buyerTwo"]);

      expect(nonBidderRes.status).toBe(404);
      expect(nonBidderRes.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/v1/bids/mine (Task 5.5)", () => {
    let testCropId: Types.ObjectId;
    let myBidsBuyerId: string;
    let myBidsBuyerTwoId: string;
    let myBidsBuyerThreeId: string;

    beforeEach(async () => {
      myBidsBuyerId = new Types.ObjectId().toString();
      myBidsBuyerTwoId = new Types.ObjectId().toString();
      myBidsBuyerThreeId = new Types.ObjectId().toString();

      sessionUsers.myBuyer = {
        id: myBidsBuyerId,
        role: UserRole.BUYER,
        name: "Buyer Kabir",
        division: "Dhaka",
        district: "Dhaka",
        organization: "Kabir Foods",
        language: "en",
      };
      sessionUsers.myBuyerTwo = {
        id: myBidsBuyerTwoId,
        role: UserRole.BUYER,
        name: "Buyer Salam",
        division: "Chittagong",
        district: "Chittagong",
        organization: "Salam Trading",
        language: "en",
      };
      sessionUsers.myBuyerThree = {
        id: myBidsBuyerThreeId,
        role: UserRole.BUYER,
        name: "Buyer Amin",
        division: "Sylhet",
        district: "Sylhet",
        organization: "Amin Produce",
        language: "en",
      };

      testCropId = new Types.ObjectId();
      await Crop.create({
        _id: testCropId,
        slug: "onion",
        nameEn: "Onion",
        nameBn: "পেঁয়াজ",
        unit: "KG",
        minLotKg: 10,
        maxLotKg: 1000,
        shelfLifeHours: 120,
        gradeGuide: { A: "Dry, firm", B: "Slight blemishes", C: "Irregular size" },
        imageUrl: "/crops/onion.png",
        isActive: true,
      });
    });

    it("rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
      const res = await request(app).get("/api/v1/bids/mine");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects requests from farmers with 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/bids/mine")
        .set("Cookie", ["accessToken=farmer"]);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns empty grouped object when buyer has placed no bids", async () => {
      const res = await request(app)
        .get("/api/v1/bids/mine")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(res.status).toBe(200);
      const parsed = myBidsResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.data).toEqual({
        active: [],
        won: [],
        lost: [],
      });
      expect(typeof res.body.meta.serverTime).toBe("string");
      expect(res.body.meta.total).toBe(0);
    });

    it("returns empty paginated array when group query is specified and buyer has no bids", async () => {
      const res = await request(app)
        .get("/api/v1/bids/mine?group=active&page=1&limit=10")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(res.status).toBe(200);
      const parsed = paginatedMyBidsResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        group: "active",
      });
    });

    it("correctly derives WINNING and OUTBID for active listings, computing gapToCurrentPerKg when outbid", async () => {
      const listing = await createSampleListing({
        cropId: testCropId,
        floorPricePerKg: 5000,
        minIncrementPerKg: 100,
        quantityKg: 50,
      });

      // 1. Buyer Kabir bids 5000 -> Kabir is WINNING
      const b1 = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5000 });
      expect(b1.status).toBe(201);

      const kabirWinningRes = await request(app)
        .get("/api/v1/bids/mine?group=active")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(kabirWinningRes.status).toBe(200);
      expect(kabirWinningRes.body.data).toHaveLength(1);
      const kabirRow1 = kabirWinningRes.body.data[0];
      expect(kabirRow1.status).toBe("WINNING");
      expect(kabirRow1.myBidPerKg).toBe(5000);
      expect(kabirRow1.currentBidPerKg).toBe(5000);
      expect(kabirRow1.gapToCurrentPerKg).toBeNull();
      expect(kabirRow1.gap).toBeNull();
      expect(kabirRow1.orderId).toBeNull();
      expect(kabirRow1.cropNameEn).toBe("Onion");
      expect(kabirRow1.cropNameBn).toBe("পেঁয়াজ");

      // Advance clock slightly
      testClock.advanceBy(5000);

      // 2. Buyer Salam outbids with 5300 -> Salam is WINNING, Kabir is OUTBID
      const b2 = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5300 });
      expect(b2.status).toBe(201);

      // Check Kabir's view (OUTBID)
      const kabirOutbidRes = await request(app)
        .get("/api/v1/bids/mine?group=active")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(kabirOutbidRes.status).toBe(200);
      expect(kabirOutbidRes.body.data).toHaveLength(1);
      const kabirRow2 = kabirOutbidRes.body.data[0];
      expect(kabirRow2.status).toBe("OUTBID");
      expect(kabirRow2.myBidPerKg).toBe(5000);
      expect(kabirRow2.currentBidPerKg).toBe(5300);
      expect(kabirRow2.gapToCurrentPerKg).toBe(300); // 5300 - 5000
      expect(kabirRow2.gap).toBe(300);
      expect(kabirRow2.orderId).toBeNull();

      // Check Salam's view (WINNING)
      const salamWinningRes = await request(app)
        .get("/api/v1/bids/mine?group=active")
        .set("Cookie", ["accessToken=myBuyerTwo"]);

      expect(salamWinningRes.status).toBe(200);
      expect(salamWinningRes.body.data).toHaveLength(1);
      const salamRow = salamWinningRes.body.data[0];
      expect(salamRow.status).toBe("WINNING");
      expect(salamRow.myBidPerKg).toBe(5300);
      expect(salamRow.currentBidPerKg).toBe(5300);
      expect(salamRow.gapToCurrentPerKg).toBeNull();
      expect(salamRow.gap).toBeNull();
      expect(salamRow.orderId).toBeNull();
    });

    it("correctly derives WON with order ID and LOST after listings close", async () => {
      // Listing 1: will be WON by Salam
      const listingWon = await createSampleListing({
        cropId: testCropId,
        floorPricePerKg: 4000,
        minIncrementPerKg: 100,
        quantityKg: 100,
      });

      // Listing 2: will EXPIRE UNSOLD (Kabir bid, but listing expired)
      const listingExpired = await createSampleListing({
        cropId: testCropId,
        floorPricePerKg: 6000,
        minIncrementPerKg: 100,
        quantityKg: 40,
      });

      // Kabir bids on Listing 1 (4000)
      const b1 = await request(app)
        .post(`/api/v1/listings/${listingWon._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4000 });
      expect(b1.status).toBe(201);

      testClock.advanceBy(2000);

      // Salam outbids Kabir on Listing 1 (4500)
      const salamBidRes = await request(app)
        .post(`/api/v1/listings/${listingWon._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4500 });
      expect(salamBidRes.status).toBe(201);
      const salamWinningBidId = salamBidRes.body.data.id;

      // Kabir bids on Listing 2 (6000)
      const b2 = await request(app)
        .post(`/api/v1/listings/${listingExpired._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 6000 });
      expect(b2.status).toBe(201);

      // Close Listing 1 as SOLD to Salam and create Order
      const order = await Order.create({
        listingId: listingWon._id,
        farmerId: new ObjectId(farmerId),
        buyerId: new ObjectId(myBidsBuyerTwoId),
        cropId: testCropId,
        quantityKg: 100,
        grade: CropGrade.A,
        pricePerKg: 4500,
        subtotal: 450000,
        platformFee: 9000,
        farmerNet: 441000,
        status: OrderStatus.CONFIRMED,
      });

      await Listing.findByIdAndUpdate(listingWon._id, {
        status: ListingStatus.SOLD,
        winningBidId: new ObjectId(salamWinningBidId),
        currentBidderId: new ObjectId(myBidsBuyerTwoId),
        closedAt: testClock.now(),
      });

      await Bid.findByIdAndUpdate(salamWinningBidId, { status: "WON" });

      // Close Listing 2 as EXPIRED_UNSOLD
      await Listing.findByIdAndUpdate(listingExpired._id, {
        status: ListingStatus.EXPIRED_UNSOLD,
        closedAt: testClock.now(),
      });

      // Verify Salam's bids: Listing 1 must be in "won" group with orderId
      const salamWonRes = await request(app)
        .get("/api/v1/bids/mine?group=won")
        .set("Cookie", ["accessToken=myBuyerTwo"]);

      expect(salamWonRes.status).toBe(200);
      expect(salamWonRes.body.data).toHaveLength(1);
      const salamWonRow = salamWonRes.body.data[0];
      expect(salamWonRow.status).toBe("WON");
      expect(salamWonRow.listingId).toBe(listingWon._id.toString());
      expect(salamWonRow.orderId).toBe(order._id.toString());
      expect(salamWonRow.myBidPerKg).toBe(4500);

      // Verify Kabir's bids:
      // Kabir has zero won listings
      const kabirWonRes = await request(app)
        .get("/api/v1/bids/mine?group=won")
        .set("Cookie", ["accessToken=myBuyer"]);
      expect(kabirWonRes.status).toBe(200);
      expect(kabirWonRes.body.data).toHaveLength(0);

      // Kabir has 2 lost listings: Listing 1 (sold to Salam) and Listing 2 (expired unsold)
      const kabirLostRes = await request(app)
        .get("/api/v1/bids/mine?group=lost")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(kabirLostRes.status).toBe(200);
      expect(kabirLostRes.body.data).toHaveLength(2);
      expect(kabirLostRes.body.data.every((r: { status: string }) => r.status === "LOST")).toBe(true);
      expect(kabirLostRes.body.data.every((r: { orderId: unknown }) => r.orderId === null)).toBe(true);
    });

    it("deduplicates multiple bids by one buyer on the same listing to exactly one row showing the highest bid", async () => {
      const listing = await createSampleListing({
        cropId: testCropId,
        floorPricePerKg: 3000,
        minIncrementPerKg: 100,
      });

      // Kabir bids 3000 at T1
      const b1 = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3000 });
      expect(b1.status).toBe(201);

      testClock.advanceBy(10000);

      // Salam outbids with 3200
      const b2 = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3200 });
      expect(b2.status).toBe(201);

      testClock.advanceBy(10000);

      // Kabir bids again with 3500 at T2
      const b3 = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3500 });
      expect(b3.status).toBe(201);

      testClock.advanceBy(10000);

      // Salam outbids again with 3700
      const b4 = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3700 });
      expect(b4.status).toBe(201);

      testClock.advanceBy(10000);

      // Kabir bids a third time with 4000 at T3
      const kabirThirdBid = await request(app)
        .post(`/api/v1/listings/${listing._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4000 });
      expect(kabirThirdBid.status).toBe(201);

      // Kabir bid 3 times on this listing. Verify Kabir appears ONCE in /bids/mine
      const res = await request(app)
        .get("/api/v1/bids/mine?group=active")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const row = res.body.data[0];
      expect(row.listingId).toBe(listing._id.toString());
      expect(row.bidId).toBe(kabirThirdBid.body.data.id);
      expect(row.myBidPerKg).toBe(4000);
      expect(row.currentBidPerKg).toBe(4000);
      expect(row.status).toBe("WINNING");
      expect(row.bidCount).toBe(5);
    });

    it("sorts by newest activity first across multiple listings", async () => {
      const listing1 = await createSampleListing({ cropId: testCropId, floorPricePerKg: 3000 });
      const listing2 = await createSampleListing({ cropId: testCropId, floorPricePerKg: 4000 });
      const listing3 = await createSampleListing({ cropId: testCropId, floorPricePerKg: 5000 });

      // 10:00 - Kabir bids on listing 1
      const b1 = await request(app)
        .post(`/api/v1/listings/${listing1._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3000 });
      expect(b1.status).toBe(201);

      testClock.advanceBy(30000); // 10:00:30 - Salam outbids on listing 1
      const bSalam = await request(app)
        .post(`/api/v1/listings/${listing1._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3100 });
      expect(bSalam.status).toBe(201);

      testClock.advanceBy(30000); // 10:01

      // 10:01 - Kabir bids on listing 2
      const b2 = await request(app)
        .post(`/api/v1/listings/${listing2._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4000 });
      expect(b2.status).toBe(201);

      testClock.advanceBy(60000); // 10:02

      // 10:02 - Kabir bids on listing 3
      const b3 = await request(app)
        .post(`/api/v1/listings/${listing3._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 5000 });
      expect(b3.status).toBe(201);

      testClock.advanceBy(60000); // 10:03

      // 10:03 - Kabir places a NEW bid on listing 1 (refreshing Kabir's activity time to 10:03)
      const b4 = await request(app)
        .post(`/api/v1/listings/${listing1._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3300 });
      expect(b4.status).toBe(201);

      // Order should be: listing 1 (10:03), listing 3 (10:02), listing 2 (10:01)
      const res = await request(app)
        .get("/api/v1/bids/mine?group=active")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].listingId).toBe(listing1._id.toString());
      expect(res.body.data[1].listingId).toBe(listing3._id.toString());
      expect(res.body.data[2].listingId).toBe(listing2._id.toString());
    });

    it("strictly isolates buyers so a buyer never sees another buyer's data", async () => {
      const listingKabir = await createSampleListing({ cropId: testCropId, floorPricePerKg: 2000 });
      const listingSalam = await createSampleListing({ cropId: testCropId, floorPricePerKg: 3000 });
      const listingAmin = await createSampleListing({ cropId: testCropId, floorPricePerKg: 4000 });

      // Kabir bids on listingKabir
      const b1 = await request(app)
        .post(`/api/v1/listings/${listingKabir._id}/bids`)
        .set("Cookie", ["accessToken=myBuyer"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 2000 });
      expect(b1.status).toBe(201);

      // Salam bids on listingSalam
      const b2 = await request(app)
        .post(`/api/v1/listings/${listingSalam._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerTwo"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 3000 });
      expect(b2.status).toBe(201);

      // Amin bids on listingAmin
      const b3 = await request(app)
        .post(`/api/v1/listings/${listingAmin._id}/bids`)
        .set("Cookie", ["accessToken=myBuyerThree"])
        .set("X-CSRF-Protection", "1")
        .send({ amountPerKg: 4000 });
      expect(b3.status).toBe(201);

      // 1. Kabir only sees listingKabir
      const kabirRes = await request(app)
        .get("/api/v1/bids/mine")
        .set("Cookie", ["accessToken=myBuyer"]);
      expect(kabirRes.status).toBe(200);
      expect(kabirRes.body.data.active).toHaveLength(1);
      expect(kabirRes.body.data.active[0].listingId).toBe(listingKabir._id.toString());

      // 2. Salam only sees listingSalam
      const salamRes = await request(app)
        .get("/api/v1/bids/mine")
        .set("Cookie", ["accessToken=myBuyerTwo"]);
      expect(salamRes.status).toBe(200);
      expect(salamRes.body.data.active).toHaveLength(1);
      expect(salamRes.body.data.active[0].listingId).toBe(listingSalam._id.toString());

      // 3. Amin only sees listingAmin
      const aminRes = await request(app)
        .get("/api/v1/bids/mine")
        .set("Cookie", ["accessToken=myBuyerThree"]);
      expect(aminRes.status).toBe(200);
      expect(aminRes.body.data.active).toHaveLength(1);
      expect(aminRes.body.data.active[0].listingId).toBe(listingAmin._id.toString());
    });

    it("paginates grouped listings correctly (?group=active&page=X&limit=Y)", async () => {
      // Create 5 active listings and place bids as Kabir
      const listings = [];
      for (let i = 0; i < 5; i++) {
        const l = await createSampleListing({
          cropId: testCropId,
          floorPricePerKg: 3000 + i * 100,
        });
        listings.push(l);
        const b = await request(app)
          .post(`/api/v1/listings/${l._id}/bids`)
          .set("Cookie", ["accessToken=myBuyer"])
          .set("X-CSRF-Protection", "1")
          .send({ amountPerKg: 3000 + i * 100 });
        expect(b.status).toBe(201);
        testClock.advanceBy(1000);
      }

      // Page 1, limit 2
      const page1Res = await request(app)
        .get("/api/v1/bids/mine?group=active&page=1&limit=2")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data).toHaveLength(2);
      expect(page1Res.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
        group: "active",
      });

      // Page 2, limit 2
      const page2Res = await request(app)
        .get("/api/v1/bids/mine?group=active&page=2&limit=2")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data).toHaveLength(2);
      expect(page2Res.body.meta).toMatchObject({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
        group: "active",
      });

      // Page 3, limit 2
      const page3Res = await request(app)
        .get("/api/v1/bids/mine?group=active&page=3&limit=2")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(page3Res.status).toBe(200);
      expect(page3Res.body.data).toHaveLength(1);
      expect(page3Res.body.meta).toMatchObject({
        page: 3,
        limit: 2,
        total: 5,
        totalPages: 3,
        group: "active",
      });

      // Page 4, limit 2 (out of bounds)
      const page4Res = await request(app)
        .get("/api/v1/bids/mine?group=active&page=4&limit=2")
        .set("Cookie", ["accessToken=myBuyer"]);

      expect(page4Res.status).toBe(200);
      expect(page4Res.body.data).toHaveLength(0);
      expect(page4Res.body.meta.total).toBe(5);
    });

    it("rejects invalid query parameters with 400 VALIDATION_ERROR", async () => {
      const invalidGroupRes = await request(app)
        .get("/api/v1/bids/mine?group=unknown")
        .set("Cookie", ["accessToken=myBuyer"]);
      expect(invalidGroupRes.status).toBe(400);
      expect(invalidGroupRes.body.error.code).toBe("VALIDATION_ERROR");

      const invalidPageRes = await request(app)
        .get("/api/v1/bids/mine?page=0")
        .set("Cookie", ["accessToken=myBuyer"]);
      expect(invalidPageRes.status).toBe(400);
      expect(invalidPageRes.body.error.code).toBe("VALIDATION_ERROR");

      const invalidLimitRes = await request(app)
        .get("/api/v1/bids/mine?limit=51")
        .set("Cookie", ["accessToken=myBuyer"]);
      expect(invalidLimitRes.status).toBe(400);
      expect(invalidLimitRes.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
