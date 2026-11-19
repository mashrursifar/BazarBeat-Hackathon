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
  marketplaceListingListResponseSchema,
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
import { Listing } from "./listing.model.js";

const farmerId = new ObjectId().toString();
const buyerId = new ObjectId().toString();
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
  buyer: {
    id: buyerId,
    role: UserRole.BUYER,
    name: "Buyer Karim",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
};

let mongoServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Crop.init(), Listing.init()]);

  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (!user) throw new Error("Unexpected test access token");
    return user;
  });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) await mongoServer.stop();
});

afterEach(() => {
  resetClock();
});

describe("GET /api/v1/listings (Marketplace list endpoint)", () => {
  const baseTime = new Date("2026-11-14T10:00:00.000Z");

  beforeEach(async () => {
    setClock(new TestClock(baseTime));
    await Promise.all([Crop.deleteMany({}), Listing.deleteMany({})]);

    await Crop.create([
      {
        _id: onionCropId,
        slug: "onion",
        nameEn: "Onion",
        nameBn: "পেঁয়াজ",
        unit: "KG",
        minLotKg: 10,
        maxLotKg: 2000,
        shelfLifeHours: 720,
        gradeGuide: { A: "Firm bulbs", B: "Minor marks", C: "Uneven" },
        minIncrementPerKg: 100,
        imageUrl: "/images/crops/onion.svg",
        isActive: true,
      },
      {
        _id: potatoCropId,
        slug: "potato",
        nameEn: "Potato",
        nameBn: "আলু",
        unit: "KG",
        minLotKg: 10,
        maxLotKg: 2000,
        shelfLifeHours: 720,
        gradeGuide: { A: "Clean tubers", B: "Minor scuffs", C: "Small tubers" },
        minIncrementPerKg: 100,
        imageUrl: "/images/crops/potato.svg",
        isActive: true,
      },
    ]);
  });

  function createListingData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      farmerId: new ObjectId(farmerId),
      cropId: new ObjectId(onionCropId),
      quantityKg: 100,
      images: [{ url: "/uploads/img1.jpg", width: 800, height: 600 }],
      aiAssessment: {
        grade: CropGrade.A,
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
        qualityNotes: ["Firm skin", "Grade A standard"],
        cropMatch: true,
        modelVersion: "mock-v1",
        provider: "mock",
        degraded: false,
        assessedAt: new Date(baseTime.getTime() - 3600_000),
        imageHashes: ["hash1"],
      },
      aiPriceGuidance: {
        lowPerKg: 4000,
        expectedPerKg: 5000,
        highPerKg: 6000,
        trend: "UP",
        confidence: 0.9,
        explanation: ["High seasonal demand"],
        modelVersion: "mock-v1",
        provider: "mock",
        degraded: false,
        generatedAt: new Date(baseTime.getTime() - 3600_000),
        suggestedFloorPerKg: 4200,
      },
      floorPricePerKg: 4200,
      minIncrementPerKg: 100,
      startsAt: new Date(baseTime.getTime() - 1800_000),
      endsAt: new Date(baseTime.getTime() + 7200_000), // +2h
      originalEndsAt: new Date(baseTime.getTime() + 7200_000),
      extensionCount: 0,
      status: ListingStatus.ACTIVE,
      bidCount: 0,
      location: {
        division: "dhaka",
        district: "gazipur",
        upazila: "kaliganj",
      },
      pickupNote: "Secret gate code: 1234",
      ...overrides,
    };
  }

  describe("Authentication & Role Authorization", () => {
    it("allows anonymous unauthenticated users with 200 OK", async () => {
      const response = await request(app).get("/api/v1/listings");
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.serverTime).toBe(baseTime.toISOString());
    });

    it("allows farmers with 200 OK", async () => {
      const response = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", "accessToken=farmer");
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.serverTime).toBe(baseTime.toISOString());
    });

    it("allows authenticated buyers with 200 OK", async () => {
      const response = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", "accessToken=buyer");
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.serverTime).toBe(baseTime.toISOString());
    });
  });

  describe("Status validation", () => {
    it("rejects non-ACTIVE status queries with 400 VALIDATION_ERROR", async () => {
      for (const nonActiveStatus of ["SOLD", "EXPIRED_UNSOLD", "CANCELLED", "DRAFT"]) {
        const response = await request(app)
          .get(`/api/v1/listings?status=${nonActiveStatus}`)
          .set("Cookie", "accessToken=buyer");
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("accepts status=ACTIVE explicitly", async () => {
      await Listing.create(createListingData());
      const response = await request(app)
        .get("/api/v1/listings?status=ACTIVE")
        .set("Cookie", "accessToken=buyer");
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe("Exclusion of non-active and expired-but-open listings", () => {
    it("excludes non-active listings and expired-but-open listings", async () => {
      // 1. Valid ACTIVE listing
      await Listing.create(createListingData({ endsAt: new Date(baseTime.getTime() + 3600_000) }));

      // 2. SOLD listing
      await Listing.create(createListingData({ status: ListingStatus.SOLD }));

      // 3. EXPIRED_UNSOLD listing
      await Listing.create(createListingData({ status: ListingStatus.EXPIRED_UNSOLD }));

      // 4. CANCELLED listing
      await Listing.create(createListingData({ status: ListingStatus.CANCELLED }));

      // 5. Expired-but-open listing: status is ACTIVE, but endsAt has passed (endsAt <= now)
      await Listing.create(
        createListingData({
          status: ListingStatus.ACTIVE,
          endsAt: new Date(baseTime.getTime() - 1000), // 1 second in the past
        }),
      );

      const response = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.meta.total).toBe(1);
    });
  });

  describe("Privacy & DTO shape verification", () => {
    it("returns buyer card conforming to schema with NO private fields exposed", async () => {
      await Listing.create(
        createListingData({
          pickupNote: "Super secret pickup instructions",
          currentBidPerKg: 4500,
          currentBidderId: new ObjectId(buyerId),
          bidCount: 2,
        }),
      );

      const response = await request(app)
        .get("/api/v1/listings")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      const parsed = marketplaceListingListResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const card = response.body.data[0];
      // Required fields
      expect(card.id).toBeDefined();
      expect(card.crop.nameEn).toBe("Onion");
      expect(card.grade).toBe(CropGrade.A);
      expect(card.quantityKg).toBe(100);
      expect(card.floorPricePerKg).toBe(4200);
      expect(card.currentBidPerKg).toBe(4500);
      expect(card.displayPricePerKg).toBe(4500);
      expect(card.totalDisplayCost).toBe(450000);
      expect(card.hasBids).toBe(true);
      expect(card.bidCount).toBe(2);
      expect(card.endsAt).toBeDefined();
      expect(card.thumbnailUrl).toBe("/uploads/img1.jpg");
      expect(card.location).toEqual({ division: "dhaka", district: "gazipur" });

      // Strict privacy assertions: private fields MUST NOT exist
      expect(card.farmerId).toBeUndefined();
      expect(card.currentBidderId).toBeUndefined();
      expect(card.winningBidId).toBeUndefined();
      expect(card.pickupNote).toBeUndefined();
      expect(card.phone).toBeUndefined();
      expect(card.location.upazila).toBeUndefined();
      expect(card.aiAssessment).toBeUndefined();
      expect(card.aiPriceGuidance).toBeUndefined();
    });
  });

  describe("Filters", () => {
    it("filters by cropId", async () => {
      await Listing.create(createListingData({ cropId: new ObjectId(onionCropId) }));
      await Listing.create(createListingData({ cropId: new ObjectId(potatoCropId) }));

      const response = await request(app)
        .get(`/api/v1/listings?cropId=${onionCropId}`)
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].crop.slug).toBe("onion");
    });

    it("filters by crop slug and English name case-insensitively", async () => {
      await Listing.create(createListingData({ cropId: new ObjectId(onionCropId) }));
      await Listing.create(createListingData({ cropId: new ObjectId(potatoCropId) }));

      const resSlug = await request(app)
        .get("/api/v1/listings?crop=onion")
        .set("Cookie", "accessToken=buyer");
      expect(resSlug.status).toBe(200);
      expect(resSlug.body.data.length).toBe(1);
      expect(resSlug.body.data[0].crop.slug).toBe("onion");

      const resName = await request(app)
        .get("/api/v1/listings?crop=Potato")
        .set("Cookie", "accessToken=buyer");
      expect(resName.status).toBe(200);
      expect(resName.body.data.length).toBe(1);
      expect(resName.body.data[0].crop.slug).toBe("potato");
    });

    it("filters by grade (A, B, C)", async () => {
      await Listing.create(createListingData({ "aiAssessment.grade": CropGrade.A }));
      await Listing.create(createListingData({ "aiAssessment.grade": CropGrade.B }));

      const response = await request(app)
        .get("/api/v1/listings?grade=B")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].grade).toBe(CropGrade.B);
    });

    it("filters by division and district case-insensitively", async () => {
      await Listing.create(
        createListingData({
          location: { division: "dhaka", district: "gazipur" },
        }),
      );
      await Listing.create(
        createListingData({
          location: { division: "chattogram", district: "cumilla" },
        }),
      );

      const resDiv = await request(app)
        .get("/api/v1/listings?division=Dhaka")
        .set("Cookie", "accessToken=buyer");
      expect(resDiv.status).toBe(200);
      expect(resDiv.body.data.length).toBe(1);
      expect(resDiv.body.data[0].location.division).toBe("dhaka");

      const resDist = await request(app)
        .get("/api/v1/listings?division=dhaka&district=gazipur")
        .set("Cookie", "accessToken=buyer");
      expect(resDist.status).toBe(200);
      expect(resDist.body.data.length).toBe(1);
      expect(resDist.body.data[0].location.district).toBe("gazipur");
    });

    it("filters by minQuantity and minQty alias", async () => {
      await Listing.create(createListingData({ quantityKg: 50 }));
      await Listing.create(createListingData({ quantityKg: 200 }));

      const resMinQty = await request(app)
        .get("/api/v1/listings?minQty=100")
        .set("Cookie", "accessToken=buyer");
      expect(resMinQty.status).toBe(200);
      expect(resMinQty.body.data.length).toBe(1);
      expect(resMinQty.body.data[0].quantityKg).toBe(200);

      const resMinQuantity = await request(app)
        .get("/api/v1/listings?minQuantity=100")
        .set("Cookie", "accessToken=buyer");
      expect(resMinQuantity.status).toBe(200);
      expect(resMinQuantity.body.data.length).toBe(1);
    });

    it("filters by minPrice and maxPrice on effective display price", async () => {
      // Listing 1: floor 3000, no bids -> display price 3000
      await Listing.create(createListingData({ floorPricePerKg: 3000, bidCount: 0 }));

      // Listing 2: floor 3000, currentBid 4500, bidCount 1 -> display price 4500
      await Listing.create(
        createListingData({ floorPricePerKg: 3000, currentBidPerKg: 4500, bidCount: 1 }),
      );

      // Listing 3: floor 6000, no bids -> display price 6000
      await Listing.create(createListingData({ floorPricePerKg: 6000, bidCount: 0 }));

      const response = await request(app)
        .get("/api/v1/listings?minPrice=4000&maxPrice=5000")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].displayPricePerKg).toBe(4500);
    });

    it("filters by endingWithin preset (1, 3, 6, 24 hours)", async () => {
      // Ending in 30 minutes (within 1h)
      await Listing.create(
        createListingData({ endsAt: new Date(baseTime.getTime() + 1800_000) }),
      );

      // Ending in 2 hours (within 3h, not within 1h)
      await Listing.create(
        createListingData({ endsAt: new Date(baseTime.getTime() + 7200_000) }),
      );

      // Ending in 10 hours (within 24h, not within 6h)
      await Listing.create(
        createListingData({ endsAt: new Date(baseTime.getTime() + 36000_000) }),
      );

      const res1h = await request(app)
        .get("/api/v1/listings?endingWithin=1")
        .set("Cookie", "accessToken=buyer");
      expect(res1h.body.data.length).toBe(1);

      const res3h = await request(app)
        .get("/api/v1/listings?endingWithin=3")
        .set("Cookie", "accessToken=buyer");
      expect(res3h.body.data.length).toBe(2);

      const res24h = await request(app)
        .get("/api/v1/listings?endingWithin=24")
        .set("Cookie", "accessToken=buyer");
      expect(res24h.body.data.length).toBe(3);
    });

    it("applies combined filters correctly", async () => {
      // Match all
      await Listing.create(
        createListingData({
          cropId: new ObjectId(onionCropId),
          "aiAssessment.grade": CropGrade.A,
          location: { division: "dhaka", district: "gazipur" },
          quantityKg: 150,
          floorPricePerKg: 4000,
          endsAt: new Date(baseTime.getTime() + 3600_000), // 1h
        }),
      );

      // Mismatched grade (B)
      await Listing.create(
        createListingData({
          cropId: new ObjectId(onionCropId),
          "aiAssessment.grade": CropGrade.B,
          location: { division: "dhaka", district: "gazipur" },
          quantityKg: 150,
          floorPricePerKg: 4000,
        }),
      );

      const response = await request(app)
        .get(
          `/api/v1/listings?crop=onion&grade=A&division=dhaka&district=gazipur&minQty=100&minPrice=3000&maxPrice=5000&endingWithin=3`,
        )
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe("Sorting with deterministic tie-breaking", () => {
    it("sorts by ending-soonest (endsAt ascending)", async () => {
      const l1 = await Listing.create(
        createListingData({ endsAt: new Date(baseTime.getTime() + 10_000_000) }),
      );
      const l2 = await Listing.create(
        createListingData({ endsAt: new Date(baseTime.getTime() + 2_000_000) }),
      );
      const l3 = await Listing.create(
        createListingData({ endsAt: new Date(baseTime.getTime() + 5_000_000) }),
      );

      const response = await request(app)
        .get("/api/v1/listings?sort=ending-soonest")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      const ids = response.body.data.map((item: { id: string }) => item.id);
      expect(ids).toEqual([l2._id.toString(), l3._id.toString(), l1._id.toString()]);
    });

    it("sorts by lowest-price (displayPricePerKg ascending)", async () => {
      // 5500
      await Listing.create(createListingData({ floorPricePerKg: 5500, bidCount: 0 }));
      // 3000
      await Listing.create(createListingData({ floorPricePerKg: 3000, bidCount: 0 }));
      // 4000 (floor 2000, bid 4000)
      await Listing.create(
        createListingData({ floorPricePerKg: 2000, currentBidPerKg: 4000, bidCount: 1 }),
      );

      const response = await request(app)
        .get("/api/v1/listings?sort=lowest-price")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      const prices = response.body.data.map(
        (item: { displayPricePerKg: number }) => item.displayPricePerKg,
      );
      expect(prices).toEqual([3000, 4000, 5500]);
    });

    it("sorts by highest-grade (A over B over C)", async () => {
      await Listing.create(createListingData({ "aiAssessment.grade": CropGrade.C }));
      await Listing.create(createListingData({ "aiAssessment.grade": CropGrade.A }));
      await Listing.create(createListingData({ "aiAssessment.grade": CropGrade.B }));

      const response = await request(app)
        .get("/api/v1/listings?sort=highest-grade")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      const grades = response.body.data.map((item: { grade: string }) => item.grade);
      expect(grades).toEqual(["A", "B", "C"]);
    });

    it("sorts by newest (createdAt descending)", async () => {
      const l1 = await Listing.create(
        createListingData({ createdAt: new Date("2026-11-14T08:00:00Z") }),
      );
      const l2 = await Listing.create(
        createListingData({ createdAt: new Date("2026-11-14T09:30:00Z") }),
      );
      const l3 = await Listing.create(
        createListingData({ createdAt: new Date("2026-11-14T09:00:00Z") }),
      );

      const response = await request(app)
        .get("/api/v1/listings?sort=newest")
        .set("Cookie", "accessToken=buyer");

      expect(response.status).toBe(200);
      const ids = response.body.data.map((item: { id: string }) => item.id);
      expect(ids).toEqual([l2._id.toString(), l3._id.toString(), l1._id.toString()]);
    });
  });

  describe("Pagination", () => {
    it("handles pagination boundaries and limits properly", async () => {
      // Create 5 listings
      for (let i = 1; i <= 5; i++) {
        await Listing.create(
          createListingData({
            floorPricePerKg: 3000 + i * 100,
            endsAt: new Date(baseTime.getTime() + i * 3600_000),
          }),
        );
      }

      // Page 1, limit 2
      const page1 = await request(app)
        .get("/api/v1/listings?page=1&limit=2")
        .set("Cookie", "accessToken=buyer");
      expect(page1.status).toBe(200);
      expect(page1.body.data.length).toBe(2);
      expect(page1.body.meta.page).toBe(1);
      expect(page1.body.meta.limit).toBe(2);
      expect(page1.body.meta.total).toBe(5);

      // Page 2, limit 2
      const page2 = await request(app)
        .get("/api/v1/listings?page=2&limit=2")
        .set("Cookie", "accessToken=buyer");
      expect(page2.status).toBe(200);
      expect(page2.body.data.length).toBe(2);
      expect(page2.body.meta.page).toBe(2);

      // Page 3, limit 2 -> 1 item
      const page3 = await request(app)
        .get("/api/v1/listings?page=3&limit=2")
        .set("Cookie", "accessToken=buyer");
      expect(page3.status).toBe(200);
      expect(page3.body.data.length).toBe(1);

      // Page 4, limit 2 -> beyond total -> empty array
      const page4 = await request(app)
        .get("/api/v1/listings?page=4&limit=2")
        .set("Cookie", "accessToken=buyer");
      expect(page4.status).toBe(200);
      expect(page4.body.data).toEqual([]);
      expect(page4.body.meta.total).toBe(5);
    });

    it("rejects limits exceeding 50 with 400 VALIDATION_ERROR", async () => {
      const response = await request(app)
        .get("/api/v1/listings?limit=51")
        .set("Cookie", "accessToken=buyer");
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
