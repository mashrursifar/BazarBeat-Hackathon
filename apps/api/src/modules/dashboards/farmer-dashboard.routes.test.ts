import mongoose from "mongoose";
import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  GOLDEN_EXPECTED_VALUES,
  GOLDEN_REFERENCE_DATE,
  ListingStatus,
  OrderStatus,
  type PublicUser,
  UserRole,
  farmerDashboardResponseSchema,
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
import { Listing } from "../listings/listing.model.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";

const farmer1Id = "670000000000000000000001";
const farmer2Id = "670000000000000000000002";
const buyer1Id = "670000000000000000000011";
const emptyFarmerId = "670000000000000000000099";

const sessionUsers: Record<string, PublicUser> = {
  farmer1: {
    id: farmer1Id,
    role: UserRole.FARMER,
    name: "Rahim Farmer",
    division: "rajshahi",
    district: "bogra",
    language: "en",
  },
  farmer2: {
    id: farmer2Id,
    role: UserRole.FARMER,
    name: "Anwar Farmer",
    division: "rangpur",
    district: "rangpur",
    language: "en",
  },
  buyer1: {
    id: buyer1Id,
    role: UserRole.BUYER,
    name: "Karim Buyer",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  emptyFarmer: {
    id: emptyFarmerId,
    role: UserRole.FARMER,
    name: "New Empty Farmer",
    division: "sylhet",
    district: "sylhet",
    language: "en",
  },
};

function withAuthCookie(userKey: keyof typeof sessionUsers): string {
  return `accessToken=${userKey}`;
}

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;

describe("Task 7.2 — Farmer Dashboard Endpoint (P0)", () => {
  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongoReplSet.getUri());
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoReplSet) {
      await mongoReplSet.stop();
    }
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date(GOLDEN_REFERENCE_DATE));
    setClock(testClock);

    authenticateAccessTokenMock.mockImplementation(async (token: string) => {
      const u = sessionUsers[token];
      if (!u) throw new Error("Invalid token");
      return u;
    });

    await loadDashboardGoldenDataset();

    // Clean up extra test users
    await User.deleteMany({
      _id: {
        $in: [
          new ObjectId(emptyFarmerId),
          new ObjectId("670000000000000000000088"),
        ],
      },
    });

    // Create empty farmer in DB
    await User.create({
      _id: new ObjectId(emptyFarmerId),
      name: "New Empty Farmer",
      phone: "01799999999",
      role: UserRole.FARMER,
      division: "sylhet",
      district: "sylhet",
      passwordHash: "hash123",
      isActive: true,
      language: "en",
    });
  });

  afterEach(() => {
    resetClock();
    vi.clearAllMocks();
  });

  describe("Authentication & Role Authorization", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await request(app).get("/api/v1/dashboards/farmer");
      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe("UNAUTHENTICATED");
    });

    it("rejects buyer requests with 403", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe("FORBIDDEN");
    });

    it("rejects invalid range query parameter with 400", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=invalid")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Farmer 1 Golden Dataset Validation", () => {
    it("returns 30d dashboard metrics exactly matching the golden dataset", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(response.status).toBe(200);

      const parsed = farmerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const { data, meta } = response.body;

      expect(meta.range).toBe("30d");
      expect(meta.granularity).toBe("day");
      expect(meta.timezone).toBe("Asia/Dhaka");
      expect(meta.serverTime).toBe(GOLDEN_REFERENCE_DATE);

      // KPIs
      const expected30d = GOLDEN_EXPECTED_VALUES.farmer1.kpis30d;
      expect(data.kpis.totalSales).toEqual(expected30d.totalSales);
      expect(data.kpis.earnings).toEqual(expected30d.earnings);
      expect(data.kpis.activeAuctions).toEqual(expected30d.activeAuctions);
      expect(data.kpis.pendingOrders).toEqual(expected30d.pendingOrders);
      expect(data.kpis.winRate).toEqual(expected30d.winRate);

      // Top crop
      expect(data.kpis.topCrop).toBeDefined();
      expect(data.kpis.topCrop.cropId).toBe(expected30d.topCrop.cropId);
      expect(data.kpis.topCrop.cropName).toBe(expected30d.topCrop.cropName);
      expect(data.kpis.topCrop.totalSales).toBe(expected30d.topCrop.totalSales);
      expect(data.kpis.topCrop.earnings).toBe(expected30d.topCrop.earnings);
      expect(data.kpis.topCrop.orderCount).toBe(expected30d.topCrop.orderCount);
      expect(data.kpis.topCrop.quantityKg).toBe(expected30d.topCrop.quantityKg);

      // Right-now KPIs
      expect(data.rightNow).toBeDefined();
      expect(data.rightNow.activeAuctions).toBe(2);
      expect(data.rightNow.ordersNeedingAction).toBe(0);
      expect(data.rightNow.nearestDeadline).toBeNull();
      expect(data.rightNow.kgListed).toBe(95.0); // 65kg (listing-21) + 30kg (listing-22)

      // Ending soon auctions
      expect(data.endingSoon).toHaveLength(2);
      expect(data.endingSoon[0].id).toBe("670000000000000000000221");
      expect(data.endingSoon[0].cropName).toBe("Onion");
      expect(data.endingSoon[0].currentBidPerKg).toBe(4500);
      expect(data.endingSoon[0].bidCount).toBe(2);
      expect(data.endingSoon[1].id).toBe("670000000000000000000222");
      expect(data.endingSoon[1].cropName).toBe("Green Chilli");
    });

    it("returns 7d dashboard metrics including midnight boundary and zero-filled trend buckets", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=7d")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(response.status).toBe(200);

      const { data, meta } = response.body;
      expect(meta.range).toBe("7d");
      expect(meta.granularity).toBe("day");

      const expected7d = GOLDEN_EXPECTED_VALUES.farmer1.kpis7d;
      expect(data.kpis.totalSales).toEqual(expected7d.totalSales);
      expect(data.kpis.earnings).toEqual(expected7d.earnings);
      expect(data.kpis.activeAuctions).toEqual(expected7d.activeAuctions);
      expect(data.kpis.pendingOrders).toEqual(expected7d.pendingOrders);
      expect(data.kpis.winRate).toEqual(expected7d.winRate);

      // Sales trend verification against golden dataset
      expect(data.salesTrend).toHaveLength(7);
      expect(data.salesTrend).toEqual(GOLDEN_EXPECTED_VALUES.farmer1.salesTrend7d);

      // Verifying midnight boundary for Nov 10 (Order 02 at 18:00 UTC)
      const nov10 = data.salesTrend.find((b: { date: string }) => b.date === "2026-11-10");
      expect(nov10.sales).toBe(266025); // Order 01 (116025) + Order 02 (150000)
      expect(nov10.orderCount).toBe(2);

      // Verifying zero bucket filling on Nov 11 and Nov 13
      const nov11 = data.salesTrend.find((b: { date: string }) => b.date === "2026-11-11");
      expect(nov11.sales).toBe(0);
      expect(nov11.orderCount).toBe(0);
      expect(nov11.quantityKg).toBe(0);

      const nov13 = data.salesTrend.find((b: { date: string }) => b.date === "2026-11-13");
      expect(nov13.sales).toBe(0);
      expect(nov13.orderCount).toBe(0);
      expect(nov13.quantityKg).toBe(0);

      // Verifying cancelled/disputed orders excluded on Nov 16
      const nov16 = data.salesTrend.find((b: { date: string }) => b.date === "2026-11-16");
      expect(nov16.sales).toBe(0);
      expect(nov16.orderCount).toBe(0);
    });
  });

  describe("Farmer 2 Golden Dataset Validation (Period-Over-Period)", () => {
    it("returns 30d metrics with pending orders and top crop", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(response.status).toBe(200);

      const { data } = response.body;
      const expected30d = GOLDEN_EXPECTED_VALUES.farmer2.kpis30d;

      expect(data.kpis.totalSales).toEqual(expected30d.totalSales);
      expect(data.kpis.earnings).toEqual(expected30d.earnings);
      expect(data.kpis.activeAuctions).toEqual(expected30d.activeAuctions);
      expect(data.kpis.pendingOrders).toEqual(expected30d.pendingOrders);
      expect(data.kpis.winRate).toEqual(expected30d.winRate);

      // Top crop is Onion
      expect(data.kpis.topCrop.cropId).toBe(expected30d.topCrop.cropId);
      expect(data.kpis.topCrop.cropName).toBe(expected30d.topCrop.cropName);
      expect(data.kpis.topCrop.totalSales).toBe(expected30d.topCrop.totalSales);
      expect(data.kpis.topCrop.earnings).toBe(expected30d.topCrop.earnings);
      expect(data.kpis.topCrop.orderCount).toBe(expected30d.topCrop.orderCount);
      expect(data.kpis.topCrop.quantityKg).toBe(expected30d.topCrop.quantityKg);

      // Orders needing action
      expect(data.rightNow.ordersNeedingAction).toBe(2);
      expect(data.rightNow.nearestDeadline).toBeDefined();
    });

    it("returns 7d metrics with +65.0% period-over-period percentage changes", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=7d")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(response.status).toBe(200);

      const { data } = response.body;
      const expected7d = GOLDEN_EXPECTED_VALUES.farmer2.kpis7d;

      // Current: 580,725; Previous: 352,000; Change: +65.0%
      expect(data.kpis.totalSales).toEqual(expected7d.totalSales);
      // Current: 569,110; Previous: 344,960; Change: +65.0%
      expect(data.kpis.earnings).toEqual(expected7d.earnings);
      expect(data.kpis.activeAuctions).toEqual(expected7d.activeAuctions);
      expect(data.kpis.pendingOrders).toEqual(expected7d.pendingOrders);
      expect(data.kpis.winRate).toEqual(expected7d.winRate);
    });
  });

  describe("Top Crop Tie-Breaking by Crop Slug", () => {
    it("breaks equal booked value ties alphabetically by crop slug", async () => {
      // Create a test farmer with two crops having identical totalSales
      const tieFarmerId = "670000000000000000000088";
      await User.create({
        _id: new ObjectId(tieFarmerId),
        name: "Tie Farmer",
        phone: "01788888888",
        role: UserRole.FARMER,
        division: "dhaka",
        district: "dhaka",
        passwordHash: "hash123",
        isActive: true,
        language: "en",
      });

      sessionUsers["tieFarmer"] = {
        id: tieFarmerId,
        role: UserRole.FARMER,
        name: "Tie Farmer",
        division: "dhaka",
        district: "dhaka",
        language: "en",
      };

      // Crop A: Potato (slug: "potato")
      // Crop B: Onion (slug: "onion") - "onion" < "potato" alphabetically
      const potatoCropId = "670000000000000000000102";
      const onionCropId = "670000000000000000000101";

      const commonListingA = new ObjectId();
      const commonListingB = new ObjectId();

      await Order.create([
        {
          _id: new ObjectId(),
          listingId: commonListingA,
          farmerId: new ObjectId(tieFarmerId),
          buyerId: new ObjectId(buyer1Id),
          cropId: new ObjectId(potatoCropId),
          quantityKg: 50,
          grade: CropGrade.A,
          pricePerKg: 2000,
          subtotal: 100000,
          platformFee: 2000,
          farmerNet: 98000,
          status: OrderStatus.COMPLETED,
          createdAt: new Date("2026-11-15T10:00:00.000Z"),
        },
        {
          _id: new ObjectId(),
          listingId: commonListingB,
          farmerId: new ObjectId(tieFarmerId),
          buyerId: new ObjectId(buyer1Id),
          cropId: new ObjectId(onionCropId),
          quantityKg: 25,
          grade: CropGrade.A,
          pricePerKg: 4000,
          subtotal: 100000, // Exact tie with Potato: 100,000 poisha
          platformFee: 2000,
          farmerNet: 98000,
          status: OrderStatus.COMPLETED,
          createdAt: new Date("2026-11-15T11:00:00.000Z"),
        },
      ]);

      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("tieFarmer"));

      expect(response.status).toBe(200);
      // Onion slug ("onion") sorts before Potato slug ("potato")
      expect(response.body.data.kpis.topCrop.cropSlug).toBe("onion");
      expect(response.body.data.kpis.topCrop.cropName).toBe("Onion");
    });
  });

  describe("New Farmer with No Data (Zeros & Nulls, Not Errors)", () => {
    it("returns clean zeros, empty arrays, and nulls without throwing errors", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("emptyFarmer"));

      expect(response.status).toBe(200);

      const parsed = farmerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const { data } = response.body;

      // Zeros and nulls for KPIs
      expect(data.kpis.totalSales).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.earnings).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.activeAuctions).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.pendingOrders).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.winRate).toEqual({ value: 0, previous: null, changePercent: null });
      expect(data.kpis.topCrop).toBeNull();
      expect(data.kpis.orders).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.pricePremium).toEqual({ value: 0, previous: null, changePercent: null });

      // Right-now zeros
      expect(data.rightNow.activeAuctions).toBe(0);
      expect(data.rightNow.ordersNeedingAction).toBe(0);
      expect(data.rightNow.nearestDeadline).toBeNull();
      expect(data.rightNow.kgListed).toBe(0);

      // Empty lists
      expect(data.earningsByCrop).toEqual([]);
      expect(data.endingSoon).toEqual([]);
      expect(data.endingSoonAuctions).toEqual([]);

      // Sales trend populated with continuous zero buckets
      expect(data.salesTrend.length).toBe(30);
      for (const bucket of data.salesTrend) {
        expect(bucket.sales).toBe(0);
        expect(bucket.quantityKg).toBe(0);
        expect(bucket.orderCount).toBe(0);
      }
    });
  });

  describe("Multi-Tenant Data Isolation", () => {
    it("ensures Farmer 1 never sees Farmer 2 data and vice versa", async () => {
      const f1Res = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer1"));

      const f2Res = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(f1Res.body.data.kpis.totalSales.value).toBe(1311390);
      expect(f2Res.body.data.kpis.totalSales.value).toBe(932725);

      // Ending soon auctions belong only to the requesting farmer
      const f1EndingSoonIds = f1Res.body.data.endingSoon.map((l: { id: string }) => l.id);
      const f2EndingSoonIds = f2Res.body.data.endingSoon.map((l: { id: string }) => l.id);

      expect(f1EndingSoonIds).toEqual(["670000000000000000000221", "670000000000000000000222"]);
      expect(f2EndingSoonIds).toEqual(["670000000000000000000223", "670000000000000000000224"]);
    });
  });

  describe("Database Query Plan & Index Verification", () => {
    it("uses compound index for farmer order queries", async () => {
      const explainResult = await Order.find({
        farmerId: new ObjectId(farmer2Id),
        status: OrderStatus.PENDING,
      })
        .sort({ createdAt: -1 })
        .explain("executionStats");

      const winningPlan = (
        explainResult as unknown as { queryPlanner?: { winningPlan?: unknown } }
      ).queryPlanner?.winningPlan;
      expect(winningPlan).toBeDefined();

      // Check that winningPlan uses an index scan (IXSCAN) with the compound index
      const planString = JSON.stringify(winningPlan);
      expect(planString).toContain("IXSCAN");
      expect(planString).toContain("farmerId_1_status_1_createdAt_-1");
    });

    it("uses compound index for ending soon active listing queries", async () => {
      const explainResult = await Listing.find({
        farmerId: new ObjectId(farmer1Id),
        status: ListingStatus.ACTIVE,
        endsAt: { $gt: new Date(GOLDEN_REFERENCE_DATE) },
      })
        .sort({ endsAt: 1 })
        .explain("executionStats");

      const winningPlan = (
        explainResult as unknown as { queryPlanner?: { winningPlan?: unknown } }
      ).queryPlanner?.winningPlan;
      expect(winningPlan).toBeDefined();

      const planString = JSON.stringify(winningPlan);
      expect(planString).toContain("IXSCAN");
      expect(planString).toContain("farmerId_1_status_1_endsAt_1");
    });
  });
});
