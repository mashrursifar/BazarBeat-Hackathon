import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type PublicUser,
  UserRole,
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
import { Listing } from "../listings/listing.model.js";
import { User } from "../users/user.model.js";
import { Order } from "./order.model.js";

const farmer1Id = new Types.ObjectId().toString();
const farmer2Id = new Types.ObjectId().toString();
const buyer1Id = new Types.ObjectId().toString();
const buyer2Id = new Types.ObjectId().toString();
const onionCropId = new Types.ObjectId().toString();
const chilliCropId = new Types.ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmer1: {
    id: farmer1Id,
    role: UserRole.FARMER,
    name: "Rahim Farmer",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  farmer2: {
    id: farmer2Id,
    role: UserRole.FARMER,
    name: "Karim Farmer",
    division: "rajshahi",
    district: "bogra",
    language: "en",
  },
  buyer1: {
    id: buyer1Id,
    role: UserRole.BUYER,
    name: "Buyer Dhaka Traders",
    division: "Dhaka",
    district: "dhaka",
    language: "en",
  },
  buyer2: {
    id: buyer2Id,
    role: UserRole.BUYER,
    name: "Buyer Rajshahi Foods",
    division: "Rajshahi",
    district: "bogra",
    language: "en",
  },
};

function withAuthCookie(userKey: keyof typeof sessionUsers): string {
  return `accessToken=${userKey}`;
}

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;

