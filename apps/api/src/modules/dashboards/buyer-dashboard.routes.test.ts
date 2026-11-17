import mongoose from "mongoose";
import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOLDEN_EXPECTED_VALUES,
  GOLDEN_REFERENCE_DATE,
  OrderStatus,
  type PublicUser,
  UserRole,
  buyerDashboardResponseSchema,
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
import { getMyBids } from "../bids/bid.service.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";

const farmer1Id = "670000000000000000000001";
const buyer1Id = "670000000000000000000011";
const buyer2Id = "670000000000000000000012";
const buyer3Id = "670000000000000000000013";
const emptyBuyerId = "670000000000000000000098";

const sessionUsers: Record<string, PublicUser> = {
  farmer1: {
    id: farmer1Id,
    role: UserRole.FARMER,
    name: "Rahim Farmer",
    division: "rajshahi",
    district: "bogra",
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
  buyer3: {
    id: buyer3Id,
    role: UserRole.BUYER,
    name: "Tariq Buyer",
    division: "sylhet",
    district: "sylhet",
    organization: "Sylhet Fresh Direct",
    language: "en",
  },
  emptyBuyer: {
    id: emptyBuyerId,
    role: UserRole.BUYER,
    name: "New Empty Buyer",
    division: "barishal",
    district: "barishal",
    language: "en",
  },
};

function withAuthCookie(userKey: keyof typeof sessionUsers): string {
  return `accessToken=${userKey}`;
}

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;

describe("Task 7.3 — Buyer Dashboard Endpoint (P0)", () => {
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

    // Clean up empty buyer
    await User.deleteMany({
      _id: new ObjectId(emptyBuyerId),
    });

    // Create empty buyer in DB
    await User.create({
      _id: new ObjectId(emptyBuyerId),
      name: "New Empty Buyer",
      phone: "01788888888",
      role: UserRole.BUYER,
      division: "barishal",
      district: "barishal",
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
      const response = await request(app).get("/api/v1/dashboards/buyer");
      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe("UNAUTHENTICATED");
    });

    it("rejects farmer requests with 403", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe("FORBIDDEN");
    });

    it("accepts authenticated buyer requests with 200", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });
  });

  describe("Query Parameter Validation", () => {
    it("defaults to 30d range preset when range query parameter is omitted", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(200);
      expect(response.body.meta.range).toBe("30d");
      expect(response.body.meta.granularity).toBe("day");
      expect(response.body.meta.timezone).toBe("Asia/Dhaka");
    });

    it("supports all valid range presets: 7d, 30d, 90d, 1y, and all", async () => {
      for (const preset of ["7d", "30d", "90d", "1y", "all"] as const) {
        const response = await request(app)
          .get(`/api/v1/dashboards/buyer?range=${preset}`)
          .set("Cookie", withAuthCookie("buyer1"));

        expect(response.status).toBe(200);
        expect(response.body.meta.range).toBe(preset);
        if (preset === "1y" || preset === "all") {
          expect(response.body.meta.granularity).toBe("month");
        } else {
          expect(response.body.meta.granularity).toBe("day");
        }
      }
    });

    it("rejects invalid range query parameter with 400", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=invalid")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Buyer 1 Golden Dataset Validation", () => {
    it("returns 30d dashboard metrics exactly matching the golden dataset", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(200);

      const parsed = buyerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const { data, meta } = response.body;

      expect(meta.range).toBe("30d");
      expect(meta.granularity).toBe("day");
      expect(meta.timezone).toBe("Asia/Dhaka");
      expect(meta.serverTime).toBe(GOLDEN_REFERENCE_DATE);

      // KPIs
      const expected30d = GOLDEN_EXPECTED_VALUES.buyer1.kpis30d;
      expect(data.kpis.totalSpend).toEqual(expected30d.totalSpend);
      expect(data.kpis.kgPurchased).toEqual(expected30d.kgPurchased);
      expect(data.kpis.activeBids).toEqual(expected30d.activeBids);
      expect(data.kpis.winRate).toEqual(expected30d.winRate);
      expect(data.kpis.pendingOrders).toEqual(expected30d.pendingOrders);
      expect(data.kpis.avgPriceVsMarket).toEqual(expected30d.avgPriceVsMarket);

      // Purchases by crop
      expect(data.purchasesByCrop).toHaveLength(3);
      expect(data.purchasesByCrop).toEqual(GOLDEN_EXPECTED_VALUES.buyer1.purchasesByCrop30d);

      // Right-now KPIs
      expect(data.rightNow).toBeDefined();
      expect(data.rightNow.activeBids).toBe(2);
      expect(data.rightNow.winningBids).toBe(1);
      expect(data.rightNow.outbidBids).toBe(1);
      expect(data.rightNow.ordersNeedingAction).toBe(1); // Order 12 PENDING

      // Nearest ending active bids (top 2 active bids for Buyer 1)
      expect(data.activeBidsList).toHaveLength(2);
      expect(data.activeBidsList[0].listingId).toBe("670000000000000000000221");
      expect(data.activeBidsList[0].cropName).toBe("Onion");
      expect(data.activeBidsList[0].status).toBe("WINNING");
      expect(data.activeBidsList[0].myBidPerKg).toBe(4500);

      expect(data.activeBidsList[1].listingId).toBe("670000000000000000000222");
      expect(data.activeBidsList[1].cropName).toBe("Green Chilli");
      expect(data.activeBidsList[1].status).toBe("OUTBID");
      expect(data.activeBidsList[1].myBidPerKg).toBe(13500);

      // Recent orders (3 newest)
      expect(data.recentOrders).toHaveLength(3);
      expect(data.recentOrders[0].id).toBe("670000000000000000000312"); // Order 12
      expect(data.recentOrders[1].id).toBe("670000000000000000000307"); // Order 07
      expect(data.recentOrders[2].id).toBe("670000000000000000000304"); // Order 04
    });

    it("returns 7d dashboard metrics including spend trend with zero buckets and period comparison", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=7d")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(200);

      const { data, meta } = response.body;
      expect(meta.range).toBe("7d");
      expect(meta.granularity).toBe("day");

      const expected7d = GOLDEN_EXPECTED_VALUES.buyer1.kpis7d;
      expect(data.kpis.totalSpend).toEqual(expected7d.totalSpend);
      expect(data.kpis.kgPurchased).toEqual(expected7d.kgPurchased);
      expect(data.kpis.activeBids).toEqual(expected7d.activeBids);
      expect(data.kpis.winRate).toEqual(expected7d.winRate);
      expect(data.kpis.pendingOrders).toEqual(expected7d.pendingOrders);

      // Spend trend verification against golden dataset
      expect(data.spendTrend).toHaveLength(7);
      expect(data.spendTrend).toEqual(GOLDEN_EXPECTED_VALUES.buyer1.spendTrend7d);

      // Verifying Nov 10 spend
      const nov10 = data.spendTrend.find((b: { date: string }) => b.date === "2026-11-10");
      expect(nov10.spend).toBe(116025);
      expect(nov10.quantityKg).toBe(25.5);
      expect(nov10.orderCount).toBe(1);

      // Verifying zero bucket filling on Nov 11, Nov 12, Nov 13
      for (const zeroDate of ["2026-11-11", "2026-11-12", "2026-11-13"]) {
        const bucket = data.spendTrend.find((b: { date: string }) => b.date === zeroDate);
        expect(bucket.spend).toBe(0);
        expect(bucket.quantityKg).toBe(0);
        expect(bucket.orderCount).toBe(0);
      }
    });
  });

  describe("Shared Win Rate Definition Parity with My Bids", () => {
    it("proves GET /dashboards/buyer and getMyBids produce identical win rates across all buyers", async () => {
      for (const buyerKey of ["buyer1", "buyer2", "buyer3"] as const) {
        const buyerUser = sessionUsers[buyerKey]!;

        // 1. Fetch from My Bids service / grouping
        const myBidsResult = await getMyBids(buyerUser, { page: 1, limit: 100 });
        const myBidsData = myBidsResult.data as {
          active: unknown[];
          won: unknown[];
          lost: unknown[];
        };

        const wonCount = myBidsData.won.length;
        const lostCount = myBidsData.lost.length;
        const totalCompleted = wonCount + lostCount;
        const expectedWinRate =
          totalCompleted > 0 ? Math.round((wonCount / totalCompleted) * 1000) / 10 : 0;

        // 2. Fetch from Buyer Dashboard endpoint
        const dashboardResponse = await request(app)
          .get("/api/v1/dashboards/buyer?range=30d")
          .set("Cookie", withAuthCookie(buyerKey));

        expect(dashboardResponse.status).toBe(200);

        const dashboardWinRate = dashboardResponse.body.data.kpis.winRate.value;
        const dashboardActiveBids = dashboardResponse.body.data.kpis.activeBids.value;

        // Verify win rate matches exactly
        expect(dashboardWinRate).toBe(expectedWinRate);
        expect(dashboardActiveBids).toBe(myBidsData.active.length);
      }
    });
  });

  describe("Privacy & Exact Allowed Key Set Verification", () => {
    it("ensures response contains only allowed keys with zero leak of platformFee, farmerNet, or sensitive data", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(200);

      // Root level keys: only data and meta
      expect(Object.keys(response.body).sort()).toEqual(["data", "meta"]);

      // Meta keys
      expect(Object.keys(response.body.meta).sort()).toEqual([
        "granularity",
        "range",
        "serverTime",
        "timezone",
      ]);

      // Data keys
      expect(Object.keys(response.body.data).sort()).toEqual([
        "activeBidsList",
        "kpis",
        "nearestEndingBids",
        "purchasesByCrop",
        "recentOrders",
        "rightNow",
        "spendTrend",
      ]);

      // KPIs keys: totalSpend, activeBids, winRate, avgPriceVsMarket, pendingOrders, kgPurchased, orders, nearestDeadline
      const allowedKpiKeys = [
        "totalSpend",
        "activeBids",
        "winRate",
        "avgPriceVsMarket",
        "pendingOrders",
        "kgPurchased",
        "orders",
        "nearestDeadline",
      ];
      for (const key of Object.keys(response.body.data.kpis)) {
        expect(allowedKpiKeys).toContain(key);
      }

      // Right-now keys
      expect(Object.keys(response.body.data.rightNow).sort()).toEqual([
        "activeBids",
        "nearestDeadline",
        "ordersNeedingAction",
        "outbidBids",
        "winningBids",
      ]);

      // Check Recent Orders: Must NOT leak platformFee, farmerNet, passwordHash, __v, or _id
      for (const order of response.body.data.recentOrders) {
        expect(order).not.toHaveProperty("platformFee");
        expect(order).not.toHaveProperty("farmerNet");
        expect(order).not.toHaveProperty("_id");
        expect(order).not.toHaveProperty("__v");
        expect(order).not.toHaveProperty("passwordHash");
        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("status");
        expect(order).toHaveProperty("farmer");

        // If order is PENDING, farmer contact is unrevealed / masked
        if (order.status === OrderStatus.PENDING) {
          expect(order.farmer.isMasked).toBe(true);
          expect(order.farmer.phone).toBeUndefined();
        }
      }

      // Check Active Bids: Must NOT leak farmer or internal secrets
      for (const bid of response.body.data.activeBidsList) {
        expect(bid).not.toHaveProperty("_id");
        expect(bid).not.toHaveProperty("__v");
        expect(bid).not.toHaveProperty("farmerId");
        expect(bid).toHaveProperty("listingId");
        expect(bid).toHaveProperty("myBidPerKg");
        expect(bid).toHaveProperty("currentBidPerKg");
        expect(bid).toHaveProperty("status");
      }
    });
  });

  describe("New Buyer with No Data (Zeros & Nulls, Not Errors)", () => {
    it("returns clean zeros, empty arrays, and nulls without throwing errors", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("emptyBuyer"));

      expect(response.status).toBe(200);

      const parsed = buyerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const { data } = response.body;

      // Zeros and nulls for KPIs
      expect(data.kpis.totalSpend).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.kgPurchased).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.activeBids).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.pendingOrders).toEqual({ value: 0, previous: 0, changePercent: null });
      expect(data.kpis.winRate).toEqual({ value: 0, previous: null, changePercent: null });
      expect(data.kpis.avgPriceVsMarket).toEqual({ value: 0, previous: null, changePercent: null });
      expect(data.kpis.orders).toEqual({ value: 0, previous: 0, changePercent: null });

      // Right-now zeros
      expect(data.rightNow.activeBids).toBe(0);
      expect(data.rightNow.winningBids).toBe(0);
      expect(data.rightNow.outbidBids).toBe(0);
      expect(data.rightNow.ordersNeedingAction).toBe(0);
      expect(data.rightNow.nearestDeadline).toBeNull();

      // Empty lists
      expect(data.purchasesByCrop).toEqual([]);
      expect(data.activeBidsList).toEqual([]);
      expect(data.nearestEndingBids).toEqual([]);
      expect(data.recentOrders).toEqual([]);

      // Spend trend populated with continuous zero buckets
      expect(data.spendTrend.length).toBe(30);
      for (const bucket of data.spendTrend) {
        expect(bucket.spend).toBe(0);
        expect(bucket.quantityKg).toBe(0);
        expect(bucket.orderCount).toBe(0);
      }
    });
  });

  describe("Multi-Tenant Data Isolation", () => {
    it("ensures Buyer 1 never sees Buyer 2 data and vice versa", async () => {
      const b1Res = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("buyer1"));

      const b2Res = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("buyer2"));

      expect(b1Res.body.data.kpis.totalSpend.value).toBe(1128040);
      expect(b2Res.body.data.kpis.totalSpend.value).toBe(837700);

      // Active bids belong only to the requesting buyer
      // Buyer 1: listing 21 is WINNING, listing 22 is OUTBID
      const b1Listing21 = b1Res.body.data.activeBidsList.find(
        (b: { listingId: string }) => b.listingId === "670000000000000000000221",
      );
      expect(b1Listing21.status).toBe("WINNING");

      // Buyer 2: listing 21 is OUTBID, listing 22 is WINNING
      const b2Listing21 = b2Res.body.data.activeBidsList.find(
        (b: { listingId: string }) => b.listingId === "670000000000000000000221",
      );
      expect(b2Listing21.status).toBe("OUTBID");
    });
  });

  describe("Database Query Plan & Index Verification", () => {
    it("uses compound index for buyer order queries", async () => {
      const explainResult = await Order.find({
        buyerId: new ObjectId(buyer1Id),
        status: OrderStatus.PENDING,
      })
        .sort({ createdAt: -1 })
        .explain("executionStats");

      const winningPlan = (
        explainResult as unknown as { queryPlanner?: { winningPlan?: unknown } }
      ).queryPlanner?.winningPlan;
      expect(winningPlan).toBeDefined();

      const planString = JSON.stringify(winningPlan);
      expect(planString).toContain("IXSCAN");
      expect(planString).toContain("buyerId_1_status_1_createdAt_-1");
    });
  });
});
