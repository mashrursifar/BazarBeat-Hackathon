import mongoose from "mongoose";
import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOLDEN_EXPECTED_VALUES,
  GOLDEN_REFERENCE_DATE,
  ListingStatus,
  OrderStatus,
  type PublicUser,
  UserRole,
  buyerDashboardResponseSchema,
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
import { Bid } from "../bids/bid.model.js";
import { User } from "../users/user.model.js";
import { Crop } from "../crops/crop.model.js";
import { FarmerDashboardService } from "./farmer-dashboard.service.js";
import { BuyerDashboardService } from "./buyer-dashboard.service.js";
import { MarketPriceService } from "../market-prices/market-price.service.js";

const farmer1Id = "670000000000000000000001";
const farmer2Id = "670000000000000000000002";
const buyer1Id = "670000000000000000000011";
const emptyFarmerId = "670000000000000000000099";
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
  emptyBuyer: {
    id: emptyBuyerId,
    role: UserRole.BUYER,
    name: "New Empty Buyer",
    division: "barisal",
    district: "barisal",
    language: "en",
  },
};

function withAuthCookie(userKey: keyof typeof sessionUsers): string {
  return `accessToken=${userKey}`;
}

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;

describe("Task 7.12 — Review: Numbers, Performance, Accessibility & Privacy (P0)", () => {
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

    // Ensure empty users exist in DB
    await User.deleteMany({
      _id: { $in: [new ObjectId(emptyFarmerId), new ObjectId(emptyBuyerId)] },
    });

    await User.create([
      {
        _id: new ObjectId(emptyFarmerId),
        name: "New Empty Farmer",
        phone: "01799999999",
        role: UserRole.FARMER,
        division: "sylhet",
        district: "sylhet",
        passwordHash: "hash123",
        isActive: true,
        language: "en",
      },
      {
        _id: new ObjectId(emptyBuyerId),
        name: "New Empty Buyer",
        phone: "01788888888",
        role: UserRole.BUYER,
        division: "barisal",
        district: "barisal",
        passwordHash: "hash123",
        isActive: true,
        language: "en",
      },
    ]);
  });

  afterEach(() => {
    resetClock();
    vi.clearAllMocks();
  });

  describe("(1) Golden Dataset Re-Verification & Cross-Page Consistency", () => {
    it("re-verifies Farmer 1 dashboard numbers against golden dataset and cross-checks with Earnings & Sales", async () => {
      // 1. Fetch Farmer 1 Dashboard (30d)
      const dashRes = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(dashRes.status).toBe(200);
      const dashData = dashRes.body.data;
      const expected30d = GOLDEN_EXPECTED_VALUES.farmer1.kpis30d;

      expect(dashData.kpis.totalSales).toEqual(expected30d.totalSales);
      expect(dashData.kpis.earnings).toEqual(expected30d.earnings);
      expect(dashData.kpis.activeAuctions).toEqual(expected30d.activeAuctions);
      expect(dashData.kpis.pendingOrders).toEqual(expected30d.pendingOrders);
      expect(dashData.kpis.winRate).toEqual(expected30d.winRate);

      // 2. Fetch Farmer 1 Earnings API
      const earningsRes = await request(app)
        .get("/api/v1/earnings")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(earningsRes.status).toBe(200);
      const earningsData = earningsRes.body.data;

      // Cross-page consistency check:
      // In Earnings:
      // - settledNet is net from COMPLETED orders (654,679 poisha)
      // - expectedNet is net from in-progress orders (630,482 poisha)
      // - Total net earnings (settled + expected) MUST equal dashboard 30d earnings (1,285,161 poisha)
      const totalNetEarnings = earningsData.summary.settledNet + earningsData.summary.expectedNet;
      expect(totalNetEarnings).toBe(dashData.kpis.earnings.value);

      // Gross in Earnings matches dashboard booked total sales
      const bookedOrdersInDb = await Order.find({
        farmerId: new ObjectId(farmer1Id),
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.DISPUTED] },
      }).lean();

      const expectedGrossFromOrders = bookedOrdersInDb.reduce((sum, o) => sum + o.subtotal, 0);
      expect(dashData.kpis.totalSales.value).toBe(expectedGrossFromOrders);

      // 3. Fetch Farmer 1 Sales API
      const salesRes = await request(app)
        .get("/api/v1/sales")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(salesRes.status).toBe(200);
      const salesMeta = salesRes.body.meta;

      // Sales page lists only COMPLETED orders
      expect(salesMeta.totals.totalFarmerNet).toBe(earningsData.summary.settledNet);
      expect(salesMeta.totals.totalSubtotal).toBe(earningsData.summary.gross);
      expect(salesMeta.total).toBe(earningsData.summary.completedOrdersCount);

      // Active auctions consistency:
      const activeListingsCount = await Listing.countDocuments({
        farmerId: new ObjectId(farmer1Id),
        status: ListingStatus.ACTIVE,
      });
      expect(dashData.kpis.activeAuctions.value).toBe(activeListingsCount);
      expect(dashData.rightNow.activeAuctions).toBe(activeListingsCount);

      // Pending orders consistency:
      const pendingOrdersCount = await Order.countDocuments({
        farmerId: new ObjectId(farmer1Id),
        status: OrderStatus.PENDING,
      });
      expect(dashData.kpis.pendingOrders.value).toBe(pendingOrdersCount);
      expect(dashData.rightNow.ordersNeedingAction).toBe(pendingOrdersCount);
    });

    it("re-verifies Farmer 2 dashboard numbers including 7d percentage growth against golden dataset", async () => {
      // 30d check
      const dash30Res = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(dash30Res.status).toBe(200);
      const exp30 = GOLDEN_EXPECTED_VALUES.farmer2.kpis30d;
      expect(dash30Res.body.data.kpis.totalSales).toEqual(exp30.totalSales);
      expect(dash30Res.body.data.kpis.earnings).toEqual(exp30.earnings);
      expect(dash30Res.body.data.kpis.activeAuctions).toEqual(exp30.activeAuctions);
      expect(dash30Res.body.data.kpis.pendingOrders).toEqual(exp30.pendingOrders);
      expect(dash30Res.body.data.kpis.winRate).toEqual(exp30.winRate);

      // 7d check (+65.0% growth!)
      const dash7Res = await request(app)
        .get("/api/v1/dashboards/farmer?range=7d")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(dash7Res.status).toBe(200);
      const exp7 = GOLDEN_EXPECTED_VALUES.farmer2.kpis7d;
      expect(dash7Res.body.data.kpis.totalSales).toEqual(exp7.totalSales);
      expect(dash7Res.body.data.kpis.earnings).toEqual(exp7.earnings);
      expect(dash7Res.body.data.kpis.totalSales.changePercent).toBe(65.0);
      expect(dash7Res.body.data.kpis.earnings.changePercent).toBe(65.0);
    });

    it("re-verifies Buyer 1 dashboard numbers against golden dataset and cross-checks with Orders and Bids", async () => {
      // 1. Fetch Buyer 1 Dashboard (30d)
      const dashRes = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(dashRes.status).toBe(200);
      const dashData = dashRes.body.data;
      const expected30d = GOLDEN_EXPECTED_VALUES.buyer1.kpis30d;

      expect(dashData.kpis.totalSpend).toEqual(expected30d.totalSpend);
      expect(dashData.kpis.activeBids).toEqual(expected30d.activeBids);
      expect(dashData.kpis.winRate).toEqual(expected30d.winRate);
      expect(dashData.kpis.pendingOrders).toEqual(expected30d.pendingOrders);
      expect(dashData.kpis.avgPriceVsMarket).toEqual(expected30d.avgPriceVsMarket);
      expect(dashData.kpis.kgPurchased).toEqual(expected30d.kgPurchased);

      // 2. Cross-check total spend with database won orders
      const buyerWonOrders = await Order.find({
        buyerId: new ObjectId(buyer1Id),
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.DISPUTED] },
      }).lean();

      const calculatedSpend = buyerWonOrders.reduce((sum, o) => sum + o.subtotal, 0);
      expect(dashData.kpis.totalSpend.value).toBe(calculatedSpend);

      // 3. Cross-check active bids
      // Listing 21 (buyer1 is winning) + Listing 22 (buyer1 is outbid)
      const activeBidsCount = dashData.kpis.activeBids.value;
      expect(activeBidsCount).toBe(2);
      expect(dashData.activeBidsList).toHaveLength(2);

      const winningActiveBid = dashData.activeBidsList.find(
        (b: { status: string }) => b.status === "WINNING",
      );
      const outbidActiveBid = dashData.activeBidsList.find(
        (b: { status: string }) => b.status === "OUTBID",
      );
      expect(winningActiveBid).toBeDefined();
      expect(outbidActiveBid).toBeDefined();

      // 4. Cross-check pending orders count
      const buyerPendingOrders = await Order.countDocuments({
        buyerId: new ObjectId(buyer1Id),
        status: OrderStatus.PENDING,
      });
      expect(dashData.kpis.pendingOrders.value).toBe(buyerPendingOrders);
      expect(dashData.rightNow.ordersNeedingAction).toBe(buyerPendingOrders);
    });
  });

  describe("(2) Query Plan Inspection & Index Utilization", () => {
    it("confirms compound indexes are leveraged without COLLSCAN on core aggregation queries", async () => {
      // 1. Order queries for farmer dashboard
      const farmerOrderExplain = await Order.find({
        farmerId: new ObjectId(farmer1Id),
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.DISPUTED] },
        createdAt: {
          $gte: new Date("2026-10-18T00:00:00.000Z"),
          $lte: new Date("2026-11-16T23:59:59.999Z"),
        },
      }).explain("executionStats");

      const orderWinningStage = (
        farmerOrderExplain as unknown as {
          executionStats?: {
            executionStages?: { stage?: string; inputStage?: { stage?: string } };
          };
        }
      ).executionStats?.executionStages;
      const orderStage = orderWinningStage?.stage ?? orderWinningStage?.inputStage?.stage;
      expect(["IXSCAN", "FETCH"]).toContain(orderStage);

      // 2. Listing queries for farmer active auctions
      const listingExplain = await Listing.find({
        farmerId: new ObjectId(farmer1Id),
        status: ListingStatus.ACTIVE,
      }).explain("executionStats");

      const listingWinningStage = (
        listingExplain as unknown as {
          executionStats?: {
            executionStages?: { stage?: string; inputStage?: { stage?: string } };
          };
        }
      ).executionStats?.executionStages;
      const listingStage = listingWinningStage?.stage ?? listingWinningStage?.inputStage?.stage;
      expect(["IXSCAN", "FETCH"]).toContain(listingStage);

      // 3. Bid queries for buyer active bids
      const bidExplain = await Bid.find({
        buyerId: new ObjectId(buyer1Id),
      })
        .sort({ placedAt: -1 })
        .explain("executionStats");

      const bidWinningStage = (
        bidExplain as unknown as {
          executionStats?: {
            executionStages?: { stage?: string; inputStage?: { stage?: string } };
          };
        }
      ).executionStats?.executionStages;
      const bidStage = bidWinningStage?.stage ?? bidWinningStage?.inputStage?.stage;
      expect(["IXSCAN", "FETCH"]).toContain(bidStage);
    });

    it("measures execution timings on seeded history (target: sub-100ms)", async () => {
      const farmerService = new FarmerDashboardService();
      const buyerService = new BuyerDashboardService();
      const marketPriceService = new MarketPriceService();

      // Measure Farmer Dashboard (7d, 30d, 90d)
      const t0 = performance.now();
      const farmer7d = await farmerService.getFarmerDashboard(farmer1Id, { range: "7d" });
      const t1 = performance.now();
      const farmer30d = await farmerService.getFarmerDashboard(farmer1Id, { range: "30d" });
      const t2 = performance.now();
      const farmer90d = await farmerService.getFarmerDashboard(farmer1Id, { range: "90d" });
      const t3 = performance.now();

      // Measure Buyer Dashboard (7d, 30d, 90d)
      const buyer7d = await buyerService.getBuyerDashboard(buyer1Id, { range: "7d" });
      const t4 = performance.now();
      const buyer30d = await buyerService.getBuyerDashboard(buyer1Id, { range: "30d" });
      const t5 = performance.now();
      const buyer90d = await buyerService.getBuyerDashboard(buyer1Id, { range: "90d" });
      const t6 = performance.now();

      // Measure Market Price endpoints
      const sampleCrop = await Crop.findOne().lean();
      const marketHistory = await marketPriceService.getMarketHistory(
        sampleCrop!._id.toString(),
        "dhaka",
        "30d",
      );
      const t7 = performance.now();
      const marketOverview = await marketPriceService.getNationalSummary();
      const t8 = performance.now();

      const farmer7dMs = t1 - t0;
      const farmer30dMs = t2 - t1;
      const farmer90dMs = t3 - t2;
      const buyer7dMs = t4 - t3;
      const buyer30dMs = t5 - t4;
      const buyer90dMs = t6 - t5;
      const marketOverviewMs = t8 - t7;

      // Assert correctness of responses
      expect(farmer7d.data.kpis).toBeDefined();
      expect(farmer30d.data.kpis).toBeDefined();
      expect(farmer90d.data.kpis).toBeDefined();
      expect(buyer7d.data.kpis).toBeDefined();
      expect(buyer30d.data.kpis).toBeDefined();
      expect(buyer90d.data.kpis).toBeDefined();
      expect(marketHistory.data).toBeDefined();
      expect(marketOverview.data).toBeDefined();

      // Performance check: all core dashboard endpoints run sub-100ms
      expect(farmer7dMs).toBeLessThan(100);
      expect(farmer30dMs).toBeLessThan(100);
      expect(farmer90dMs).toBeLessThan(100);
      expect(buyer7dMs).toBeLessThan(100);
      expect(buyer30dMs).toBeLessThan(100);
      expect(buyer90dMs).toBeLessThan(100);
      expect(marketOverviewMs).toBeLessThan(100);
    });
  });

  describe("(3) Empty States for Brand-New Users & Zero-Data Boundary", () => {
    it("handles brand-new farmer with 0 listings, 0 sales, and 0 orders gracefully without NaN or null errors", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("emptyFarmer"));

      expect(response.status).toBe(200);
      const parsed = farmerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const { data } = response.body;

      // KPIs all cleanly 0, null percent changes
      expect(data.kpis.totalSales.value).toBe(0);
      expect(data.kpis.totalSales.previous).toBe(0);
      expect(data.kpis.totalSales.changePercent).toBeNull();

      expect(data.kpis.earnings.value).toBe(0);
      expect(data.kpis.earnings.previous).toBe(0);
      expect(data.kpis.earnings.changePercent).toBeNull();

      expect(data.kpis.activeAuctions.value).toBe(0);
      expect(data.kpis.pendingOrders.value).toBe(0);
      expect(data.kpis.winRate.value).toBe(0); // 0 closed auctions -> 0 win rate
      expect(data.kpis.winRate.changePercent).toBeNull();

      expect(data.kpis.topCrop).toBeNull();

      // Right-now cards
      expect(data.rightNow.activeAuctions).toBe(0);
      expect(data.rightNow.ordersNeedingAction).toBe(0);

      // Collections empty
      expect(data.endingSoonAuctions).toEqual([]);
      expect(data.earningsByCrop).toEqual([]);

      // Sales trend populated with continuous zero-filled buckets (not empty array)
      expect(data.salesTrend.length).toBeGreaterThan(0);
      data.salesTrend.forEach((b: { sales: number; orderCount: number; quantityKg: number }) => {
        expect(b.sales).toBe(0);
        expect(b.orderCount).toBe(0);
        expect(b.quantityKg).toBe(0);
      });
    });

    it("handles brand-new buyer with 0 bids, 0 spend, and 0 orders gracefully", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("emptyBuyer"));

      expect(response.status).toBe(200);
      const parsed = buyerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const { data } = response.body;

      expect(data.kpis.totalSpend.value).toBe(0);
      expect(data.kpis.activeBids.value).toBe(0);
      expect(data.kpis.winRate.value).toBe(0);
      expect(data.kpis.pendingOrders.value).toBe(0);
      expect(data.kpis.avgPriceVsMarket.value).toBe(0);
      expect(data.kpis.kgPurchased.value).toBe(0);

      expect(data.rightNow.winningBids).toBe(0);
      expect(data.rightNow.outbidBids).toBe(0);
      expect(data.rightNow.ordersNeedingAction).toBe(0);

      expect(data.activeBidsList).toEqual([]);
      expect(data.purchasesByCrop).toEqual([]);
      expect(data.recentOrders).toEqual([]);

      // Continuous zero-filled spend trend
      expect(data.spendTrend.length).toBeGreaterThan(0);
      data.spendTrend.forEach((b: { spend: number; orderCount: number; quantityKg: number }) => {
        expect(b.spend).toBe(0);
        expect(b.orderCount).toBe(0);
        expect(b.quantityKg).toBe(0);
      });
    });
  });

  describe("(4) Privacy Audit & Exact Allowed Key Sets (No Private Leaks)", () => {
    it("ensures Farmer Dashboard response strictly adheres to allowed keys with zero private field leaks", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/farmer?range=30d")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(response.status).toBe(200);

      const parsed = farmerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const serialized = JSON.stringify(response.body);

      // Prohibited sensitive keywords
      const forbiddenTokens = [
        "password",
        "passwordHash",
        "refreshToken",
        "refreshTokenHash",
        "buyerPhone",
        "farmerPhone",
        "secret",
        "__v",
      ];

      for (const token of forbiddenTokens) {
        expect(serialized).not.toContain(`"${token}"`);
      }

      // Check top-level keys
      expect(Object.keys(response.body).sort()).toEqual(["data", "meta"].sort());

      const dataKeys = Object.keys(response.body.data).sort();
      const expectedDataKeys = [
        "kpis",
        "rightNow",
        "salesTrend",
        "earningsByCrop",
        "endingSoonAuctions",
        "endingSoon",
      ].sort();
      expect(dataKeys).toEqual(expectedDataKeys);
    });

    it("ensures Buyer Dashboard response strictly adheres to allowed keys with zero private field leaks", async () => {
      const response = await request(app)
        .get("/api/v1/dashboards/buyer?range=30d")
        .set("Cookie", withAuthCookie("buyer1"));

      expect(response.status).toBe(200);

      const parsed = buyerDashboardResponseSchema.safeParse(response.body);
      expect(parsed.success).toBe(true);

      const serialized = JSON.stringify(response.body);

      const forbiddenTokens = [
        "password",
        "passwordHash",
        "refreshToken",
        "refreshTokenHash",
        "farmerPhone",
        "secret",
        "__v",
      ];

      for (const token of forbiddenTokens) {
        expect(serialized).not.toContain(`"${token}"`);
      }

      // Check top-level keys
      expect(Object.keys(response.body).sort()).toEqual(["data", "meta"].sort());

      const dataKeys = Object.keys(response.body.data).sort();
      const expectedDataKeys = [
        "kpis",
        "rightNow",
        "spendTrend",
        "purchasesByCrop",
        "activeBidsList",
        "nearestEndingBids",
        "recentOrders",
      ].sort();
      expect(dataKeys).toEqual(expectedDataKeys);
    });
  });
});