describe("Task 6.6 — Sales and Earnings Endpoints (P1)", () => {
  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongoReplSet.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoReplSet) {
      await mongoReplSet.stop();
    }
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date("2026-11-16T12:00:00.000Z"));
    setClock(testClock);

    authenticateAccessTokenMock.mockImplementation(async (token: string) => {
      const u = sessionUsers[token];
      if (!u) throw new Error("Invalid token");
      return u;
    });

    // Clean DB
    await Order.deleteMany({});
    await Listing.deleteMany({});
    await Crop.deleteMany({});
    await User.deleteMany({});

    // Seed Crops
    await Crop.create([
      {
        _id: onionCropId,
        nameEn: "Onion",
        nameBn: "পেঁয়াজ",
        slug: "onion",
        unit: "KG",
        shelfLifeHours: 720,
        minLotKg: 10,
        maxLotKg: 5000,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Firm", B: "Minor blemishes", C: "Soft" },
        imageUrl: "https://example.com/onion.jpg",
        isActive: true,
      },
      {
        _id: chilliCropId,
        nameEn: "Green Chilli",
        nameBn: "কাঁচা মরিচ",
        slug: "green-chilli",
        unit: "KG",
        shelfLifeHours: 168,
        minLotKg: 5,
        maxLotKg: 1000,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Fresh and crisp", B: "Slightly soft", C: "Discolored" },
        imageUrl: "https://example.com/chilli.jpg",
        isActive: true,
      },
    ]);

    // Seed Users
    await User.create([
      {
        _id: farmer1Id,
        role: UserRole.FARMER,
        name: "Rahim Farmer",
        phone: "01700000001",
        division: "dhaka",
        district: "dhaka",
        passwordHash: "hash",
      },
      {
        _id: farmer2Id,
        role: UserRole.FARMER,
        name: "Karim Farmer",
        phone: "01700000002",
        division: "rajshahi",
        district: "bogra",
        passwordHash: "hash",
      },
      {
        _id: buyer1Id,
        role: UserRole.BUYER,
        name: "Buyer Dhaka Traders",
        phone: "01712345678",
        division: "Dhaka",
        district: "dhaka",
        passwordHash: "hash",
      },
      {
        _id: buyer2Id,
        role: UserRole.BUYER,
        name: "Buyer Rajshahi Foods",
        phone: "01712345679",
        division: "Rajshahi",
        district: "bogra",
        passwordHash: "hash",
      },
    ]);

    const defaultAssessment = {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH" as const,
      classProbabilities: { A: 0.95, B: 0.05, C: 0.0 },
      qualityNotes: ["High quality"],
      cropMatch: true,
      modelVersion: "1.0",
      provider: "mock",
      degraded: false,
      assessedAt: testClock.now(),
      imageHashes: ["hash1"],
    };

    function makePriceGuidance(expectedPerKg: number): Record<string, unknown> {
      return {
        lowPerKg: Math.round(expectedPerKg * 0.9),
        expectedPerKg,
        highPerKg: Math.round(expectedPerKg * 1.1),
        trend: "FLAT" as const,
        confidence: 0.9,
        explanation: ["Stable market"],
        modelVersion: "1.0",
        provider: "mock",
        degraded: false,
        generatedAt: testClock.now(),
        suggestedFloorPerKg: Math.round(expectedPerKg * 0.8),
      };
    }

    const listingHelper = async (
      farmer: string,
      crop: string,
      qty: number,
      expectedPrice: number
    ): Promise<{ _id: string }> => {
      const doc = await Listing.create({
        farmerId: farmer as unknown as Types.ObjectId,
        cropId: crop as unknown as Types.ObjectId,
        quantityKg: qty,
        floorPricePerKg: Math.round(expectedPrice * 0.8),
        minIncrementPerKg: 100,
        images: [{ url: "https://example.com/lot.jpg", width: 800, height: 600 }],
        aiAssessment: defaultAssessment,
        aiPriceGuidance: makePriceGuidance(expectedPrice),
        startsAt: new Date("2026-05-01"),
        endsAt: new Date("2026-11-20"),
        originalEndsAt: new Date("2026-11-20"),
        extensionCount: 0,
        status: "SOLD",
        location: { division: "Dhaka", district: "Dhaka" },
      });
      return { _id: String(doc._id) };
    };

    const listing1 = await listingHelper(farmer1Id, onionCropId, 100, 5000);
    const listing2 = await listingHelper(farmer1Id, onionCropId, 50, 5000);
    const listing3 = await listingHelper(farmer1Id, chilliCropId, 40, 14000);
    const listing4 = await listingHelper(farmer1Id, chilliCropId, 10, 14000);
    const listing5 = await listingHelper(farmer1Id, onionCropId, 30, 4800);
    const listing6 = await listingHelper(farmer1Id, chilliCropId, 20, 14000);
    const listing7 = await listingHelper(farmer1Id, onionCropId, 40, 4800);
    const listing8 = await listingHelper(farmer1Id, chilliCropId, 25, 14000);
    const listing9 = await listingHelper(farmer2Id, onionCropId, 500, 5000);

    // Seed Hand-Calculated Orders Dataset:
    // Order 1: Farmer 1, COMPLETED, Nov 2026 (2026-11-10T10:00:00Z)
    // 100 kg @ 5500 = 550,000 subtotal, fee: 11,000, net: 539,000
    await Order.create({
      listingId: listing1._id,
      farmerId: farmer1Id,
      buyerId: buyer1Id,
      cropId: onionCropId,
      quantityKg: 100,
      grade: CropGrade.A,
      pricePerKg: 5500,
      subtotal: 550000,
      platformFee: 11000,
      farmerNet: 539000,
      status: OrderStatus.COMPLETED,
      payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      completedAt: new Date("2026-11-10T10:00:00.000Z"),
      createdAt: new Date("2026-11-09T10:00:00.000Z"),
    });

    // Order 2: Farmer 1, COMPLETED, Oct 2026 (2026-10-15T08:00:00Z)
    // 50 kg @ 4800 = 240,000 subtotal, fee: 4,800, net: 235,200
    await Order.create({
      listingId: listing2._id,
      farmerId: farmer1Id,
      buyerId: buyer2Id,
      cropId: onionCropId,
      quantityKg: 50,
      grade: CropGrade.B,
      pricePerKg: 4800,
      subtotal: 240000,
      platformFee: 4800,
      farmerNet: 235200,
      status: OrderStatus.COMPLETED,
      payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      completedAt: new Date("2026-10-15T08:00:00.000Z"),
      createdAt: new Date("2026-10-14T08:00:00.000Z"),
    });

    // Order 3: Farmer 1, COMPLETED, May 31 19:00Z -> Jun 1 01:00 Dhaka time (2026-06)
    // 40 kg @ 15000 = 600,000 subtotal, fee: 12,000, net: 588,000
    await Order.create({
      listingId: listing3._id,
      farmerId: farmer1Id,
      buyerId: buyer1Id,
      cropId: chilliCropId,
      quantityKg: 40,
      grade: CropGrade.A,
      pricePerKg: 15000,
      subtotal: 600000,
      platformFee: 12000,
      farmerNet: 588000,
      status: OrderStatus.COMPLETED,
      payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      completedAt: new Date("2026-05-31T19:00:00.000Z"),
      createdAt: new Date("2026-05-31T12:00:00.000Z"),
    });

    // Order 4: Farmer 1, COMPLETED, Jun 30 17:59:59Z -> Jun 30 23:59:59 Dhaka time (2026-06)
    // 10 kg @ 16000 = 160,000 subtotal, fee: 3,200, net: 156,800
    await Order.create({
      listingId: listing4._id,
      farmerId: farmer1Id,
      buyerId: buyer1Id,
      cropId: chilliCropId,
      quantityKg: 10,
      grade: CropGrade.A,
      pricePerKg: 16000,
      subtotal: 160000,
      platformFee: 3200,
      farmerNet: 156800,
      status: OrderStatus.COMPLETED,
      payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      completedAt: new Date("2026-06-30T17:59:59.000Z"),
      createdAt: new Date("2026-06-29T10:00:00.000Z"),
    });

    // Order 5: Farmer 1, PENDING (active)
    // 30 kg @ 5000 = 150,000 subtotal, fee: 3,000, net: 147,000
    await Order.create({
      listingId: listing5._id,
      farmerId: farmer1Id,
      buyerId: buyer1Id,
      cropId: onionCropId,
      quantityKg: 30,
      grade: CropGrade.B,
      pricePerKg: 5000,
      subtotal: 150000,
      platformFee: 3000,
      farmerNet: 147000,
      status: OrderStatus.PENDING,
      payment: { status: PaymentStatus.UNPAID },
      createdAt: new Date("2026-11-15T08:00:00.000Z"),
    });

    // Order 6: Farmer 1, CONFIRMED (active)
    // 20 kg @ 14500 = 290,000 subtotal, fee: 5,800, net: 284,200
    await Order.create({
      listingId: listing6._id,
      farmerId: farmer1Id,
      buyerId: buyer2Id,
      cropId: chilliCropId,
      quantityKg: 20,
      grade: CropGrade.B,
      pricePerKg: 14500,
      subtotal: 290000,
      platformFee: 5800,
      farmerNet: 284200,
      status: OrderStatus.CONFIRMED,
      payment: { status: PaymentStatus.UNPAID },
      confirmedAt: new Date("2026-11-15T10:00:00.000Z"),
      createdAt: new Date("2026-11-15T09:00:00.000Z"),
    });

    // Order 7: Farmer 1, CANCELLED (must be excluded from settled & expected)
    await Order.create({
      listingId: listing7._id,
      farmerId: farmer1Id,
      buyerId: buyer1Id,
      cropId: onionCropId,
      quantityKg: 40,
      grade: CropGrade.C,
      pricePerKg: 5000,
      subtotal: 200000,
      platformFee: 4000,
      farmerNet: 196000,
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date("2026-11-14T10:00:00.000Z"),
      createdAt: new Date("2026-11-13T09:00:00.000Z"),
    });

    // Order 8: Farmer 1, DISPUTED (must be excluded from settled & expected)
    await Order.create({
      listingId: listing8._id,
      farmerId: farmer1Id,
      buyerId: buyer1Id,
      cropId: chilliCropId,
      quantityKg: 25,
      grade: CropGrade.B,
      pricePerKg: 12000,
      subtotal: 300000,
      platformFee: 6000,
      farmerNet: 294000,
      status: OrderStatus.DISPUTED,
      dispute: {
        reason: "GRADE_MISMATCH",
        note: "Produce quality lower than expected",
        raisedAt: new Date("2026-11-14T12:00:00.000Z"),
      },
      createdAt: new Date("2026-11-13T10:00:00.000Z"),
    });

    // Order 9: Farmer 2, COMPLETED (isolation check)
    await Order.create({
      listingId: listing9._id,
      farmerId: farmer2Id,
      buyerId: buyer1Id,
      cropId: onionCropId,
      quantityKg: 500,
      grade: CropGrade.A,
      pricePerKg: 5000,
      subtotal: 2500000,
      platformFee: 50000,
      farmerNet: 2450000,
      status: OrderStatus.COMPLETED,
      payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      completedAt: new Date("2026-11-14T12:00:00.000Z"),
      createdAt: new Date("2026-11-13T10:00:00.000Z"),
    });
  });

  afterEach(() => {
    resetClock();
  });

  describe("GET /api/v1/earnings", () => {
    it("returns 401 when unauthenticated and 403 for non-farmer roles", async () => {
      const resUnauth = await request(app).get("/api/v1/earnings");
      expect(resUnauth.status).toBe(401);

      const resBuyer = await request(app)
        .get("/api/v1/earnings")
        .set("Cookie", withAuthCookie("buyer1"));
      expect(resBuyer.status).toBe(403);
    });

    it("calculates exact settled totals against the hand-calculated dataset", async () => {
      const res = await request(app)
        .get("/api/v1/earnings")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      const summary = res.body.data.summary;

      // Completed Orders: 1, 2, 3, 4
      // Gross: 550000 + 240000 + 600000 + 160000 = 1,550,000 poisha
      expect(summary.gross).toBe(1550000);
      expect(summary.totalSubtotal).toBe(1550000);

      // Fees: 11000 + 4800 + 12000 + 3200 = 31,000 poisha
      expect(summary.fees).toBe(31000);
      expect(summary.totalPlatformFees).toBe(31000);

      // Settled Net: 539000 + 235200 + 588000 + 156800 = 1,519,000 poisha
      expect(summary.settledNet).toBe(1519000);
      expect(summary.totalEarnings).toBe(1519000);

      // Completed count: 4 orders
      expect(summary.completedOrdersCount).toBe(4);

      // Expected Net from active non-cancelled/non-disputed orders (Orders 5 & 6):
      // Order 5 (30kg @ 5000 net 147000) + Order 6 (20kg @ 14500 net 284200) = 431,200 poisha
      expect(summary.expectedNet).toBe(431200);
      expect(summary.totalExpectedNet).toBe(1519000 + 431200);

      // Cancelled (Order 7: 196,000) and Disputed (Order 8: 294,000) are strictly excluded
      // Fee rate
      expect(summary.feeRateBps).toBe(200);
      expect(summary.feeRatePercent).toBe(2.0);
      expect(res.body.data.feeRate).toEqual({ bps: 200, percent: 2.0 });
    });

    it("calculates quantity-weighted price premium overall and per crop", async () => {
      const res = await request(app)
        .get("/api/v1/earnings")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      const { summary, byCrop } = res.body.data;

      // Overall: Winning = 1,550,000, Expected = 1,450,000 => ((1550000 - 1450000) / 1450000) * 100 = 6.9%
      expect(summary.averagePricePremiumPercent).toBe(6.9);
      expect(summary.averagePremiumPercent).toBe(6.9);

      // By Crop: exactly 2 crops
      expect(byCrop).toHaveLength(2);

      const onion = byCrop.find((c: { cropName: string }) => c.cropName === "Onion");
      expect(onion).toBeDefined();
      expect(onion.totalKg).toBe(150.0);
      expect(onion.totalEarnings).toBe(774200);
      expect(onion.averagePricePerKg).toBe(5267); // Math.round(790000 / 150)
      expect(onion.orderCount).toBe(2);
      expect(onion.averagePremiumPercent).toBe(5.3); // ((790000 - 750000) / 750000) * 100

      const chilli = byCrop.find((c: { cropName: string }) => c.cropName === "Green Chilli");
      expect(chilli).toBeDefined();
      expect(chilli.totalKg).toBe(50.0);
      expect(chilli.totalEarnings).toBe(744800);
      expect(chilli.averagePricePerKg).toBe(15200); // 760000 / 50
      expect(chilli.orderCount).toBe(2);
      expect(chilli.averagePremiumPercent).toBe(8.6); // ((760000 - 700000) / 700000) * 100
    });

    it("correctly groups the last 6 months series at month boundaries in Asia/Dhaka time", async () => {
      const res = await request(app)
        .get("/api/v1/earnings")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      const series = res.body.data.monthlySeries;

      // 6 continuous months ending in current Dhaka month (Nov 2026)
      expect(series).toHaveLength(6);
      expect(series.map((s: { month: string }) => s.month)).toEqual([
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
      ]);

      // 2026-06 contains Order 3 (May 31 19:00Z -> Jun 1 01:00 Dhaka) AND Order 4 (Jun 30 17:59:59Z -> Jun 30 23:59:59 Dhaka)
      const jun = series[0];
      expect(jun.month).toBe("2026-06");
      expect(jun.orderCount).toBe(2);
      expect(jun.gross).toBe(760000);
      expect(jun.fees).toBe(15200);
      expect(jun.net).toBe(744800);
      expect(jun.totalKg).toBe(50.0);

      // 2026-07, 08, 09 have zero sales
      expect(series[1].orderCount).toBe(0);
      expect(series[1].net).toBe(0);
      expect(series[2].orderCount).toBe(0);
      expect(series[2].net).toBe(0);
      expect(series[3].orderCount).toBe(0);
      expect(series[3].net).toBe(0);

      // 2026-10 contains Order 2 (50kg @ 4800)
      const oct = series[4];
      expect(oct.month).toBe("2026-10");
      expect(oct.orderCount).toBe(1);
      expect(oct.gross).toBe(240000);
      expect(oct.fees).toBe(4800);
      expect(oct.net).toBe(235200);
      expect(oct.totalKg).toBe(50.0);

      // 2026-11 contains Order 1 (100kg @ 5500)
      const nov = series[5];
      expect(nov.month).toBe("2026-11");
      expect(nov.orderCount).toBe(1);
      expect(nov.gross).toBe(550000);
      expect(nov.fees).toBe(11000);
      expect(nov.net).toBe(539000);
      expect(nov.totalKg).toBe(100.0);
    });

    it("strictly isolates farmer data so Farmer 2 only sees Farmer 2's data", async () => {
      const res = await request(app)
        .get("/api/v1/earnings")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(res.status).toBe(200);
      const summary = res.body.data.summary;

      // Farmer 2 has only Order 9: subtotal 2,500,000, fee 50,000, net 2,450,000
      expect(summary.gross).toBe(2500000);
      expect(summary.fees).toBe(50000);
      expect(summary.settledNet).toBe(2450000);
      expect(summary.completedOrdersCount).toBe(1);
      expect(summary.expectedNet).toBe(0);
    });
  });

  describe("GET /api/v1/sales", () => {
    it("returns 401 when unauthenticated and 403 for non-farmer roles", async () => {
      const resUnauth = await request(app).get("/api/v1/sales");
      expect(resUnauth.status).toBe(401);

      const resBuyer = await request(app)
        .get("/api/v1/sales")
        .set("Cookie", withAuthCookie("buyer1"));
      expect(resBuyer.status).toBe(403);
    });

    it("returns paginated completed sales with totals in meta for unfiltered set", async () => {
      const res = await request(app)
        .get("/api/v1/sales")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);

      // Totals in meta for all 4 completed orders
      const totals = res.body.meta.totals;
      expect(totals.totalQuantityKg).toBe(200.0);
      expect(totals.totalSubtotal).toBe(1550000);
      expect(totals.totalPlatformFee).toBe(31000);
      expect(totals.totalFarmerNet).toBe(1519000);
      expect(totals.count).toBe(4);

      // Every item has required fields
      const item = res.body.data[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("listingId");
      expect(item).toHaveProperty("cropName");
      expect(item).toHaveProperty("grade");
      expect(item).toHaveProperty("quantityKg");
      expect(item).toHaveProperty("pricePerKg");
      expect(item).toHaveProperty("subtotal");
      expect(item).toHaveProperty("platformFee");
      expect(item).toHaveProperty("farmerNet");
      expect(item).toHaveProperty("buyerName");
      expect(item).toHaveProperty("buyerRegion");
      expect(item).toHaveProperty("date");
      expect(item.status).toBe(OrderStatus.COMPLETED);
    });

    it("filters completed sales by crop and returns accurate subset totals in meta", async () => {
      const res = await request(app)
        .get(`/api/v1/sales?cropId=${onionCropId}`)
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2); // Only Orders 1 and 2

      const totals = res.body.meta.totals;
      expect(totals.totalQuantityKg).toBe(150.0);
      expect(totals.totalSubtotal).toBe(790000);
      expect(totals.totalPlatformFee).toBe(15800);
      expect(totals.totalFarmerNet).toBe(774200);
      expect(totals.count).toBe(2);
    });

    it("filters completed sales by buyer division and returns accurate subset totals in meta", async () => {
      const res = await request(app)
        .get("/api/v1/sales?buyerDivision=Rajshahi")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1); // Only Order 2 was bought by Buyer 2 (Rajshahi)

      const order2 = res.body.data[0];
      expect(order2.buyerRegion).toBe("Rajshahi");
      expect(order2.quantityKg).toBe(50.0);
      expect(order2.subtotal).toBe(240000);

      const totals = res.body.meta.totals;
      expect(totals.totalQuantityKg).toBe(50.0);
      expect(totals.totalSubtotal).toBe(240000);
      expect(totals.totalPlatformFee).toBe(4800);
      expect(totals.totalFarmerNet).toBe(235200);
      expect(totals.count).toBe(1);
    });

    it("filters completed sales by date range and returns accurate subset totals in meta", async () => {
      const res = await request(app)
        .get("/api/v1/sales?from=2026-11-01T00:00:00.000Z")
        .set("Cookie", withAuthCookie("farmer1"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1); // Only Order 1 (Nov 10)

      const order1 = res.body.data[0];
      expect(order1.subtotal).toBe(550000);

      const totals = res.body.meta.totals;
      expect(totals.totalQuantityKg).toBe(100.0);
      expect(totals.totalSubtotal).toBe(550000);
      expect(totals.totalPlatformFee).toBe(11000);
      expect(totals.totalFarmerNet).toBe(539000);
      expect(totals.count).toBe(1);
    });

    it("strictly isolates sales so Farmer 2 only sees Farmer 2's completed orders", async () => {
      const res = await request(app)
        .get("/api/v1/sales")
        .set("Cookie", withAuthCookie("farmer2"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].quantityKg).toBe(500.0);
      expect(res.body.meta.totals.totalFarmerNet).toBe(2450000);
    });
  });
});
