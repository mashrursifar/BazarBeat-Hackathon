import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  FulfilmentMethod,
  ORDER_TIMING,
  OrderDisputeReason,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { runStartupCatchUp } from "../auctions/scheduler.service.js";
import { getOrderTransitionService } from "./order-transition.service.js";
import {
  cancelDuePendingOrders,
  completeDueDeliveredOrders,
  runOrderTimerJobs,
} from "./order-timer.service.js";
import { Order, type OrderRecord } from "./order.model.js";

const farmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const cropId = new Types.ObjectId().toString();

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplSet.getUri());
  await Order.init();
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet !== undefined) await mongoReplSet.stop();
});

beforeEach(async () => {
  await Order.deleteMany({});
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
        note: `Order initialized in ${status}`,
      },
    ],
    createdAt: testClock.now(),
    ...overrides,
  });
}

describe("Task 6.5 — Order Timers in the Scheduler (P0)", () => {
  describe("Job 1: Auto-Cancel PENDING orders past confirmation deadline", () => {
    it("auto-cancels PENDING orders past 12h deadline in standard mode", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);
      const emittedEvents: unknown[] = [];
      eventEmitter.on("order.cancelled", (payload) => {
        emittedEvents.push(payload);
      });

      // Advance clock past 12 hours (12h + 1ms)
      testClock.advanceBy(ORDER_TIMING.AUTO_CANCEL_MS + 1000);

      const summary = await cancelDuePendingOrders({ clock: testClock, isDemoMode: false });
      expect(summary.found).toBe(1);
      expect(summary.processed).toBe(1);
      expect(summary.failed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.CANCELLED);
      expect(updated?.cancelReason).toBe("NOT_CONFIRMED_IN_TIME");
      expect(updated?.cancelledAt).toBeDefined();

      // Verify domain event emitted with SYSTEM actor
      expect(emittedEvents).toHaveLength(1);
      expect((emittedEvents[0] as { cancelledBy: string }).cancelledBy).toBe("SYSTEM");
    });

    it("auto-cancels PENDING orders using scaled values in demo mode (1m)", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);

      // Advance clock past demo window (60s + 1s)
      testClock.advanceBy(ORDER_TIMING.DEMO_AUTO_CANCEL_MS + 1000);

      const summary = await cancelDuePendingOrders({ clock: testClock, isDemoMode: true });
      expect(summary.found).toBe(1);
      expect(summary.processed).toBe(1);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.CANCELLED);
    });

    it("leaves a not-yet-due PENDING order untouched", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);

      // Advance clock by only 6 hours (< 12 hours)
      testClock.advanceBy(6 * 60 * 60 * 1000);

      const summary = await cancelDuePendingOrders({ clock: testClock, isDemoMode: false });
      expect(summary.found).toBe(0);
      expect(summary.processed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.PENDING);
    });
  });

  describe("Job 2: Auto-Complete DELIVERED orders past 24h with no dispute", () => {
    it("auto-completes DELIVERED orders past 24h deadline in standard mode", async () => {
      const order = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });
      const emittedEvents: unknown[] = [];
      eventEmitter.on("order.completed", (payload) => {
        emittedEvents.push(payload);
      });

      // Advance clock past 24 hours
      testClock.advanceBy(ORDER_TIMING.AUTO_COMPLETE_MS + 1000);

      const summary = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: false });
      expect(summary.found).toBe(1);
      expect(summary.processed).toBe(1);
      expect(summary.failed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.COMPLETED);
      expect(updated?.completedAt).toBeDefined();

      expect(emittedEvents).toHaveLength(1);
    });

    it("auto-completes DELIVERED orders using scaled values in demo mode (2m)", async () => {
      const order = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });

      // Advance clock past 2 minutes demo window
      testClock.advanceBy(ORDER_TIMING.DEMO_AUTO_COMPLETE_MS + 1000);

      const summary = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: true });
      expect(summary.found).toBe(1);
      expect(summary.processed).toBe(1);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.COMPLETED);
    });

    it("leaves a not-yet-due DELIVERED order untouched", async () => {
      const order = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });

      // Advance clock by only 12 hours (< 24 hours)
      testClock.advanceBy(12 * 60 * 60 * 1000);

      const summary = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: false });
      expect(summary.found).toBe(0);
      expect(summary.processed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.DELIVERED);
    });

    it("does NOT auto-complete a DELIVERED order that has an active dispute", async () => {
      const order = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
        dispute: {
          reason: OrderDisputeReason.GRADE_MISMATCH,
          note: "Apples were damaged and Grade C instead of Grade A",
          raisedAt: testClock.now(),
        },
      });

      // Advance clock past 24 hours
      testClock.advanceBy(ORDER_TIMING.AUTO_COMPLETE_MS + 1000);

      const summary = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: false });
      expect(summary.found).toBe(0);
      expect(summary.processed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.DELIVERED);
      expect(updated?.dispute?.reason).toBe(OrderDisputeReason.GRADE_MISMATCH);
    });
  });

  describe("Idempotence & Double Runs", () => {
    it("running auto-cancel twice causes exactly one transition", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);
      testClock.advanceBy(ORDER_TIMING.AUTO_CANCEL_MS + 1000);

      const run1 = await cancelDuePendingOrders({ clock: testClock, isDemoMode: false });
      expect(run1.found).toBe(1);
      expect(run1.processed).toBe(1);

      const run2 = await cancelDuePendingOrders({ clock: testClock, isDemoMode: false });
      expect(run2.found).toBe(0);
      expect(run2.processed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.CANCELLED);
      // Status history should have exactly 1 cancellation entry
      const cancelEntries = updated?.statusHistory.filter(
        (e) => e.status === OrderStatus.CANCELLED,
      );
      expect(cancelEntries).toHaveLength(1);
    });

    it("running auto-complete twice causes exactly one transition", async () => {
      const order = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });
      testClock.advanceBy(ORDER_TIMING.AUTO_COMPLETE_MS + 1000);

      const run1 = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: false });
      expect(run1.found).toBe(1);
      expect(run1.processed).toBe(1);

      const run2 = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: false });
      expect(run2.found).toBe(0);
      expect(run2.processed).toBe(0);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.COMPLETED);
      const completeEntries = updated?.statusHistory.filter(
        (e) => e.status === OrderStatus.COMPLETED,
      );
      expect(completeEntries).toHaveLength(1);
    });
  });

  describe("Concurrency & Manual Action Races", () => {
    it("race: manual farmer confirmation vs auto-cancel (first wins cleanly)", async () => {
      const order = await seedTestOrder(OrderStatus.PENDING);
      testClock.advanceBy(ORDER_TIMING.AUTO_CANCEL_MS + 1000);

      const transitionService = getOrderTransitionService();

      // Simulate a concurrent race: farmer confirm vs auto-cancel
      const [confirmResult, cancelSummary] = await Promise.allSettled([
        transitionService.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt: new Date(testClock.timestamp() + 3600000).toISOString() },
        ),
        cancelDuePendingOrders({ clock: testClock, isDemoMode: false }),
      ]);

      const updated = await Order.findById(order._id);

      // Either farmer won (CONFIRMED) or auto-cancel won (CANCELLED)
      expect([OrderStatus.CONFIRMED, OrderStatus.CANCELLED]).toContain(updated?.status);

      // If farmer won, status is CONFIRMED
      if (confirmResult.status === "fulfilled") {
        expect(updated?.status).toBe(OrderStatus.CONFIRMED);
      }
      // If auto-cancel won, status is CANCELLED
      if (cancelSummary.status === "fulfilled" && cancelSummary.value.processed === 1) {
        expect(updated?.status).toBe(OrderStatus.CANCELLED);
      }
    });

    it("race: manual buyer complete vs auto-complete (idempotent convergence)", async () => {
      const order = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });
      testClock.advanceBy(ORDER_TIMING.AUTO_COMPLETE_MS + 1000);

      const transitionService = getOrderTransitionService();

      // Concurrent race: buyer complete vs auto-complete
      await Promise.allSettled([
        transitionService.complete(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
          { note: "Buyer receipt confirmed" },
        ),
        completeDueDeliveredOrders({ clock: testClock, isDemoMode: false }),
      ]);

      const updated = await Order.findById(order._id);
      expect(updated?.status).toBe(OrderStatus.COMPLETED);

      // Status history should only have 1 COMPLETED entry
      const completeEntries = updated?.statusHistory.filter(
        (e) => e.status === OrderStatus.COMPLETED,
      );
      expect(completeEntries).toHaveLength(1);
    });
  });

  describe("Error Isolation Per Order", () => {
    it("isolates errors per order so one failing order does not block others", async () => {
      // Order 1 is PENDING and due
      const order1 = await seedTestOrder(OrderStatus.PENDING);

      // Order 2 is also PENDING and due
      const order2 = await seedTestOrder(OrderStatus.PENDING);

      testClock.advanceBy(ORDER_TIMING.AUTO_CANCEL_MS + 1000);

      // Mock transitionService.cancel to throw on order1 only
      const transitionService = getOrderTransitionService();
      const originalCancel = transitionService.cancel.bind(transitionService);
      const cancelSpy = vi
        .spyOn(transitionService, "cancel")
        .mockImplementation(async (id, actor, req) => {
          if (id === order1._id.toString()) {
            throw new Error("Simulated database failure on order 1");
          }
          return originalCancel(id, actor, req);
        });

      const summary = await cancelDuePendingOrders({ clock: testClock, isDemoMode: false });

      expect(summary.found).toBe(2);
      expect(summary.processed).toBe(1);
      expect(summary.failed).toBe(1);

      // Order 2 succeeded despite Order 1 failing!
      const updated2 = await Order.findById(order2._id);
      expect(updated2?.status).toBe(OrderStatus.CANCELLED);

      cancelSpy.mockRestore();
    });
  });

  describe("Scheduler Lifecycle & Startup Catch-Up", () => {
    it("runs order timers during scheduler tick and startup catch-up", async () => {
      // Seed an expired PENDING order and an expired DELIVERED order
      const pendingOrder = await seedTestOrder(OrderStatus.PENDING);
      const deliveredOrder = await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });

      // Advance clock past 24 hours
      testClock.advanceBy(ORDER_TIMING.AUTO_COMPLETE_MS + 1000);

      // Run startup catch-up pass
      await runStartupCatchUp({ clock: testClock });

      const updatedPending = await Order.findById(pendingOrder._id);
      const updatedDelivered = await Order.findById(deliveredOrder._id);

      expect(updatedPending?.status).toBe(OrderStatus.CANCELLED);
      expect(updatedDelivered?.status).toBe(OrderStatus.COMPLETED);
    });

    it("runOrderTimerJobs executes both jobs and aggregates summaries", async () => {
      await seedTestOrder(OrderStatus.PENDING);
      await seedTestOrder(OrderStatus.DELIVERED, {
        confirmedAt: testClock.now(),
        deliveredAt: testClock.now(),
      });

      testClock.advanceBy(ORDER_TIMING.AUTO_COMPLETE_MS + 1000);

      const { autoCancel, autoComplete } = await runOrderTimerJobs({ clock: testClock });
      expect(autoCancel.processed).toBe(1);
      expect(autoComplete.processed).toBe(1);
    });
  });
});
