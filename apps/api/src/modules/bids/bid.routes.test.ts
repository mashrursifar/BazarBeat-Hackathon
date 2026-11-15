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
  bidTooLowDetailsSchema,
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
import { IdempotencyRecord } from "./idempotency-record.model.js";

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
  await Promise.all([Listing.init(), Bid.init(), User.init(), IdempotencyRecord.init()]);
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
});
