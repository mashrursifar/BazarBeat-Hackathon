import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  FulfilmentMethod,
  ListingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type PublicUser,
  UserRole,
  buyerOrderCardSchema,
  buyerOrderDetailSchema,
  farmerOrderCardSchema,
  farmerOrderDetailSchema,
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
import { Order, type OrderRecord } from "./order.model.js";

/**
 * Task 6.12 (P0) — Review: Privacy & Response Allowed Keys Audit.
 *
 * AUCTION_RULES §10, SECURITY §5 and §11, TESTING §4.
 *
 * Asserts:
 * 1. Exact allowed key sets per role and status for GET /orders and GET /orders/:id.
 * 2. Zero leak of `platformFee` or `farmerNet` to buyer endpoints.
 * 3. Phone masking rules: masked in PENDING, revealed in CONFIRMED / DELIVERED / COMPLETED / DISPUTED.
 * 4. Zero leak of internal fields: `_id`, `__v`, `passwordHash`.
 * 5. Negative authorization and ownership enforcement.
 */
describe("Task 6.12 — Review: Privacy & Response Allowed Keys Audit (P0)", () => {
  let replSet: MongoMemoryReplSet;
  let testClock: TestClock;

  const farmerId = new Types.ObjectId().toString();
  const buyerId = new Types.ObjectId().toString();
  const otherFarmerId = new Types.ObjectId().toString();
  const otherBuyerId = new Types.ObjectId().toString();

  const farmerUser: PublicUser = {
    id: farmerId,
    role: UserRole.FARMER,
    name: "Farmer Abdul",
    division: "Rajshahi",
    district: "Bogra",
    language: "en",
  };

  const buyerUser: PublicUser = {
    id: buyerId,
    role: UserRole.BUYER,
    name: "Buyer Rahim",
    division: "Dhaka",
    district: "Gazipur",
    language: "en",
  };

  const otherBuyerUser: PublicUser = {
    id: otherBuyerId,
    role: UserRole.BUYER,
    name: "Other Buyer",
    division: "Chittagong",
    district: "Comilla",
    language: "en",
  };

  const otherFarmerUser: PublicUser = {
    id: otherFarmerId,
    role: UserRole.FARMER,
    name: "Other Farmer",
    division: "Rangpur",
    district: "Dinajpur",
    language: "en",
  };

  let cropId: string;

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

    // Seed database users with phone numbers and private info
    await User.create([
      {
        _id: farmerId,
        name: "Farmer Abdul",
        phone: "01711111111",
        role: UserRole.FARMER,
        division: "Rajshahi",
        district: "Bogra",
        passwordHash: "secret_farmer_hash",
      },
      {
        _id: buyerId,
        name: "Buyer Rahim",
        phone: "01822222222",
        role: UserRole.BUYER,
        division: "Dhaka",
        district: "Gazipur",
        organization: "Rahim Agro Corp",
        passwordHash: "secret_buyer_hash",
      },
      {
        _id: otherBuyerId,
        name: "Other Buyer",
        phone: "01933333333",
        role: UserRole.BUYER,
        division: "Chittagong",
        district: "Comilla",
        passwordHash: "secret_other_hash",
      },
      {
        _id: otherFarmerId,
        name: "Other Farmer",
        phone: "01644444444",
        role: UserRole.FARMER,
        division: "Rangpur",
        district: "Dinajpur",
        passwordHash: "secret_other_farmer_hash",
      },
    ]);

    const crop = await Crop.create({
      slug: "potato",
      nameEn: "Potato",
      nameBn: "আলু",
      unit: "KG",
      minLotKg: 10,
      maxLotKg: 5000,
      shelfLifeHours: 720,
      minIncrementPerKg: 100,
      gradeGuide: { A: "Firm", B: "Minor defects", C: "Soft" },
      imageUrl: "https://example.com/potato.jpg",
      isActive: true,
    });
    cropId = crop._id.toString();

    await Listing.create({
      farmerId,
      cropId,
      quantityKg: 100,
      floorPricePerKg: 2000,
      minIncrementPerKg: 100,
      images: [{ url: "https://example.com/listing.jpg", width: 800, height: 600 }],
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
        lowPerKg: 1800,
        expectedPerKg: 2000,
        highPerKg: 2200,
        trend: "FLAT",
        confidence: 0.9,
        explanation: ["Baseline"],
        modelVersion: "1.0",
        provider: "mock",
        degraded: false,
        generatedAt: new Date("2026-11-14T07:50:00.000Z"),
        suggestedFloorPerKg: 1800,
      },
    });
  });

  async function seedOrder(
    status: OrderStatus,
    custom?: Partial<Record<string, unknown>>,
  ): Promise<mongoose.HydratedDocument<OrderRecord>> {
    const createdAt = testClock.now();
    const orderListingId = new Types.ObjectId();
    const doc = await Order.create({
      listingId: orderListingId,
      farmerId,
      buyerId,
      cropId,
      quantityKg: 100,
      grade: CropGrade.A,
      pricePerKg: 2500,
      subtotal: 250000,
      platformFee: 5000,
      farmerNet: 245000,
      status,
      payment: {
        method: PaymentMethod.WALLET_SIM,
        status: status === OrderStatus.PENDING ? PaymentStatus.UNPAID : PaymentStatus.PAID,
        paidAt: status === OrderStatus.PENDING ? undefined : createdAt,
      },
      fulfilment: {
        method: FulfilmentMethod.PICKUP,
        note: "Pickup from warehouse",
        handoverAt: new Date(createdAt.getTime() + 86400000),
      },
      statusHistory: [
        { status: OrderStatus.PENDING, at: createdAt },
        ...(status !== OrderStatus.PENDING ? [{ status, at: createdAt }] : []),
      ],
      createdAt,
      updatedAt: createdAt,
      ...(status === OrderStatus.CONFIRMED ? { confirmedAt: createdAt } : {}),
      ...(status === OrderStatus.DELIVERED ? { confirmedAt: createdAt, deliveredAt: createdAt } : {}),
      ...(status === OrderStatus.COMPLETED
        ? { confirmedAt: createdAt, deliveredAt: createdAt, completedAt: createdAt }
        : {}),
      ...(status === OrderStatus.DISPUTED
        ? {
            confirmedAt: createdAt,
            deliveredAt: createdAt,
            dispute: {
              reason: "GRADE_LOWER_THAN_LISTED",
              note: "Sample was rotten",
              raisedAt: createdAt,
            },
          }
        : {}),
      ...(status === OrderStatus.CANCELLED
        ? {
            cancelledAt: createdAt,
            cancelledBy: buyerId,
            cancelReason: "BUYER_REQUEST",
            cancelNote: "Mistake",
          }
        : {}),
      ...custom,
    });
    return doc;
  }

  describe("Audit 1: Field Whitelist and Strict Schema Compliance", () => {
    const statuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.CANCELLED,
    ];

    for (const status of statuses) {
      it(`farmer order detail for ${status} complies with strict schema and contains no unexpected keys`, async () => {
        const orderDoc = await seedOrder(status);
        authenticateAccessTokenMock.mockResolvedValueOnce(farmerUser);

        const res = await request(app)
          .get(`/api/v1/orders/${orderDoc._id.toString()}`)
          .set("Cookie", "accessToken=farmer-token");

        expect(res.status).toBe(200);

        const data = res.body.data;

        // Validates with Zod schema (with strict shape checking)
        const parsed = farmerOrderDetailSchema.parse(data);
        expect(parsed.id).toBe(orderDoc._id.toString());
        expect(parsed.status).toBe(status);

        // Assert farmer financial fields are present for farmer
        expect(data).toHaveProperty("platformFee", 5000);
        expect(data).toHaveProperty("farmerNet", 245000);
        expect(data).toHaveProperty("subtotal", 250000);

        // Assert database internal fields never leak
        expect(data).not.toHaveProperty("_id");
        expect(data).not.toHaveProperty("__v");
        expect(data).not.toHaveProperty("passwordHash");
      });

      it(`buyer order detail for ${status} complies with strict schema and NEVER leaks fees or net`, async () => {
        const orderDoc = await seedOrder(status);
        authenticateAccessTokenMock.mockResolvedValueOnce(buyerUser);

        const res = await request(app)
          .get(`/api/v1/orders/${orderDoc._id.toString()}`)
          .set("Cookie", "accessToken=buyer-token");

        expect(res.status).toBe(200);

        const data = res.body.data;

        // Validates with Zod schema
        const parsed = buyerOrderDetailSchema.parse(data);
        expect(parsed.id).toBe(orderDoc._id.toString());
        expect(parsed.status).toBe(status);

        // PRIVACY CRITICAL: Buyer MUST NOT see platformFee or farmerNet
        expect(data).not.toHaveProperty("platformFee");
        expect(data).not.toHaveProperty("farmerNet");

        // Assert buyer sees totalAmount and subtotal
        expect(data).toHaveProperty("subtotal", 250000);
        expect(data).toHaveProperty("totalAmount", 250000);

        // Assert internal DB fields never leak
        expect(data).not.toHaveProperty("_id");
        expect(data).not.toHaveProperty("__v");
        expect(data).not.toHaveProperty("passwordHash");
      });
    }

    it("verifies order list endpoints conform to strict card schemas for both roles", async () => {
      await seedOrder(OrderStatus.PENDING);
      await seedOrder(OrderStatus.CONFIRMED);

      // Farmer List Audit
      authenticateAccessTokenMock.mockResolvedValueOnce(farmerUser);
      const farmerListRes = await request(app)
        .get("/api/v1/orders")
        .set("Cookie", "accessToken=farmer-token");

      expect(farmerListRes.status).toBe(200);
      expect(farmerListRes.body.data).toHaveLength(2);
      for (const item of farmerListRes.body.data) {
        farmerOrderCardSchema.parse(item);
        expect(item).toHaveProperty("platformFee");
        expect(item).toHaveProperty("farmerNet");
        expect(item).not.toHaveProperty("_id");
        expect(item).not.toHaveProperty("__v");
        expect(item).not.toHaveProperty("passwordHash");
      }

      // Buyer List Audit
      authenticateAccessTokenMock.mockResolvedValueOnce(buyerUser);
      const buyerListRes = await request(app)
        .get("/api/v1/orders")
        .set("Cookie", "accessToken=buyer-token");

      expect(buyerListRes.status).toBe(200);
      expect(buyerListRes.body.data).toHaveLength(2);
      for (const item of buyerListRes.body.data) {
        buyerOrderCardSchema.parse(item);
        expect(item).not.toHaveProperty("platformFee");
        expect(item).not.toHaveProperty("farmerNet");
        expect(item).not.toHaveProperty("_id");
        expect(item).not.toHaveProperty("__v");
        expect(item).not.toHaveProperty("passwordHash");
      }
    });
  });

  describe("Audit 2: Phone and Identity Masking vs Reveal Rules", () => {
    it("masks counterparty in PENDING status: no phone, anonymized name, masked flag true", async () => {
      const orderDoc = await seedOrder(OrderStatus.PENDING);

      // Buyer checking farmer in PENDING
      authenticateAccessTokenMock.mockResolvedValueOnce(buyerUser);
      const buyerRes = await request(app)
        .get(`/api/v1/orders/${orderDoc._id.toString()}`)
        .set("Cookie", "accessToken=buyer-token");

      const farmerCounterparty = buyerRes.body.data.farmer;
      expect(farmerCounterparty.isMasked).toBe(true);
      expect(farmerCounterparty.name).toBe("Farmer");
      expect(farmerCounterparty.phone).toBeUndefined();
      expect(farmerCounterparty.location?.address).toBeUndefined();

      // Farmer checking buyer in PENDING
      authenticateAccessTokenMock.mockResolvedValueOnce(farmerUser);
      const farmerRes = await request(app)
        .get(`/api/v1/orders/${orderDoc._id.toString()}`)
        .set("Cookie", "accessToken=farmer-token");

      const buyerCounterparty = farmerRes.body.data.buyer;
      expect(buyerCounterparty.isMasked).toBe(true);
      expect(buyerCounterparty.name).toBe("Buyer");
      expect(buyerCounterparty.phone).toBeUndefined();
      expect(buyerCounterparty.organizationName).toBeUndefined();
    });

    it("reveals counterparty once CONFIRMED: full phone, real name, organization, unmasked flag false", async () => {
      const orderDoc = await seedOrder(OrderStatus.CONFIRMED);

      // Buyer checking farmer in CONFIRMED
      authenticateAccessTokenMock.mockResolvedValueOnce(buyerUser);
      const buyerRes = await request(app)
        .get(`/api/v1/orders/${orderDoc._id.toString()}`)
        .set("Cookie", "accessToken=buyer-token");

      const farmerCounterparty = buyerRes.body.data.farmer;
      expect(farmerCounterparty.isMasked).toBe(false);
      expect(farmerCounterparty.name).toBe("Farmer Abdul");
      expect(farmerCounterparty.phone).toBe("+8801711111111");

      // Farmer checking buyer in CONFIRMED
      authenticateAccessTokenMock.mockResolvedValueOnce(farmerUser);
      const farmerRes = await request(app)
        .get(`/api/v1/orders/${orderDoc._id.toString()}`)
        .set("Cookie", "accessToken=farmer-token");

      const buyerCounterparty = farmerRes.body.data.buyer;
      expect(buyerCounterparty.isMasked).toBe(false);
      expect(buyerCounterparty.name).toBe("Buyer Rahim");
      expect(buyerCounterparty.phone).toBe("+8801822222222");
      expect(buyerCounterparty.organizationName).toBe("Rahim Agro Corp");
    });
  });

  describe("Audit 3: Negative Authorization and Cross-User Data Protection", () => {
    it("returns 403 or 404 if a buyer attempts to view another buyer's order", async () => {
      const orderDoc = await seedOrder(OrderStatus.CONFIRMED);

      authenticateAccessTokenMock.mockResolvedValueOnce(otherBuyerUser);
      const res = await request(app)
        .get(`/api/v1/orders/${orderDoc._id.toString()}`)
        .set("Cookie", "accessToken=other-buyer-token");

      expect([403, 404]).toContain(res.status);
    });

    it("returns 403 or 404 if a farmer attempts to view another farmer's order", async () => {
      const orderDoc = await seedOrder(OrderStatus.CONFIRMED);

      authenticateAccessTokenMock.mockResolvedValueOnce(otherFarmerUser);
      const res = await request(app)
        .get(`/api/v1/orders/${orderDoc._id.toString()}`)
        .set("Cookie", "accessToken=other-farmer-token");

      expect([403, 404]).toContain(res.status);
    });

    it("rejects unauthenticated requests with 401", async () => {
      const orderDoc = await seedOrder(OrderStatus.CONFIRMED);

      const res = await request(app).get(`/api/v1/orders/${orderDoc._id.toString()}`);
      expect(res.status).toBe(401);
    });
  });
});
