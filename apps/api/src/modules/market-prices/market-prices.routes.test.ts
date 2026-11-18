import mongoose from "mongoose";
import { ObjectId } from "bson";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOLDEN_REFERENCE_DATE,
  type PublicUser,
  UserRole,
  marketHistoryResponseSchema,
  marketSummaryResponseSchema,
  nationalSummaryResponseSchema,
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
import { loadDashboardGoldenDataset } from "../../fixtures/dashboard-golden-dataset.js";
import { getPricePredictionProvider } from "../ai/ai.service.js";
import { Crop } from "../crops/crop.model.js";
import { MarketPrice } from "./market-price.model.js";
import { seedMarketPriceHistory } from "./market-price-seed.js";
import { marketPriceCache } from "./market-price-cache.js";

const farmer1Id = "670000000000000000000001";
const buyer1Id = "670000000000000000000011";
const buyer2Id = "670000000000000000000012";

const onionId = "670000000000000000000101";
const potatoId = "670000000000000000000102";
const chilliId = "670000000000000000000103";

const sessionUsers: Record<string, PublicUser> = {
  farmer1: {
    id: farmer1Id,
    role: UserRole.FARMER,
    name: "Rahim Farmer",
    division: "rajshahi",
    district: "bogura",
    language: "en",
  },
  buyer1: {
    id: buyer1Id,
    role: UserRole.BUYER,
    name: "Karim Buyer",
    division: "dhaka",
    district: "dhaka",
    organization: "Karim Wholesales Ltd",
    language: "en",
  },
  buyer2: {
    id: buyer2Id,
    role: UserRole.BUYER,
    name: "Salim Buyer",
    division: "chattogram",
    district: "chattogram",
    organization: "Salim Agro Mart",
    language: "en",
  },
};

function withAuthCookie(userKey: keyof typeof sessionUsers): string {
  return `accessToken=${userKey}`;
}

let mongoServer: MongoMemoryServer | undefined;
let testClock: TestClock;

