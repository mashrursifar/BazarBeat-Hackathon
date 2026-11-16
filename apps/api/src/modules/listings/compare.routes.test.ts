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
  calculateSubtotal,
  compareResponseSchema,
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
const potatoCropId = new ObjectId().toString();

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

  await Crop.create([
    {
      _id: new ObjectId(onionCropId),
      slug: "onion",
      nameEn: "Onion",
      nameBn: "পেঁয়াজ",
      unit: "KG",
      shelfLifeHours: 720,
      minLotKg: 10,
      maxLotKg: 2000,
      minIncrementPerKg: 100,
      imageUrl: "https://example.com/onion.jpg",
      gradeGuide: { A: "Clean, dry", B: "Minor blemishes", C: "Mixed" },
      isActive: true,
    },
    {
      _id: new ObjectId(potatoCropId),
      slug: "potato",
      nameEn: "Potato",
      nameBn: "আলু",
      unit: "KG",
      shelfLifeHours: 1440,
      minLotKg: 20,
      maxLotKg: 5000,
      minIncrementPerKg: 100,
      imageUrl: "https://example.com/potato.jpg",
      gradeGuide: { A: "Clean", B: "Minor cuts", C: "Small" },
      isActive: true,
    },
  ]);
});

afterEach(() => {
  resetClock();
});

function createListingDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const defaultStartsAt = new Date("2026-11-14T09:00:00.000Z");
  const defaultEndsAt = new Date("2026-11-14T15:00:00.000Z");

  return {
    farmerId: new ObjectId(farmerId),
    cropId: new ObjectId(onionCropId),
    quantityKg: 100,
    floorPricePerKg: 4000,
    minIncrementPerKg: 100,
    bidCount: 0,
    startsAt: defaultStartsAt,
    endsAt: defaultEndsAt,
    originalEndsAt: defaultEndsAt,
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    location: {
      division: "Dhaka",
      district: "Gazipur",
      upazila: "Sreepur",
    },
    pickupNote: "Secret farmer warehouse pickup note",
    images: [
      {
        url: "https://example.com/photo1.jpg",
        width: 1200,
        height: 900,
      },
    ],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.94,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.94, B: 0.05, C: 0.01 },
      qualityNotes: ["Uniform size", "Dry neck"],
      cropMatch: true,
      modelVersion: "mock-v1",
      provider: "mock",
      degraded: false,
      assessedAt: defaultStartsAt,
    },
    aiPriceGuidance: {
      lowPerKg: 3800,
      expectedPerKg: 4500,
      highPerKg: 5200,
      trend: "UP",
      confidence: 0.88,
      explanation: ["High seasonal demand"],
      modelVersion: "mock-v1",
      provider: "mock",
      degraded: false,
      generatedAt: defaultStartsAt,
      suggestedFloorPerKg: 4000,
    },
    ...overrides,
  };
}

