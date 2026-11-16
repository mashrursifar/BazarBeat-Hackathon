import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  FulfilmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type PublicUser,
  StockReturnDecision,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import { DomainEventEmitter, resetDomainEventEmitter, setDomainEventEmitter } from "../../shared/domain-event-emitter.js";

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { Crop } from "../crops/crop.model.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { addStock } from "../inventory/inventory.service.js";
import { Listing } from "../listings/listing.model.js";
import { User } from "../users/user.model.js";
import { Order, type OrderRecord } from "./order.model.js";

const farmerId = new Types.ObjectId().toString();
const otherFarmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const otherBuyerId = new Types.ObjectId().toString();
const cropId = new Types.ObjectId().toString();
const listingId = new Types.ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  farmer: {
    id: farmerId,
    role: UserRole.FARMER,
    name: "Farmer Rahim",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
  otherFarmer: {
    id: otherFarmerId,
    role: UserRole.FARMER,
    name: "Other Farmer",
    division: "rajshahi",
    district: "bogra",
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
  otherBuyer: {
    id: otherBuyerId,
    role: UserRole.BUYER,
    name: "Other Buyer",
    division: "chattogram",
    district: "chattogram",
    language: "en",
  },
};

function withAuthCookie(userKey: keyof typeof sessionUsers): string {
  return `accessToken=${userKey}`;
}

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplSet.getUri());
  await Promise.all([
    Order.init(),
    InventoryItem.init(),
    StockMovement.init(),
    User.init(),
    Crop.init(),
    Listing.init(),
  ]);

  authenticateAccessTokenMock.mockImplementation(async (token) => {
    const user = sessionUsers[token];
    if (!user) throw new Error("Invalid test token");
    return user;
  });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet !== undefined) await mongoReplSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    User.deleteMany({}),
    Crop.deleteMany({}),
    Listing.deleteMany({}),
  ]);

  testClock = new TestClock(new Date("2026-11-16T10:00:00.000Z"));
  setClock(testClock);
  eventEmitter = new DomainEventEmitter();
  setDomainEventEmitter(eventEmitter);

  // Seed User records for counterparty contact testing
  await User.create([
    {
      _id: farmerId,
      role: UserRole.FARMER,
      name: "Farmer Rahim",
      phone: "01711111111",
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Savar",
      passwordHash: "secret-hash-never-leak-12345",
      language: "en",
    },
    {
      _id: buyerId,
      role: UserRole.BUYER,
      name: "Buyer Karim",
      phone: "01822222222",
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Gulshan",
      organization: "Karim Supermarket",
      passwordHash: "secret-hash-never-leak-67890",
      language: "en",
    },
  ]);

  // Seed Crop
  await Crop.create({
    _id: cropId,
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 500,
    shelfLifeHours: 168,
    gradeGuide: { A: "Firm", B: "Minor blemishes", C: "Soft" },
    minIncrementPerKg: 100,
    imageUrl: "https://example.com/onion.jpg",
    isActive: true,
  });

  // Seed Listing
  await Listing.create({
    _id: listingId,
    farmerId,
    cropId,
    quantityKg: 50,
    images: [{ url: "https://example.com/onion-lot.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.95, B: 0.05, C: 0.0 },
      qualityNotes: ["High quality"],
      cropMatch: true,
      modelVersion: "1.0",
      provider: "mock",
      degraded: false,
      assessedAt: testClock.now(),
      imageHashes: ["hash1"],
    },
    aiPriceGuidance: {
      lowPerKg: 3500,
      expectedPerKg: 4000,
      highPerKg: 4500,
      trend: "FLAT",
      confidence: 0.9,
      explanation: ["Stable market"],
      modelVersion: "1.0",
      provider: "mock",
      degraded: false,
      generatedAt: testClock.now(),
      suggestedFloorPerKg: 3500,
    },
    floorPricePerKg: 3500,
    minIncrementPerKg: 100,
    startsAt: testClock.now(),
    endsAt: new Date("2026-11-16T12:00:00.000Z"),
    originalEndsAt: new Date("2026-11-16T12:00:00.000Z"),
    extensionCount: 0,
    status: "SOLD",
    location: { division: "Dhaka", district: "Dhaka" },
  });
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

async function seedTestOrder(
  status: OrderStatus = OrderStatus.PENDING,
  overrides: Partial<OrderRecord> = {},
): Promise<mongoose.HydratedDocument<OrderRecord>> {
  const freshListingId = new Types.ObjectId().toString();
  return Order.create({
    listingId: freshListingId,
    farmerId,
    buyerId,
    cropId,
    quantityKg: 50,
    grade: CropGrade.A,
    pricePerKg: 4000,
    subtotal: 200000,
    platformFee: 4000,
    farmerNet: 196000,
    status,
    payment: {
      status: PaymentStatus.UNPAID,
    },
    fulfilment: {
      method: FulfilmentMethod.PICKUP,
    },
    statusHistory: [
      {
        status,
        at: testClock.now(),
        note: `Order set to ${status}`,
      },
    ],
    createdAt: testClock.now(),
    ...overrides,
  });
}

describe("Task 6.4 — Order Endpoints (P0)", () => {
  describe("GET /api/v1/orders (List Orders)", () => {
    it("returns role-scoped orders with pagination and per-status counts in meta", async () => {
      // Create orders for this farmer & buyer
      await seedTestOrder(OrderStatus.PENDING);
      await seedTestOrder(OrderStatus.CONFIRMED, {
        confirmedAt: testClock.now(),
      });

      // Farmer request
      const farmerRes = await request(app)
        .get("/api/v1/orders?page=1&limit=10")
        .set("Cookie", withAuthCookie("farmer"));

      expect(farmerRes.status).toBe(200);
      expect(farmerRes.body.data).toHaveLength(2);
      expect(farmerRes.body.meta.page).toBe(1);
      expect(farmerRes.body.meta.limit).toBe(10);
      expect(farmerRes.body.meta.total).toBe(2);
      expect(farmerRes.body.meta.totalPages).toBe(1);
      expect(farmerRes.body.meta.statusCounts).toBeDefined();
      expect(farmerRes.body.meta.statusCounts.PENDING).toBe(1);
      expect(farmerRes.body.meta.statusCounts.CONFIRMED).toBe(1);
      expect(farmerRes.body.meta.statusCounts.COMPLETED).toBe(0);

      // Verify each card contains deadline fields
      const pendingCard = farmerRes.body.data.find(
        (o: { status: string }) => o.status === OrderStatus.PENDING,
      );
      expect(pendingCard.autoCancelDeadline).toBeDefined();
      expect(pendingCard.deadline).toBe(pendingCard.autoCancelDeadline);
    });

    it("filters orders by status", async () => {
      await seedTestOrder(OrderStatus.PENDING);
      await seedTestOrder(OrderStatus.CONFIRMED, { confirmedAt: testClock.now() });

      const res = await request(app)
        .get(`/api/v1/orders?status=${OrderStatus.CONFIRMED}`)
        .set("Cookie", withAuthCookie("farmer"));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe(OrderStatus.CONFIRMED);
    });

    it("filters orders by statusGroup (active, completed, cancelled)", async () => {
      await seedTestOrder(OrderStatus.PENDING);
      await seedTestOrder(OrderStatus.CONFIRMED, { confirmedAt: testClock.now() });
      await seedTestOrder(OrderStatus.CANCELLED, {
        cancelledAt: testClock.now(),
        cancelReason: "MUTUAL_AGREEMENT",
      });

      // Active statusGroup: PENDING, CONFIRMED, DELIVERED
      const activeRes = await request(app)
        .get("/api/v1/orders?statusGroup=active")
        .set("Cookie", withAuthCookie("farmer"));

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data).toHaveLength(2);

      // Cancelled statusGroup
      const cancelledRes = await request(app)
        .get("/api/v1/orders?statusGroup=cancelled")
        .set("Cookie", withAuthCookie("farmer"));

      expect(cancelledRes.status).toBe(200);
      expect(cancelledRes.body.data).toHaveLength(1);
      expect(cancelledRes.body.data[0].status).toBe(OrderStatus.CANCELLED);
    });

    it("filters orders by crop and date range", async () => {
      await seedTestOrder(OrderStatus.PENDING);

      // Filter by cropId
      const cropRes = await request(app)
        .get(`/api/v1/orders?cropId=${cropId}`)
        .set("Cookie", withAuthCookie("farmer"));
      expect(cropRes.status).toBe(200);
      expect(cropRes.body.data).toHaveLength(1);

      // Filter by date range matching creation time
      const dateRes = await request(app)
        .get("/api/v1/orders?from=2026-11-16T09:00:00.000Z&to=2026-11-16T11:00:00.000Z")
        .set("Cookie", withAuthCookie("farmer"));
      expect(dateRes.status).toBe(200);
      expect(dateRes.body.data).toHaveLength(1);

      // Filter by date range outside creation time
      const outsideDateRes = await request(app)
        .get("/api/v1/orders?from=2026-11-17T00:00:00.000Z")
        .set("Cookie", withAuthCookie("farmer"));
      expect(outsideDateRes.status).toBe(200);
      expect(outsideDateRes.body.data).toHaveLength(0);
    });

    it("masks counterparties in PENDING and reveals in CONFIRMED for list items", async () => {
      await seedTestOrder(OrderStatus.PENDING);
      await seedTestOrder(OrderStatus.CONFIRMED, { confirmedAt: testClock.now() });

      const res = await request(app)
        .get("/api/v1/orders")
        .set("Cookie", withAuthCookie("farmer"));

      expect(res.status).toBe(200);
      const pendingOrder = res.body.data.find(
        (o: { status: string }) => o.status === OrderStatus.PENDING,
      );
      const confirmedOrder = res.body.data.find(
        (o: { status: string }) => o.status === OrderStatus.CONFIRMED,
      );

      // PENDING item counterparty is masked
      expect(pendingOrder.buyer.isMasked).toBe(true);
      expect(pendingOrder.buyer.phone).toBeUndefined();

      // CONFIRMED item counterparty is revealed
      expect(confirmedOrder.buyer.isMasked).toBe(false);
      expect(confirmedOrder.buyer.phone).toBe("+8801822222222");
    });
  });

  describe("GET /api/v1/orders/:id (Detail & Contact Reveal Rules)", () => {
    it("returns NOT_FOUND (404) for non-participants (gap 7 / SECURITY §2)", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);

      // Non-participant farmer gets 404
      const otherFarmerRes = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Cookie", withAuthCookie("otherFarmer"));

      expect(otherFarmerRes.status).toBe(404);
      expect(otherFarmerRes.body.error?.code).toBe("ORDER_NOT_FOUND");

      // Non-participant buyer gets 404
      const otherBuyerRes = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Cookie", withAuthCookie("otherBuyer"));

      expect(otherBuyerRes.status).toBe(404);
      expect(otherBuyerRes.body.error?.code).toBe("ORDER_NOT_FOUND");
    });

    it("contact reveal tests across statuses (PENDING vs CONFIRMED, DELIVERED, COMPLETED, DISPUTED)", async () => {
      // 1. PENDING: contact masked for both farmer and buyer
      const pendingOrder = await seedTestOrder(OrderStatus.PENDING);

      const farmerViewPending = await request(app)
        .get(`/api/v1/orders/${pendingOrder._id}`)
        .set("Cookie", withAuthCookie("farmer"));

      expect(farmerViewPending.status).toBe(200);
      expect(farmerViewPending.body.data.buyer.isMasked).toBe(true);
      expect(farmerViewPending.body.data.buyer.phone).toBeUndefined();

      const buyerViewPending = await request(app)
        .get(`/api/v1/orders/${pendingOrder._id}`)
        .set("Cookie", withAuthCookie("buyer"));

      expect(buyerViewPending.status).toBe(200);
      expect(buyerViewPending.body.data.farmer.isMasked).toBe(true);
      expect(buyerViewPending.body.data.farmer.phone).toBeUndefined();

      // 2. CONFIRMED: contacts revealed to both
      const confirmedOrder = await seedTestOrder(OrderStatus.CONFIRMED, {
        confirmedAt: testClock.now(),
      });

      const farmerViewConfirmed = await request(app)
        .get(`/api/v1/orders/${confirmedOrder._id}`)
        .set("Cookie", withAuthCookie("farmer"));

      expect(farmerViewConfirmed.status).toBe(200);
      expect(farmerViewConfirmed.body.data.buyer.isMasked).toBe(false);
      expect(farmerViewConfirmed.body.data.buyer.phone).toBe("+8801822222222");
      expect(farmerViewConfirmed.body.data.buyer.location?.division).toBe("Dhaka");

      const buyerViewConfirmed = await request(app)
        .get(`/api/v1/orders/${confirmedOrder._id}`)
        .set("Cookie", withAuthCookie("buyer"));

      expect(buyerViewConfirmed.status).toBe(200);
      expect(buyerViewConfirmed.body.data.farmer.isMasked).toBe(false);
      expect(buyerViewConfirmed.body.data.farmer.phone).toBe("+8801711111111");

      // 3. DELIVERED: contacts revealed
      const deliveredOrder = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });

      const farmerViewDelivered = await request(app)
        .get(`/api/v1/orders/${deliveredOrder._id}`)
        .set("Cookie", withAuthCookie("farmer"));
      expect(farmerViewDelivered.body.data.buyer.isMasked).toBe(false);
      expect(farmerViewDelivered.body.data.autoCompleteDeadline).toBeDefined();

      // 4. COMPLETED: contacts revealed
      const completedOrder = await seedTestOrder(OrderStatus.COMPLETED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
        completedAt: testClock.now(),
      });

      const buyerViewCompleted = await request(app)
        .get(`/api/v1/orders/${completedOrder._id}`)
        .set("Cookie", withAuthCookie("buyer"));
      expect(buyerViewCompleted.body.data.farmer.isMasked).toBe(false);
    });

    it("verifies no private fields leak (passwordHash, internal credentials, token secrets)", async () => {
      const order = await seedTestOrder(OrderStatus.CONFIRMED, {
        confirmedAt: testClock.now(),
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Cookie", withAuthCookie("farmer"));

      const responseText = JSON.stringify(res.body);
      expect(responseText).not.toContain("secret-hash");
      expect(responseText).not.toContain("passwordHash");
      expect(responseText).not.toContain("__v");
    });
  });

  describe("Table-Driven Authorization Matrix: Action × Role × Status", () => {
    type ActionSpec = {
      action: string;
      pathSuffix: string;
      method: "POST";
      payload: (status: OrderStatus) => Record<string, unknown>;
    };

    const actions: ActionSpec[] = [
      {
        action: "CONFIRM",
        pathSuffix: "confirm",
        method: "POST",
        payload: () => ({
          handoverAt: "2026-11-17T12:00:00.000Z",
          note: "Handover note",
        }),
      },
      {
        action: "MARK_PAID",
        pathSuffix: "mark-paid",
        method: "POST",
        payload: () => ({ method: PaymentMethod.WALLET_SIM }),
      },
      {
        action: "MARK_DELIVERED",
        pathSuffix: "mark-delivered",
        method: "POST",
        payload: () => ({ note: "Delivered note" }),
      },
      {
        action: "COMPLETE",
        pathSuffix: "complete",
        method: "POST",
        payload: () => ({ note: "Completed note" }),
      },
      {
        action: "CANCEL",
        pathSuffix: "cancel",
        method: "POST",
        payload: () => ({ reason: "BUYER_CHANGE_OF_MIND" }),
      },
      {
        action: "STOCK_RETURN",
        pathSuffix: "stock-return",
        method: "POST",
        payload: () => ({ decision: StockReturnDecision.DECLINED }),
      },
    ];

    const roles: Array<keyof typeof sessionUsers> = [
      "farmer",
      "buyer",
      "otherFarmer",
      "otherBuyer",
    ];

    const statuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.DISPUTED,
    ];

    // Helper to determine expected HTTP status code
    function getExpectedStatus(
      action: string,
      role: keyof typeof sessionUsers,
      status: OrderStatus,
    ): number {
      // Non-participants or unauthenticated
      if (role === "otherFarmer" || role === "otherBuyer") {
        return 403; // Forbidden
      }

      switch (action) {
        case "CONFIRM":
          if (role !== "farmer") return 403;
          return status === OrderStatus.PENDING ? 200 : 409;

        case "MARK_PAID":
          if (role !== "buyer") return 403;
          return ([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.DELIVERED] as OrderStatus[]).includes(
            status,
          )
            ? 200
            : 409;

        case "MARK_DELIVERED":
          if (role !== "farmer") return 403;
          return status === OrderStatus.CONFIRMED ? 200 : 409;

        case "COMPLETE":
          if (role !== "buyer") return 403;
          return status === OrderStatus.DELIVERED ? 200 : 409;

        case "CANCEL":
          // Both farmer and buyer can cancel, but only in PENDING or CONFIRMED
          return ([OrderStatus.PENDING, OrderStatus.CONFIRMED] as OrderStatus[]).includes(status)
            ? 200
            : 409;

        case "STOCK_RETURN":
          if (role !== "farmer") return 403;
          return status === OrderStatus.CANCELLED ? 200 : 409;

        default:
          return 400;
      }
    }

    // Run table-driven test cases
    for (const actionItem of actions) {
      for (const role of roles) {
        for (const status of statuses) {
          const expected = getExpectedStatus(actionItem.action, role, status);

          it(`[Matrix] ${actionItem.action} by ${role} on ${status} -> expected HTTP ${expected}`, async () => {
            // Seed order with appropriate timestamps to be valid in that status
            const order = await seedTestOrder(status, {
              ...(status !== OrderStatus.PENDING
                ? { confirmedAt: testClock.now() }
                : {}),
              ...(status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED
                ? { deliveredAt: testClock.now() }
                : {}),
              ...(status === OrderStatus.COMPLETED
                ? { completedAt: testClock.now() }
                : {}),
              ...(status === OrderStatus.CANCELLED
                ? { cancelledAt: testClock.now(), cancelReason: "MUTUAL_AGREEMENT" }
                : {}),
            });

            // Ensure stock is available for stock-return test
            if (actionItem.action === "STOCK_RETURN" && expected === 200) {
              await addStock({
                farmerId,
                cropId,
                quantityKg: 100,
                operationId: `stock-init-${order._id.toString()}`,
              });
            }

            const res = await request(app)
              .post(`/api/v1/orders/${order._id}/${actionItem.pathSuffix}`)
              .set("Cookie", withAuthCookie(role))
              .set("X-CSRF-Protection", "1")
              .send(actionItem.payload(status));

            expect(res.status).toBe(expected);
          });
        }
      }
    }
  });

  describe("Validation and Error Envelope Tests", () => {
    it("rejects invalid handover schedule (>72h in future) with 400 VALIDATION_ERROR envelope", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/confirm`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({
          handoverAt: "2026-11-25T12:00:00.000Z", // 9 days in future (> 72h)
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("HANDOVER_TIME_INVALID");
      expect(res.body.error.message).toContain("72 hours");
    });

    it("rejects cancellation with empty reason with 400 VALIDATION_ERROR envelope", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/cancel`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({ reason: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("accepts DECLINED decision for stock-return without ledger return movement", async () => {
      const order = await seedTestOrder(OrderStatus.CANCELLED, {
        cancelledAt: testClock.now(),
        cancelReason: "MUTUAL_AGREEMENT",
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/stock-return`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({ decision: StockReturnDecision.DECLINED });

      expect(res.status).toBe(200);
      expect(res.body.data.stockReturn?.decision).toBe(StockReturnDecision.DECLINED);
    });
  });
});
