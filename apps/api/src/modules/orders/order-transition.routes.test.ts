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
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { addStock, markStockSold, reserveStockForListing } from "../inventory/inventory.service.js";
import { Order, type OrderRecord } from "./order.model.js";

const farmerId = new Types.ObjectId().toString();
const otherFarmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const otherBuyerId = new Types.ObjectId().toString();
const cropId = new Types.ObjectId().toString();

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
  await Promise.all([Order.init(), InventoryItem.init(), StockMovement.init()]);

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
  ]);
  testClock = new TestClock(new Date("2026-11-16T10:00:00.000Z"));
  setClock(testClock);
  eventEmitter = new DomainEventEmitter();
  setDomainEventEmitter(eventEmitter);
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

async function seedTestOrder(
  status: OrderStatus = OrderStatus.PENDING,
): Promise<mongoose.HydratedDocument<OrderRecord>> {
  const listingId = new Types.ObjectId().toString();
  return Order.create({
    listingId,
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
        note: "Created",
      },
    ],
  });
}

describe("Order HTTP Routes (/api/v1/orders)", () => {
  describe("Authentication & Authorization Guards", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const order = await seedTestOrder();
      const res = await request(app).get(`/api/v1/orders/${order._id}`);
      expect(res.status).toBe(401);
    });

    it("requires X-CSRF-Protection: 1 on state-changing POST requests", async () => {
      const order = await seedTestOrder();
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/confirm`)
        .set("Cookie", withAuthCookie("farmer"))
        .send({ handoverAt: "2026-11-17T12:00:00.000Z" });
      expect(res.status).toBe(403);
    });

    it("enforces role guards on role-specific actions", async () => {
      const order = await seedTestOrder();

      // Buyer cannot confirm (farmer only)
      const buyerConfirm = await request(app)
        .post(`/api/v1/orders/${order._id}/confirm`)
        .set("Cookie", withAuthCookie("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ handoverAt: "2026-11-17T12:00:00.000Z" });
      expect(buyerConfirm.status).toBe(403);

      // Farmer cannot mark paid (buyer only)
      const farmerPay = await request(app)
        .post(`/api/v1/orders/${order._id}/mark-paid`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({});
      expect(farmerPay.status).toBe(403);

      // Buyer cannot mark delivered (farmer only)
      const buyerDeliver = await request(app)
        .post(`/api/v1/orders/${order._id}/mark-delivered`)
        .set("Cookie", withAuthCookie("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({});
      expect(buyerDeliver.status).toBe(403);

      // Farmer cannot complete (buyer only)
      const farmerComplete = await request(app)
        .post(`/api/v1/orders/${order._id}/complete`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({});
      expect(farmerComplete.status).toBe(403);

      // Buyer cannot decide stock return (farmer only)
      const buyerReturn = await request(app)
        .post(`/api/v1/orders/${order._id}/stock-return`)
        .set("Cookie", withAuthCookie("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ decision: StockReturnDecision.RETURNED });
      expect(buyerReturn.status).toBe(403);
    });

    it("enforces ownership: non-participant gets 404 on viewing and 403 on cancelling", async () => {
      const order = await seedTestOrder();

      // Other farmer cannot view (404 NOT_FOUND to prevent leaking order existence per gap 7)
      const viewRes = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Cookie", withAuthCookie("otherFarmer"));
      expect(viewRes.status).toBe(404);
      expect(viewRes.body.error?.code).toBe("ORDER_NOT_FOUND");

      // Other buyer cannot cancel (403 FORBIDDEN)
      const cancelRes = await request(app)
        .post(`/api/v1/orders/${order._id}/cancel`)
        .set("Cookie", withAuthCookie("otherBuyer"))
        .set("X-CSRF-Protection", "1")
        .send({ reason: "BUYER_CHANGE_OF_MIND" });
      expect(cancelRes.status).toBe(403);
    });
  });

  describe("End-to-End Lifecycle via HTTP", () => {
    it("completes full order lifecycle: confirm -> mark-paid -> mark-delivered -> complete", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);

      // 1. Farmer confirms order
      const confirmRes = await request(app)
        .post(`/api/v1/orders/${order._id}/confirm`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({
          handoverAt: "2026-11-17T12:00:00.000Z",
          note: "Bring vehicle for loading",
          fulfilmentMethod: FulfilmentMethod.PICKUP,
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe(OrderStatus.CONFIRMED);
      expect(confirmRes.body.data.confirmedAt).toBe(testClock.iso());
      expect(confirmRes.body.data.fulfilment.note).toBe("Bring vehicle for loading");

      // 2. Buyer pays via simulated wallet
      const payRes = await request(app)
        .post(`/api/v1/orders/${order._id}/mark-paid`)
        .set("Cookie", withAuthCookie("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({});

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.status).toBe(PaymentStatus.PAID);
      expect(payRes.body.data.payment.method).toBe(PaymentMethod.WALLET_SIM);

      // 3. Farmer marks delivered
      const deliverRes = await request(app)
        .post(`/api/v1/orders/${order._id}/mark-delivered`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({ note: "Handed over safely" });

      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.data.status).toBe(OrderStatus.DELIVERED);
      expect(deliverRes.body.data.deliveredAt).toBe(testClock.iso());

      // 4. Buyer completes order
      const completeRes = await request(app)
        .post(`/api/v1/orders/${order._id}/complete`)
        .set("Cookie", withAuthCookie("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ note: "Confirmed quality A" });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe(OrderStatus.COMPLETED);
      expect(completeRes.body.data.completedAt).toBe(testClock.iso());

      // 5. Get order detail
      const detailRes = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set("Cookie", withAuthCookie("farmer"));

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.status).toBe(OrderStatus.COMPLETED);
      expect(detailRes.body.data.payment.status).toBe(PaymentStatus.PAID);
      expect(detailRes.body.data.statusHistory.length).toBeGreaterThanOrEqual(4);
    });

    it("handles cancellation and stock return: cancel -> stock-return (RETURNED)", async () => {
      // Setup inventory
      const listingId = new Types.ObjectId().toString();
      await addStock({ farmerId, cropId, quantityKg: 50, operationId: "http-setup-add" });
      await reserveStockForListing({ farmerId, cropId, quantityKg: 50, listingId, operationId: "http-setup-list" });

      const order = await Order.create({
        listingId,
        farmerId,
        buyerId,
        cropId,
        quantityKg: 50,
        grade: CropGrade.A,
        pricePerKg: 4000,
        subtotal: 200000,
        platformFee: 4000,
        farmerNet: 196000,
        status: OrderStatus.CONFIRMED,
        payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
        fulfilment: { method: FulfilmentMethod.PICKUP },
      });

      await markStockSold({
        farmerId,
        cropId,
        quantityKg: 50,
        orderId: order._id.toString(),
        operationId: "http-setup-sell",
      });

      // 1. Cancel order (triggers wallet refund simulation)
      const cancelRes = await request(app)
        .post(`/api/v1/orders/${order._id}/cancel`)
        .set("Cookie", withAuthCookie("buyer"))
        .set("X-CSRF-Protection", "1")
        .send({ reason: "BUYER_CANNOT_COLLECT", note: "Road blocked" });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe(OrderStatus.CANCELLED);
      expect(cancelRes.body.data.payment.status).toBe(PaymentStatus.REFUNDED);
      expect(cancelRes.body.data.payment.refundedAt).toBe(testClock.iso());

      // 2. Farmer decides stock return -> RETURNED
      const returnRes = await request(app)
        .post(`/api/v1/orders/${order._id}/stock-return`)
        .set("Cookie", withAuthCookie("farmer"))
        .set("X-CSRF-Protection", "1")
        .send({ decision: StockReturnDecision.RETURNED, note: "Back in store" });

      expect(returnRes.status).toBe(200);
      expect(returnRes.body.data.stockReturn.decision).toBe(StockReturnDecision.RETURNED);

      // Verify stock was restored to available in DB
      const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
      expect(inventory).toMatchObject({ availableKg: 50, listedKg: 0, soldKg: 0 });
    });
  });
});