describe("GET /api/v1/listings/compare", () => {
  it("enforces authentication (401) and buyer role (403 for farmers)", async () => {
    const listing1 = await Listing.create(createListingDoc());
    const listing2 = await Listing.create(createListingDoc());

    // Unauthenticated -> 401
    const unauthResponse = await request(app).get(
      `/api/v1/listings/compare?ids=${listing1._id.toString()},${listing2._id.toString()}`,
    );
    expect(unauthResponse.status).toBe(401);
    expect(unauthResponse.body.error.code).toBe("UNAUTHENTICATED");

    // Farmer role -> 403
    const farmerResponse = await request(app)
      .get(`/api/v1/listings/compare?ids=${listing1._id.toString()},${listing2._id.toString()}`)
      .set("Cookie", ["accessToken=farmer"]);
    expect(farmerResponse.status).toBe(403);
    expect(farmerResponse.body.error.code).toBe("FORBIDDEN");

    // Buyer role -> 200
    const buyerResponse = await request(app)
      .get(`/api/v1/listings/compare?ids=${listing1._id.toString()},${listing2._id.toString()}`)
      .set("Cookie", ["accessToken=buyerOne"]);
    expect(buyerResponse.status).toBe(200);
  });

  describe("Limit validation (1 and 5 IDs)", () => {
    it("rejects request with 1 ID with 400 VALIDATION_ERROR", async () => {
      const listing1 = await Listing.create(createListingDoc());

      const res = await request(app)
        .get(`/api/v1/listings/compare?ids=${listing1._id.toString()}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects request with 5 IDs with 400 VALIDATION_ERROR", async () => {
      const ids = Array.from({ length: 5 }, () => new ObjectId().toString());

      const res = await request(app)
        .get(`/api/v1/listings/compare?ids=${ids.join(",")}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Duplicate IDs validation", () => {
    it("rejects request with duplicate IDs with 400 VALIDATION_ERROR", async () => {
      const id1 = new ObjectId().toString();

      const res = await request(app)
        .get(`/api/v1/listings/compare?ids=${id1},${id1}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects request when duplicates are mixed with another ID with 400 VALIDATION_ERROR", async () => {
      const id1 = new ObjectId().toString();
      const id2 = new ObjectId().toString();

      const res = await request(app)
        .get(`/api/v1/listings/compare?ids=${id1},${id2},${id1}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Mixed crops check (COMPARE_MIXED_CROPS)", () => {
    it("returns 400 COMPARE_MIXED_CROPS when visible listings belong to different crops", async () => {
      const onionListing = await Listing.create(
        createListingDoc({ cropId: new ObjectId(onionCropId) }),
      );
      const potatoListing = await Listing.create(
        createListingDoc({ cropId: new ObjectId(potatoCropId) }),
      );

      const res = await request(app)
        .get(
          `/api/v1/listings/compare?ids=${onionListing._id.toString()},${potatoListing._id.toString()}`,
        )
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("COMPARE_MIXED_CROPS");
    });
  });

  describe("Highlight ties", () => {
    it("correctly calculates highlights and handles ties across all signals", async () => {
      // Listing 1: Grade A, 100kg, displayPrice 4000 (floor), expected 4000 (ratio 4000/4000 = 1.0)
      const listing1 = await Listing.create(
        createListingDoc({
          floorPricePerKg: 4000,
          quantityKg: 100,
          aiAssessment: {
            grade: CropGrade.A,
            confidence: 0.9,
            classProbabilities: { A: 0.9, B: 0.1, C: 0 },
            qualityNotes: ["Grade A"],
            cropMatch: true,
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            assessedAt: new Date(),
          },
          aiPriceGuidance: {
            lowPerKg: 3500,
            expectedPerKg: 4000,
            highPerKg: 4500,
            trend: "FLAT",
            confidence: 0.9,
            explanation: [],
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            generatedAt: new Date(),
            suggestedFloorPerKg: 3800,
          },
        }),
      );

      // Listing 2: Grade A (ties grade), 100kg (ties qty), displayPrice 4000 (ties lowest price), expected 4000 (ties best value ratio)
      const listing2 = await Listing.create(
        createListingDoc({
          floorPricePerKg: 4000,
          quantityKg: 100,
          aiAssessment: {
            grade: CropGrade.A,
            confidence: 0.9,
            classProbabilities: { A: 0.9, B: 0.1, C: 0 },
            qualityNotes: ["Grade A"],
            cropMatch: true,
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            assessedAt: new Date(),
          },
          aiPriceGuidance: {
            lowPerKg: 3500,
            expectedPerKg: 4000,
            highPerKg: 4500,
            trend: "FLAT",
            confidence: 0.9,
            explanation: [],
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            generatedAt: new Date(),
            suggestedFloorPerKg: 3800,
          },
        }),
      );

      // Listing 3: Grade B, 50kg, displayPrice 4500, expected 4000 (ratio 4500/4000 = 1.125)
      const listing3 = await Listing.create(
        createListingDoc({
          floorPricePerKg: 4500,
          quantityKg: 50,
          aiAssessment: {
            grade: CropGrade.B,
            confidence: 0.8,
            classProbabilities: { A: 0.1, B: 0.8, C: 0.1 },
            qualityNotes: ["Grade B"],
            cropMatch: true,
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            assessedAt: new Date(),
          },
          aiPriceGuidance: {
            lowPerKg: 3500,
            expectedPerKg: 4000,
            highPerKg: 4500,
            trend: "FLAT",
            confidence: 0.9,
            explanation: [],
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            generatedAt: new Date(),
            suggestedFloorPerKg: 3800,
          },
        }),
      );

      const id1 = listing1._id.toString();
      const id2 = listing2._id.toString();
      const id3 = listing3._id.toString();

      const res = await request(app)
        .get(`/api/v1/listings/compare?ids=${id1},${id2},${id3}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      const parsedEnvelope = compareResponseSchema.safeParse(res.body);
      expect(parsedEnvelope.success).toBe(true);

      const data = res.body.data;
      expect(data.listings).toHaveLength(3);

      // Verify lowest price tie: listings 1 and 2 tie at 4000
      expect(data.highlights.lowestPriceListingIds).toContain(id1);
      expect(data.highlights.lowestPriceListingIds).toContain(id2);
      expect(data.highlights.lowestPriceListingIds).not.toContain(id3);
      expect(data.highlights.byListingId[id1].isLowestPrice).toBe(true);
      expect(data.highlights.byListingId[id2].isLowestPrice).toBe(true);
      expect(data.highlights.byListingId[id3].isLowestPrice).toBe(false);

      // Verify best grade tie: listings 1 and 2 tie at Grade A
      expect(data.highlights.bestGradeListingIds).toContain(id1);
      expect(data.highlights.bestGradeListingIds).toContain(id2);
      expect(data.highlights.bestGradeListingIds).not.toContain(id3);
      expect(data.highlights.byListingId[id1].isBestGrade).toBe(true);
      expect(data.highlights.byListingId[id2].isBestGrade).toBe(true);
      expect(data.highlights.byListingId[id3].isBestGrade).toBe(false);

      // Verify largest quantity tie: listings 1 and 2 tie at 100kg
      expect(data.highlights.largestQuantityListingIds).toContain(id1);
      expect(data.highlights.largestQuantityListingIds).toContain(id2);
      expect(data.highlights.largestQuantityListingIds).not.toContain(id3);
      expect(data.highlights.byListingId[id1].isLargestQuantity).toBe(true);
      expect(data.highlights.byListingId[id2].isLargestQuantity).toBe(true);
      expect(data.highlights.byListingId[id3].isLargestQuantity).toBe(false);

      // Verify best value tie: listings 1 and 2 tie at ratio 1.0 (100%)
      expect(data.highlights.bestValueListingIds).toContain(id1);
      expect(data.highlights.bestValueListingIds).toContain(id2);
      expect(data.highlights.bestValueListingIds).not.toContain(id3);
      expect(data.highlights.byListingId[id1].isBestValue).toBe(true);
      expect(data.highlights.byListingId[id2].isBestValue).toBe(true);
      expect(data.highlights.byListingId[id3].isBestValue).toBe(false);

      // Check per-listing highlights property matches
      const item1 = data.listings.find((l: { id: string }) => l.id === id1);
      expect(item1.highlights.isLowestPrice).toBe(true);
      expect(item1.highlights.isBestGrade).toBe(true);
      expect(item1.highlights.isLargestQuantity).toBe(true);
      expect(item1.highlights.isBestValue).toBe(true);
    });
  });

  describe("Ended listings visibility and highlights", () => {
    it("returns ended listing with its status and no highlights when buyer bid on it", async () => {
      const activeListing = await Listing.create(
        createListingDoc({ floorPricePerKg: 3500, quantityKg: 80 }),
      );

      // Ended listing (SOLD)
      const endedListing = await Listing.create(
        createListingDoc({
          status: ListingStatus.SOLD,
          floorPricePerKg: 3000,
          currentBidPerKg: 3200,
          bidCount: 1,
          quantityKg: 150,
          aiAssessment: {
            grade: CropGrade.A,
            confidence: 0.95,
            classProbabilities: { A: 0.95, B: 0.05, C: 0 },
            qualityNotes: ["Best grade"],
            cropMatch: true,
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            assessedAt: new Date(),
          },
        }),
      );

      // BuyerOne placed a bid on endedListing
      await Bid.create({
        listingId: endedListing._id,
        buyerId: new ObjectId(buyerOneId),
        bidderLabel: "Buyer #1",
        amountPerKg: 3200,
        totalAmount: 3200 * 150,
        seq: 1,
        status: "WON",
        placedAt: new Date("2026-11-14T09:30:00.000Z"),
      });

      const res = await request(app)
        .get(
          `/api/v1/listings/compare?ids=${activeListing._id.toString()},${endedListing._id.toString()}`,
        )
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.listings).toHaveLength(2);
      expect(data.missingIds).toHaveLength(0);

      const activeItem = data.listings.find(
        (l: { id: string }) => l.id === activeListing._id.toString(),
      );
      const endedItem = data.listings.find(
        (l: { id: string }) => l.id === endedListing._id.toString(),
      );

      expect(activeItem.status).toBe(ListingStatus.ACTIVE);
      expect(endedItem.status).toBe(ListingStatus.SOLD);

      // Ended listings must NEVER receive highlights, even if their values are numerically better
      expect(endedItem.highlights.isLowestPrice).toBe(false);
      expect(endedItem.highlights.isBestGrade).toBe(false);
      expect(endedItem.highlights.isLargestQuantity).toBe(false);
      expect(endedItem.highlights.isBestValue).toBe(false);

      // Ended listing has timeLeftSeconds = 0
      expect(endedItem.timeLeftSeconds).toBe(0);

      // Active listing receives the active highlights
      expect(activeItem.highlights.isLowestPrice).toBe(true);
      expect(activeItem.highlights.isLargestQuantity).toBe(true);
      expect(activeItem.timeLeftSeconds).toBeGreaterThan(0);
    });
  });

  describe("Hidden listings reported as missing", () => {
    it("reports non-existent, DRAFT, and unbid ended listings in missingIds", async () => {
      // 1. Visible active listing
      const activeListing = await Listing.create(createListingDoc());

      // 2. DRAFT listing (hidden from buyers)
      const draftListing = await Listing.create(
        createListingDoc({ status: ListingStatus.DRAFT }),
      );

      // 3. Ended listing (EXPIRED_UNSOLD) with NO bids from buyerOne (hidden from buyerOne)
      const unbidEndedListing = await Listing.create(
        createListingDoc({ status: ListingStatus.EXPIRED_UNSOLD }),
      );

      // 4. Non-existent listing ID
      const nonExistentId = new ObjectId().toString();

      const res = await request(app)
        .get(
          `/api/v1/listings/compare?ids=${activeListing._id.toString()},${draftListing._id.toString()},${unbidEndedListing._id.toString()},${nonExistentId}`,
        )
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.listings).toHaveLength(1);
      expect(data.listings[0].id).toBe(activeListing._id.toString());

      // All 3 non-visible / missing IDs are listed in missingIds
      expect(data.missingIds).toHaveLength(3);
      expect(data.missingIds).toContain(draftListing._id.toString());
      expect(data.missingIds).toContain(unbidEndedListing._id.toString());
      expect(data.missingIds).toContain(nonExistentId);
    });

    it("handles case where all requested listings are missing or non-visible", async () => {
      const nonExistentId1 = new ObjectId().toString();
      const nonExistentId2 = new ObjectId().toString();

      const res = await request(app)
        .get(`/api/v1/listings/compare?ids=${nonExistentId1},${nonExistentId2}`)
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.listings).toHaveLength(0);
      expect(data.missingIds).toEqual([nonExistentId1, nonExistentId2]);
      expect(data.cropId).toBeNull();
    });
  });

  describe("Total cost rounding and return fields", () => {
    it("rounds total cost to integer poisha using shared calculateSubtotal and returns all required fields", async () => {
      // Display price: 4555 poisha/kg, Quantity: 12.3 kg
      // Math: 4555 * 12.3 = 56026.5 -> rounds to 56027
      const expectedTotal = calculateSubtotal(4555, 12.3);
      expect(expectedTotal).toBe(56027);

      const listing1 = await Listing.create(
        createListingDoc({
          floorPricePerKg: 4555,
          quantityKg: 12.3,
          location: {
            division: "Rajshahi",
            district: "Bogra",
            upazila: "Sariakandi",
          },
          aiPriceGuidance: {
            lowPerKg: 4000,
            expectedPerKg: 5000,
            highPerKg: 6000,
            trend: "UP",
            confidence: 0.9,
            explanation: ["Test"],
            modelVersion: "m",
            provider: "mock",
            degraded: false,
            generatedAt: new Date(),
            suggestedFloorPerKg: 4200,
          },
        }),
      );

      const listing2 = await Listing.create(
        createListingDoc({
          floorPricePerKg: 4000,
          quantityKg: 50,
          location: {
            division: "Dhaka",
            district: "Gazipur",
          },
        }),
      );

      const res = await request(app)
        .get(
          `/api/v1/listings/compare?ids=${listing1._id.toString()},${listing2._id.toString()}`,
        )
        .set("Cookie", ["accessToken=buyerOne"]);

      expect(res.status).toBe(200);

      const item1 = res.body.data.listings.find(
        (l: { id: string }) => l.id === listing1._id.toString(),
      );

      // Total cost rounding verification
      expect(item1.displayPricePerKg).toBe(4555);
      expect(item1.quantityKg).toBe(12.3);
      expect(item1.displayTotalCost).toBe(56027);
      expect(item1.totalDisplayCost).toBe(56027);
      expect(Number.isInteger(item1.displayTotalCost)).toBe(true);

      // Card data
      expect(item1.card).toBeDefined();
      expect(item1.card.id).toBe(listing1._id.toString());
      expect(item1.card.crop.nameEn).toBe("Onion");
      expect(item1.cropNameEn).toBe("Onion");
      expect(item1.cropNameBn).toBe("পেঁয়াজ");

      // Grade
      expect(item1.grade).toBe(CropGrade.A);

      // Time left
      expect(typeof item1.timeLeftSeconds).toBe("number");
      expect(item1.timeLeftSeconds).toBeGreaterThan(0);

      // Farmer region (location limited to division/district; upazila stripped for privacy)
      expect(item1.farmerRegion).toBe("Rajshahi");
      expect(item1.location.division).toBe("Rajshahi");
      expect(item1.location.district).toBe("Bogra");
      expect(item1.location.upazila).toBeUndefined();

      // Verify internal AI price guidance and sensitive fields are not leaked
      expect(item1.aiPriceGuidance).toBeUndefined();
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain("suggestedFloorPerKg");
      expect(rawBody).not.toContain("pickupNote");
      expect(rawBody).not.toContain("farmerId");

      // AI range: lowPerKg, expectedPerKg, highPerKg
      expect(item1.aiRange).toEqual({
        lowPerKg: 4000,
        expectedPerKg: 5000,
        highPerKg: 6000,
      });

      // Percentage versus AI expected price: (4555 / 5000) * 100 = 91.1% -> 91%
      expect(item1.percentageVsAiExpected).toBe(91);

      // Highlights flags
      expect(item1.highlights).toBeDefined();
      expect(typeof item1.highlights.isLowestPrice).toBe("boolean");
      expect(typeof item1.highlights.isBestGrade).toBe("boolean");
      expect(typeof item1.highlights.isLargestQuantity).toBe("boolean");
      expect(typeof item1.highlights.isBestValue).toBe("boolean");
    });
  });
});
