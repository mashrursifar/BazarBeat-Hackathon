import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CropGrade,
  FulfilmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import { AppError } from "../../shared/errors.js";
import { OrderTransitionService } from "./order-transition.service.js";
import { completeDueDeliveredOrders } from "./order-timer.service.js";
import { Order } from "./order.model.js";

/**
 * Task 6.12 (P0) — Review: Races.
 *
 * AUCTION_RULES §11, SECURITY §5 and §11, TESTING §4.
 * Concurrency race tests executed repeatedly (at least 10 iterations each):
 * 1. Confirm versus Cancel
 * 2. Mark-Paid versus Cancel
 * 3. Complete versus Auto-Complete
 */
describe("Task 6.12 — Review: Races (P0)", () => {
  let replSet: MongoMemoryReplSet;
  let testClock: TestClock;
  let service: OrderTransitionService;

  const farmerId = new Types.ObjectId().toString();
  const buyerId = new Types.ObjectId().toString();

  const farmerActor = { userId: farmerId, role: UserRole.FARMER };
  const buyerActor = { userId: buyerId, role: UserRole.BUYER };

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    service = new OrderTransitionService();
  });

  afterAll(async () => {
    resetClock();
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    testClock = new TestClock(new Date("2026-11-16T12:00:00.000Z"));
    setClock(testClock);
    await Order.deleteMany({});
  });

  async function createOrder(
    overrides: Partial<Record<string, unknown>> = {},
  ): Promise<string> {
    const listingId = new Types.ObjectId();
    const cropId = new Types.ObjectId();
    const createdAt = testClock.now();

    const doc = await Order.create({
      listingId,
      farmerId,
      buyerId,
      cropId,
      quantityKg: 50,
      grade: CropGrade.A,
      pricePerKg: 3000,
      subtotal: 150000,
      platformFee: 3000,
      farmerNet: 147000,
      status: OrderStatus.PENDING,
      payment: {
        method: PaymentMethod.COD,
        status: PaymentStatus.UNPAID,
      },
      statusHistory: [
        {
          status: OrderStatus.PENDING,
          at: createdAt,
        },
      ],
      ...overrides,
    });

    return doc._id.toString();
  }

  describe("Race 1: Confirm versus Cancel (run 10+ times)", () => {
    const ITERATIONS = 12;

    for (let i = 1; i <= ITERATIONS; i++) {
      it(`iteration ${i}/${ITERATIONS}: exactly one transition wins, leaving consistent DB state`, async () => {
        const orderId = await createOrder({ status: OrderStatus.PENDING });

        const confirmPromise = service.confirm(orderId, farmerActor, {
          handoverAt: new Date(testClock.now().getTime() + 86400000).toISOString(),
          fulfilmentMethod: FulfilmentMethod.PICKUP,
          note: `Confirm race ${i}`,
        });

        const cancelPromise = service.cancel(orderId, buyerActor, {
          reason: "BUYER_REQUEST",
          note: `Cancel race ${i}`,
          expectedStatus: OrderStatus.PENDING,
        });

        const results = await Promise.allSettled([confirmPromise, cancelPromise]);
        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        // Exactly one must succeed and exactly one must fail
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const failure = rejected[0] as PromiseRejectedResult;
        expect(failure.reason).toBeInstanceOf(AppError);
        expect((failure.reason as AppError).statusCode).toBe(409);

        // Verify database document
        const dbOrder = await Order.findById(orderId).lean();
        expect(dbOrder).not.toBeNull();
        expect([OrderStatus.CONFIRMED, OrderStatus.CANCELLED]).toContain(dbOrder!.status);

        // Verify statusHistory integrity
        expect(dbOrder!.statusHistory).toHaveLength(2);
        expect(dbOrder!.statusHistory[0].status).toBe(OrderStatus.PENDING);
        expect(dbOrder!.statusHistory[1].status).toBe(dbOrder!.status);
      });
    }
  });

  describe("Race 2: Mark-Paid versus Cancel (run 10+ times)", () => {
    const ITERATIONS = 12;

    for (let i = 1; i <= ITERATIONS; i++) {
      it(`iteration ${i}/${ITERATIONS}: exactly one wins, preventing unpaid/cancelled inconsistencies`, async () => {
        const orderId = await createOrder({
          status: OrderStatus.CONFIRMED,
          confirmedAt: testClock.now(),
          payment: {
            method: PaymentMethod.WALLET_SIM,
            status: PaymentStatus.UNPAID,
          },
          statusHistory: [
            { status: OrderStatus.PENDING, at: testClock.now() },
            { status: OrderStatus.CONFIRMED, at: testClock.now() },
          ],
        });

        const markPaidPromise = service.markPaid(orderId, buyerActor, {
          method: PaymentMethod.WALLET_SIM,
        });

        const cancelPromise = service.cancel(orderId, farmerActor, {
          reason: "FARMER_UNAVAILABLE",
          note: `Farmer cancel race ${i}`,
        });

        const results = await Promise.allSettled([markPaidPromise, cancelPromise]);
        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const failure = rejected[0] as PromiseRejectedResult;
        expect(failure.reason).toBeInstanceOf(AppError);
        expect((failure.reason as AppError).statusCode).toBe(409);

        const dbOrder = await Order.findById(orderId).lean();
        expect(dbOrder).not.toBeNull();

        if (dbOrder!.status === OrderStatus.CONFIRMED) {
          // Mark-paid won
          expect(dbOrder!.payment.status).toBe(PaymentStatus.PAID);
        } else {
          // Cancel won
          expect(dbOrder!.status).toBe(OrderStatus.CANCELLED);
          expect(dbOrder!.payment.status).not.toBe(PaymentStatus.PAID);
        }
      });
    }
  });

  describe("Race 3: Complete versus Auto-Complete (run 10+ times)", () => {
    const ITERATIONS = 12;

    for (let i = 1; i <= ITERATIONS; i++) {
      it(`iteration ${i}/${ITERATIONS}: exactly one complete transition occurs without duplicating statusHistory`, async () => {
        // Delivered 25 hours ago (eligible for 24h auto-complete)
        const deliveredAt = new Date(testClock.now().getTime() - 25 * 3600 * 1000);

        const orderId = await createOrder({
          status: OrderStatus.DELIVERED,
          deliveredAt,
          statusHistory: [
            { status: OrderStatus.PENDING, at: deliveredAt },
            { status: OrderStatus.CONFIRMED, at: deliveredAt },
            { status: OrderStatus.DELIVERED, at: deliveredAt },
          ],
        });

        // Concurrent execution: buyer explicit complete vs system timer auto-complete
        const buyerCompletePromise = service.complete(orderId, buyerActor, {
          note: `Buyer satisfied race ${i}`,
        });

        const systemTimerPromise = completeDueDeliveredOrders({
          clock: testClock,
          isDemoMode: false,
        });

        const results = await Promise.allSettled([buyerCompletePromise, systemTimerPromise]);

        // Buyer complete either fulfilled or rejected with 409
        if (results[0].status === "rejected") {
          expect(results[0].reason).toBeInstanceOf(AppError);
          expect((results[0].reason as AppError).statusCode).toBe(409);
        }

        // Verify final order state in DB
        const dbOrder = await Order.findById(orderId).lean();
        expect(dbOrder).not.toBeNull();
        expect(dbOrder!.status).toBe(OrderStatus.COMPLETED);
        expect(dbOrder!.completedAt).toBeDefined();

        // Exactly one COMPLETED entry in statusHistory
        const completedEntries = dbOrder!.statusHistory.filter(
          (h: { status: OrderStatus }) => h.status === OrderStatus.COMPLETED,
        );
        expect(completedEntries).toHaveLength(1);
      });
    }
  });
});