describe("Task 7.4 — Market Data Endpoints (P1)", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongoServer.getUri());
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date(GOLDEN_REFERENCE_DATE));
    setClock(testClock);
    marketPriceCache.clear();

    authenticateAccessTokenMock.mockImplementation(async (token: string) => {
      const user = sessionUsers[token];
      if (!user) {
        throw new Error("Invalid token");
      }
      return user;
    });

    await loadDashboardGoldenDataset();
  });

  afterEach(() => {
    resetClock();
    vi.restoreAllMocks();
  });

  // ==========================================
  // Section 1: Role Rules
  // ==========================================
  describe("1. Role Rules & Authentication", () => {
    describe("GET /api/v1/market-prices", () => {
      it("returns 401 UNAUTHENTICATED for unauthenticated callers", async () => {
        const res = await request(app)
          .get(`/api/v1/market-prices?cropId=${onionId}`)
          .expect(401);

        expect(res.body.error.code).toBe("UNAUTHENTICATED");
      });

      it("permits farmers (Role A: any authenticated user)", async () => {
        const res = await request(app)
          .get(`/api/v1/market-prices?cropId=${onionId}&division=rajshahi`)
          .set("Cookie", withAuthCookie("farmer1"))
          .expect(200);

        expect(res.body.data.cropId).toBe(onionId);
        expect(marketHistoryResponseSchema.safeParse(res.body).success).toBe(true);
      });

      it("permits buyers (Role A: any authenticated user)", async () => {
        const res = await request(app)
          .get(`/api/v1/market-prices?cropId=${onionId}&division=rajshahi`)
          .set("Cookie", withAuthCookie("buyer1"))
          .expect(200);

        expect(res.body.data.cropId).toBe(onionId);
        expect(marketHistoryResponseSchema.safeParse(res.body).success).toBe(true);
      });
    });

    describe("GET /api/v1/market-prices/summary", () => {
      it("returns 401 UNAUTHENTICATED for unauthenticated callers", async () => {
        const res = await request(app)
          .get("/api/v1/market-prices/summary?division=dhaka")
          .expect(401);

        expect(res.body.error.code).toBe("UNAUTHENTICATED");
      });

      it("permits farmers (Role A: any authenticated user)", async () => {
        const res = await request(app)
          .get("/api/v1/market-prices/summary?division=dhaka")
          .set("Cookie", withAuthCookie("farmer1"))
          .expect(200);

        expect(marketSummaryResponseSchema.safeParse(res.body).success).toBe(true);
      });

      it("permits buyers", async () => {
        const res = await request(app)
          .get("/api/v1/market-prices/summary?division=rajshahi")
          .set("Cookie", withAuthCookie("buyer1"))
          .expect(200);

        expect(marketSummaryResponseSchema.safeParse(res.body).success).toBe(true);
      });
    });

    describe("GET /api/v1/market-prices/national-summary", () => {
      it("returns 401 UNAUTHENTICATED for unauthenticated callers", async () => {
        const res = await request(app)
          .get("/api/v1/market-prices/national-summary")
          .expect(401);

        expect(res.body.error.code).toBe("UNAUTHENTICATED");
      });

      it("returns 403 FORBIDDEN for farmers (Role: Buyer only)", async () => {
        const res = await request(app)
          .get("/api/v1/market-prices/national-summary")
          .set("Cookie", withAuthCookie("farmer1"))
          .expect(403);

        expect(res.body.error.code).toBe("FORBIDDEN");
      });

      it("permits buyers", async () => {
        const res = await request(app)
          .get("/api/v1/market-prices/national-summary")
          .set("Cookie", withAuthCookie("buyer1"))
          .expect(200);

        expect(nationalSummaryResponseSchema.safeParse(res.body).success).toBe(true);
      });
    });
  });

  // ==========================================
  // Section 2: GET /market-prices (History, Mean, Grade Guide)
  // ==========================================
  describe("2. GET /api/v1/market-prices", () => {
    it("returns 400 VALIDATION_ERROR when cropId is missing", async () => {
      const res = await request(app)
        .get("/api/v1/market-prices")
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 NOT_FOUND when cropId does not exist", async () => {
      const nonExistentCropId = new ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/market-prices?cropId=${nonExistentCropId}`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 VALIDATION_ERROR when division is invalid", async () => {
      const res = await request(app)
        .get(`/api/v1/market-prices?cropId=${onionId}&division=atlantis`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("matches golden dataset price history, min/max, trend, and grade guide for Onion in Rajshahi", async () => {
      const res = await request(app)
        .get(`/api/v1/market-prices?cropId=${onionId}&division=rajshahi&range=7d`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(200);

      const parsed = marketHistoryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      const data = res.body.data;
      expect(data.cropId).toBe(onionId);
      expect(data.cropName).toBe("Onion");
      expect(data.division).toBe("rajshahi");
      expect(data.range).toBe("7d");

      // In golden dataset for Onion in Rajshahi:
      // Latest record is 2026-11-16: avg 4600, min 4400, max 4900
      // Earliest record in 7d is 2026-11-10: avg 4500, min 4200, max 4800
      // 2026-11-15: avg 4700, min 4500, max 5000
      expect(data.currentAvgPricePerKg).toBe(4600);
      expect(data.minPricePerKg).toBe(4200);
      expect(data.maxPricePerKg).toBe(5000);
      expect(data.changePercent).toBe(2.2); // (4600 - 4500) / 4500 * 100 = 2.2%
      expect(data.trend).toBe("UP");

      // 7-day series has exactly 7 daily points (chronologically forward-filled)
      expect(data.series).toHaveLength(7);
      expect(data.series[0].date).toBe("2026-11-10");
      expect(data.series[0].avgPricePerKg).toBe(4500);
      expect(data.series[6].date).toBe("2026-11-16");
      expect(data.series[6].avgPricePerKg).toBe(4600);

      // Grade Guide for A, B, and C
      expect(data.gradeGuide).toBeDefined();
      expect(data.gradeGuide.A.grade).toBe("A");
      expect(data.gradeGuide.A.expectedPerKg).toBeGreaterThan(data.gradeGuide.B.expectedPerKg);
      expect(data.gradeGuide.B.grade).toBe("B");
      expect(data.gradeGuide.B.expectedPerKg).toBeGreaterThan(data.gradeGuide.C.expectedPerKg);
      expect(data.gradeGuide.C.grade).toBe("C");
      expect(data.gradeGuide.A.description).toContain("Premium");
      expect(data.gradeGuide.A.suggestedFloorPerKg).toBeGreaterThan(0);
    });

    it("calculates the national mean across all divisions when division is omitted", async () => {
      const res = await request(app)
        .get(`/api/v1/market-prices?cropId=${onionId}&range=30d`)
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      const parsed = marketHistoryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      const data = res.body.data;
      expect(data.cropId).toBe(onionId);
      // Division is omitted in national mean
      expect(data.division).toBeUndefined();
      expect(res.body.meta.division).toBeUndefined();

      // On 2026-11-16, Onion has rows in Rajshahi (4600), Rangpur (4700), and Dhaka (5200)
      // Arithmetic national mean = Math.round((4600 + 4700 + 5200) / 3) = 4833
      const nov16Point = data.series.find((p: { date: string }) => p.date === "2026-11-16");
      expect(nov16Point).toBeDefined();
      expect(nov16Point.avgPricePerKg).toBe(4833);
      expect(nov16Point.minPricePerKg).toBe(4400); // min(4400, 4500, 4800)
      expect(nov16Point.maxPricePerKg).toBe(5500); // max(4900, 5000, 5500)

      // National grade guide passes division=undefined to provider
      expect(data.gradeGuide).toBeDefined();
      expect(data.gradeGuide.A.expectedPerKg).toBeGreaterThan(0);
    });

    it("works with fully seeded 60-day history across ranges without holes", async () => {
      // Clear golden market prices and seed standard 60-day history for crops
      await MarketPrice.deleteMany({});
      const crops = await Crop.find({ isActive: true }).select("_id slug").lean();
      await seedMarketPriceHistory(
        crops.map((c) => ({ id: c._id, slug: c.slug })),
        new Date(GOLDEN_REFERENCE_DATE),
      );

      const res = await request(app)
        .get(`/api/v1/market-prices?cropId=${potatoId}&division=dhaka&range=30d`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(200);

      const parsed = marketHistoryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      const data = res.body.data;
      expect(data.series).toHaveLength(30);
      expect(data.currentAvgPricePerKg).toBeGreaterThan(0);
      expect(data.minPricePerKg).toBeGreaterThan(0);
      expect(data.maxPricePerKg).toBeGreaterThanOrEqual(data.minPricePerKg);
      expect(["UP", "DOWN", "FLAT"]).toContain(data.trend);
    });
  });

  // ==========================================
  // Section 3: GET /market-prices/summary
  // ==========================================
  describe("3. GET /api/v1/market-prices/summary", () => {
    it("computes weighted listing averages from ACTIVE listings for a division", async () => {
      const res = await request(app)
        .get("/api/v1/market-prices/summary?division=rajshahi")
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      const parsed = marketSummaryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      const items = res.body.data.items;
      // In golden dataset, Rajshahi has 2 active listings:
      // listing-21: Onion, 65 kg, floor 4000, bid 4500 (activeListingsCount: 1, weighted avg: 4500)
      // listing-22: Green Chilli, 30 kg, floor 13000, bid 14000 (activeListingsCount: 1, weighted avg: 14000)
      const onionItem = items.find((i: { cropId: string }) => i.cropId === onionId);
      expect(onionItem).toBeDefined();
      expect(onionItem.activeListingsCount).toBe(1);
      expect(onionItem.currentAvgPricePerKg).toBe(4500);
      expect(onionItem.minPricePerKg).toBe(4500);
      expect(onionItem.maxPricePerKg).toBe(4500);

      const chilliItem = items.find((i: { cropId: string }) => i.cropId === chilliId);
      expect(chilliItem).toBeDefined();
      expect(chilliItem.activeListingsCount).toBe(1);
      expect(chilliItem.currentAvgPricePerKg).toBe(14000);
    });

    it("computes national weighted listing average across all active listings when division is omitted", async () => {
      const res = await request(app)
        .get("/api/v1/market-prices/summary")
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      const parsed = marketSummaryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      const onionItem = res.body.data.items.find((i: { cropId: string }) => i.cropId === onionId);
      expect(onionItem).toBeDefined();
      // Nationally, Onion has 2 active listings in golden dataset:
      // listing-21 (Rajshahi): 65 kg @ 4,500 poisha
      // listing-24 (Rangpur): 40 kg @ 4,200 poisha (floor price, no bids)
      // Total amount = (65 * 4500) + (40 * 4200) = 292,500 + 168,000 = 460,500
      // Total weight = 65 + 40 = 105 kg
      // Weighted avg = Math.round(460500 / 105) = 4,386 poisha
      expect(onionItem.activeListingsCount).toBe(2);
      expect(onionItem.currentAvgPricePerKg).toBe(4386);
      expect(onionItem.minPricePerKg).toBe(4200);
      expect(onionItem.maxPricePerKg).toBe(4500);
    });

    it("handles cells with no active listings by falling back to provider benchmark with activeListingsCount=0", async () => {
      const res = await request(app)
        .get("/api/v1/market-prices/summary?division=barishal")
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      const parsed = marketSummaryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      // In golden dataset, Barishal has 0 active listings
      for (const item of res.body.data.items) {
        expect(item.activeListingsCount).toBe(0);
        expect(item.currentAvgPricePerKg).toBeGreaterThan(0);
        expect(item.minPricePerKg).toBeGreaterThan(0);
        expect(item.maxPricePerKg).toBeGreaterThanOrEqual(item.minPricePerKg);
      }
    });

    it("filters summary to a single crop when cropId query parameter is provided", async () => {
      const res = await request(app)
        .get(`/api/v1/market-prices/summary?cropId=${potatoId}&division=rangpur`)
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].cropId).toBe(potatoId);
      expect(res.body.meta.totalCrops).toBe(1);
    });
  });

  // ==========================================
  // Section 4: GET /market-prices/national-summary
  // ==========================================
  describe("4. GET /api/v1/market-prices/national-summary", () => {
    it("returns all 8 divisions with active listing metrics and completed sale counts", async () => {
      const res = await request(app)
        .get("/api/v1/market-prices/national-summary")
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      const parsed = nationalSummaryResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      const divisions = res.body.data.divisions;
      expect(divisions).toHaveLength(8);
      expect(res.body.meta.totalDivisions).toBe(8);

      // Check Rajshahi:
      const rajshahi = divisions.find((d: { division: string }) => d.division === "rajshahi");
      expect(rajshahi).toBeDefined();
      expect(rajshahi.divisionBn).toBe("রাজশাহী");

      // Onion in Rajshahi: 1 active listing (65 kg @ 4500) and 2 completed sales (Orders 01 & 03)
      const onionRajshahi = rajshahi.crops.find((c: { cropId: string }) => c.cropId === onionId);
      expect(onionRajshahi).toBeDefined();
      expect(onionRajshahi.activeListingsCount).toBe(1);
      expect(onionRajshahi.avgPricePerKg).toBe(4500);
      expect(onionRajshahi.completedSalesCount).toBe(2);

      // Potato in Rajshahi: 0 active listings, 1 completed sale (Order 02)
      const potatoRajshahi = rajshahi.crops.find((c: { cropId: string }) => c.cropId === potatoId);
      expect(potatoRajshahi).toBeDefined();
      expect(potatoRajshahi.activeListingsCount).toBe(0);
      expect(potatoRajshahi.completedSalesCount).toBe(1);
      expect(potatoRajshahi.avgPricePerKg).toBeGreaterThan(0); // Provider benchmark
    });

    it("filters national summary crops when cropId query parameter is provided", async () => {
      const res = await request(app)
        .get(`/api/v1/market-prices/national-summary?cropId=${onionId}`)
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      expect(res.body.data.divisions).toHaveLength(8);
      for (const division of res.body.data.divisions) {
        expect(division.crops).toHaveLength(1);
        expect(division.crops[0].cropId).toBe(onionId);
      }
    });

    it("returns 404 NOT_FOUND when cropId in national summary does not exist", async () => {
      const nonExistentCropId = new ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/market-prices/national-summary?cropId=${nonExistentCropId}`)
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ==========================================
  // Section 5: In-Memory Caching (10-minute cache window)
  // ==========================================
  describe("5. In-Memory Provider Caching (10-Minute Window)", () => {
    it("calls the price provider once per cache window for grade guide and cell benchmarks", async () => {
      const provider = getPricePredictionProvider();
      const predictSpy = vi.spyOn(provider, "predictPrice");

      // 1. Initial request on empty cache
      expect(marketPriceCache.size()).toBe(0);
      const res1 = await request(app)
        .get(`/api/v1/market-prices?cropId=${onionId}&division=rajshahi&range=7d`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(200);

      expect(res1.body.data.gradeGuide).toBeDefined();
      // Should have called provider 3 times (for grades A, B, C)
      expect(predictSpy).toHaveBeenCalledTimes(3);
      expect(marketPriceCache.size()).toBe(3);

      // 2. Second request within cache window (advance clock by 2 minutes)
      testClock.advanceBy(2 * 60 * 1000);
      const res2 = await request(app)
        .get(`/api/v1/market-prices?cropId=${onionId}&division=rajshahi&range=7d`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(200);

      expect(res2.body.data.gradeGuide).toBeDefined();
      // Provider call count must remain 3 (reused from cache!)
      expect(predictSpy).toHaveBeenCalledTimes(3);

      // 3. Third request after cache window expires (advance clock past 10 minutes total: +9 minutes)
      testClock.advanceBy(9 * 60 * 1000); // Now 11 minutes total
      const res3 = await request(app)
        .get(`/api/v1/market-prices?cropId=${onionId}&division=rajshahi&range=7d`)
        .set("Cookie", withAuthCookie("farmer1"))
        .expect(200);

      expect(res3.body.data.gradeGuide).toBeDefined();
      // Provider should be called again for each grade (+3 calls = 6 total)
      expect(predictSpy).toHaveBeenCalledTimes(6);
    });

    it("caches provider cell benchmarks for summary and national-summary endpoints", async () => {
      const provider = getPricePredictionProvider();
      const predictSpy = vi.spyOn(provider, "predictPrice");

      // Division with 0 listings (e.g. Barishal for single crop Potato)
      const res1 = await request(app)
        .get(`/api/v1/market-prices/summary?division=barishal&cropId=${potatoId}`)
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      expect(res1.body.data.items[0].activeListingsCount).toBe(0);
      expect(predictSpy).toHaveBeenCalledTimes(1);

      // Second request immediately after (within 10m)
      const res2 = await request(app)
        .get(`/api/v1/market-prices/summary?division=barishal&cropId=${potatoId}`)
        .set("Cookie", withAuthCookie("buyer1"))
        .expect(200);

      expect(res2.body.data.items[0].activeListingsCount).toBe(0);
      // Spy count must still be 1 (cached!)
      expect(predictSpy).toHaveBeenCalledTimes(1);
    });
  });
});
