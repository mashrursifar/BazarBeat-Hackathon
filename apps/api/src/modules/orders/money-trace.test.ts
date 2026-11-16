import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  ListingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type PublicUser,
  UserRole,
  calculateFeeAndNet,
  calculateSubtotal,
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

describe("Task 6.12 — Review: End-to-End Money Trace (P0)", () => {
  let replSet: MongoMemoryReplSet;
  let testClock: TestClock;

  const farmerId = new Types.ObjectId().toString();
  const buyer1Id = new Types.ObjectId().toString();
  const buyer2Id = new Types.ObjectId().toString();

  const farmerUser: PublicUser = {
    id: farmerId,
    role: UserRole.FARMER,
    name: "Hafizur Rahman",
    division: "Rajshahi",
    district: "Bogra",
    language: "en",
  };

  function withFarmerAuth(): string {
    authenticateAccessTokenMock.mockResolvedValueOnce(farmerUser);
    return "accessToken=valid-farmer-token";
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  afterAll(async () => {
    resetClock();
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date("2026-11-16T12:00:00.000Z"));
    setClock(testClock);

    await Promise.all([
      User.deleteMany({}),
      Crop.deleteMany({}),
      Listing.deleteMany({}),
      Order.deleteMany({}),
    ]);

    // Create users in DB for lookups / aggregation
    await User.create([
      {
        _id: farmerId,
        name: "Hafizur Rahman",
        phone: "01711111111",
        role: UserRole.FARMER,
        division: "Rajshahi",
        district: "Bogra",
        passwordHash: "dummyhash123",
      },
      {
        _id: buyer1Id,
        name: "Kabir Khan",
        phone: "01822222222",
        role: UserRole.BUYER,
        division: "Dhaka",
        district: "Gazipur",
        passwordHash: "dummyhash123",
      },
      {
        _id: buyer2Id,
        name: "Shafiqul Islam",
        phone: "01933333333",
        role: UserRole.BUYER,
        division: "Chittagong",
        district: "Comilla",
        passwordHash: "dummyhash123",
      },
    ]);
  });

  it("verifies end-to-end money agreement across awkward numbers (fractional kg, rounding fees)", async () => {
    // 1. Create 5 catalog crops
    const crops = await Crop.create([
      {
        slug: "potato",
        nameEn: "Potato",
        nameBn: "আলু",
        unit: "KG",
        minLotKg: 1,
        maxLotKg: 10000,
        shelfLifeHours: 720,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Good", B: "Fair", C: "Poor" },
        imageUrl: "https://img/potato.jpg",
        isActive: true,
      },
      {
        slug: "green-chilli",
        nameEn: "Green Chilli",
        nameBn: "কাঁচা মরিচ",
        unit: "KG",
        minLotKg: 1,
        maxLotKg: 10000,
        shelfLifeHours: 168,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Good", B: "Fair", C: "Poor" },
        imageUrl: "https://img/chilli.jpg",
        isActive: true,
      },
      {
        slug: "tomato",
        nameEn: "Tomato",
        nameBn: "টমেটো",
        unit: "KG",
        minLotKg: 1,
        maxLotKg: 10000,
        shelfLifeHours: 168,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Good", B: "Fair", C: "Poor" },
        imageUrl: "https://img/tomato.jpg",
        isActive: true,
      },
      {
        slug: "onion",
        nameEn: "Onion",
        nameBn: "পেঁয়াজ",
        unit: "KG",
        minLotKg: 1,
        maxLotKg: 10000,
        shelfLifeHours: 720,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Good", B: "Fair", C: "Poor" },
        imageUrl: "https://img/onion.jpg",
        isActive: true,
      },
      {
        slug: "eggplant",
        nameEn: "Eggplant",
        nameBn: "বেগুন",
        unit: "KG",
        minLotKg: 1,
        maxLotKg: 10000,
        shelfLifeHours: 168,
        minIncrementPerKg: 100,
        gradeGuide: { A: "Good", B: "Fair", C: "Poor" },
        imageUrl: "https://img/eggplant.jpg",
        isActive: true,
      },
    ]);

    const cropMap = new Map(crops.map((c) => [c.nameEn, c._id.toString()]));

    // Awkward test order specifications
    const testSpecs = [
      // Completed orders (should appear in sales totals and settled earnings)
      {
        cropName: "Potato",
        quantityKg: 12.3, // fractional kg
        pricePerKg: 3333, // awkward price (৳33.33/kg)
        status: OrderStatus.COMPLETED,
        buyerId: buyer1Id,
        completedAt: new Date("2026-11-14T10:00:00.000Z"),
      },
      {
        cropName: "Green Chilli",
        quantityKg: 0.7, // small fractional quantity
        pricePerKg: 8911, // awkward price (৳89.11/kg)
        status: OrderStatus.COMPLETED,
        buyerId: buyer2Id,
        completedAt: new Date("2026-11-15T10:00:00.000Z"),
      },
      {
        cropName: "Tomato",
        quantityKg: 125.5, // 125.5 kg
        pricePerKg: 1729, // ৳17.29/kg
        status: OrderStatus.COMPLETED,
        buyerId: buyer1Id,
        completedAt: new Date("2026-11-16T10:00:00.000Z"),
      },
      // Active orders (should contribute to expectedNet in earnings, but NOT settled or sales totals)
      {
        cropName: "Onion",
        quantityKg: 33.3,
        pricePerKg: 4567, // ৳45.67/kg
        status: OrderStatus.CONFIRMED,
        buyerId: buyer1Id,
      },
      {
        cropName: "Eggplant",
        quantityKg: 7.1,
        pricePerKg: 2875, // ৳28.75/kg
        status: OrderStatus.DELIVERED,
        buyerId: buyer2Id,
        deliveredAt: new Date("2026-11-16T11:00:00.000Z"),
      },
      // Disputed order (must be tracked separately in disputedNet, excluded from settled & expected)
      {
        cropName: "Potato",
        quantityKg: 18.7,
        pricePerKg: 3111,
        status: OrderStatus.DISPUTED,
        buyerId: buyer1Id,
        deliveredAt: new Date("2026-11-16T08:00:00.000Z"),
        dispute: {
          reason: "GRADE_LOWER_THAN_LISTED",
          note: "Lower quality",
          raisedAt: new Date("2026-11-16T11:00:00.000Z"),
        },
      },
      // Cancelled order (must be completely excluded from sales, settled, expected, and disputed)
      {
        cropName: "Tomato",
        quantityKg: 50.5,
        pricePerKg: 2500,
        status: OrderStatus.CANCELLED,
        buyerId: buyer2Id,
        cancelledAt: new Date("2026-11-16T09:00:00.000Z"),
      },
    ];

    let expectedCompletedSubtotal = 0;
    let expectedCompletedFees = 0;
    let expectedCompletedNet = 0;
    let expectedCompletedKg = 0;

    let expectedActiveNet = 0;
    let expectedDisputedNet = 0;

    for (const spec of testSpecs) {
      const cropId = cropMap.get(spec.cropName)!;
      const listingId = new Types.ObjectId();

      // Create Listing
      await Listing.create({
        _id: listingId,
        farmerId,
        cropId,
        quantityKg: spec.quantityKg,
        floorPricePerKg: spec.pricePerKg,
        minIncrementPerKg: 100,
        images: [{ url: "https://img/lot.jpg", width: 800, height: 600 }],
        status: ListingStatus.SOLD,
        location: { division: "Rajshahi", district: "Bogra" },
        startsAt: new Date("2026-11-14T08:00:00.000Z"),
        endsAt: new Date("2026-11-14T09:00:00.000Z"),
        originalEndsAt: new Date("2026-11-14T09:00:00.000Z"),
        extensionCount: 0,
        aiAssessment: {
          grade: CropGrade.A,
          confidence: 0.95,
          confidenceBand: "HIGH",
          classProbabilities: { A: 0.95, B: 0.05, C: 0.0 },
          qualityNotes: ["Good produce"],
          cropMatch: true,
          modelVersion: "1.0",
          provider: "mock",
          degraded: false,
          assessedAt: new Date("2026-11-14T07:50:00.000Z"),
          imageHashes: ["dummyhash"],
        },
        aiPriceGuidance: {
          lowPerKg: spec.pricePerKg - 500,
          expectedPerKg: spec.pricePerKg,
          highPerKg: spec.pricePerKg + 500,
          trend: "FLAT",
          confidence: 0.9,
          explanation: ["Baseline"],
          modelVersion: "1.0",
          provider: "mock",
          degraded: false,
          generatedAt: new Date("2026-11-14T07:50:00.000Z"),
          suggestedFloorPerKg: spec.pricePerKg,
        },
      });

      // Pure math calculations
      const subtotal = calculateSubtotal(spec.pricePerKg, spec.quantityKg);
      const { platformFee, farmerNet } = calculateFeeAndNet(subtotal, 200); // 200 bps = 2%

      // Verify the primary financial invariant for each individual order:
      expect(platformFee + farmerNet).toBe(subtotal);
      expect(Number.isInteger(subtotal)).toBe(true);
      expect(Number.isInteger(platformFee)).toBe(true);
      expect(Number.isInteger(farmerNet)).toBe(true);

      if (spec.status === OrderStatus.COMPLETED) {
        expectedCompletedKg += spec.quantityKg;
        expectedCompletedSubtotal += subtotal;
        expectedCompletedFees += platformFee;
        expectedCompletedNet += farmerNet;
      } else if (spec.status === OrderStatus.CONFIRMED || spec.status === OrderStatus.DELIVERED) {
        expectedActiveNet += farmerNet;
      } else if (spec.status === OrderStatus.DISPUTED) {
        expectedDisputedNet += farmerNet;
      }

      await Order.create({
        listingId,
        farmerId,
        buyerId: spec.buyerId,
        cropId,
        quantityKg: spec.quantityKg,
        grade: CropGrade.A,
        pricePerKg: spec.pricePerKg,
        subtotal,
        platformFee,
        farmerNet,
        status: spec.status,
        payment: {
          status: spec.status === OrderStatus.COMPLETED ? PaymentStatus.PAID : PaymentStatus.UNPAID,
          method: PaymentMethod.WALLET_SIM,
        },
        ...(spec.completedAt ? { completedAt: spec.completedAt } : {}),
        ...(spec.deliveredAt ? { deliveredAt: spec.deliveredAt } : {}),
        ...(spec.cancelledAt ? { cancelledAt: spec.cancelledAt } : {}),
        ...(spec.dispute ? { dispute: spec.dispute } : {}),
      });
    }

    // Invariant: sum of completed fees + sum of completed farmer net === sum of completed subtotals
    expect(expectedCompletedFees + expectedCompletedNet).toBe(expectedCompletedSubtotal);

    // 2. Query GET /api/v1/sales and verify meta.totals
    const salesResponse = await request(app)
      .get("/api/v1/sales?limit=50")
      .set("Cookie", withFarmerAuth());

    expect(salesResponse.status).toBe(200);
    const salesTotals = salesResponse.body.meta.totals;
    expect(salesTotals).toBeDefined();

    // Assert exact agreement on sales totals
    expect(salesTotals.totalQuantityKg).toBe(Math.round(expectedCompletedKg * 10) / 10);
    expect(salesTotals.totalSubtotal).toBe(expectedCompletedSubtotal);
    expect(salesTotals.totalPlatformFee).toBe(expectedCompletedFees);
    expect(salesTotals.totalFarmerNet).toBe(expectedCompletedNet);
    expect(salesTotals.totalPlatformFee + salesTotals.totalFarmerNet).toBe(salesTotals.totalSubtotal);

    // 3. Query GET /api/v1/earnings and verify financial summary
    const earningsResponse = await request(app)
      .get("/api/v1/earnings")
      .set("Cookie", withFarmerAuth());

    expect(earningsResponse.status).toBe(200);
    const summary = earningsResponse.body.data.summary;
    expect(summary).toBeDefined();

    // Assert exact agreement on earnings figures
    expect(summary.gross).toBe(expectedCompletedSubtotal);
    expect(summary.fees).toBe(expectedCompletedFees);
    expect(summary.settledNet).toBe(expectedCompletedNet);
    expect(summary.expectedNet).toBe(expectedActiveNet);
    expect(summary.disputedNet).toBe(expectedDisputedNet);
    expect(summary.disputedOrdersCount).toBe(1);
    expect(summary.completedOrdersCount).toBe(3);

    // Verify all returned financial values are safe integers (zero float leaks)
    for (const val of [
      summary.gross,
      summary.fees,
      summary.settledNet,
      summary.expectedNet,
      summary.disputedNet,
      salesTotals.totalSubtotal,
      salesTotals.totalPlatformFee,
      salesTotals.totalFarmerNet,
    ]) {
      expect(Number.isSafeInteger(val)).toBe(true);
    }
  });
});
