import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CropGrade,
  DomainEventName,
  FulfilmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { cancelDuePendingOrders, completeDueDeliveredOrders } from "./order-timer.service.js";
import { OrderTransitionService } from "./order-transition.service.js";
import { Order } from "./order.model.js";

/**
 * Task 6.12 (P0) — Review: StatusHistory and Domain Events Audit.
 *
 * AUCTION_RULES §11, SECURITY §5 and §11, TESTING §4.
 * Asserts that EVERY status change in the order lifecycle produces:
 * 1. An appended entry in `statusHistory` with correct status, timestamp, actor, and note.
 * 2. A strongly-typed DomainEvent emitted through `DomainEventEmitter`.
 */
describe("Task 6.12 — Review: StatusHistory and Domain Events Audit (P0)", () => {
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
    getDomainEventEmitter().removeAllListeners();
    await Order.deleteMany({});
  });

  async function createInitialOrder(
    overrides: Partial<Record<string, unknown>> = {},
  ): Promise<string> {
    const listingId = new Types.ObjectId();
    const cropId = new Types.ObjectId();
    const now = testClock.now();

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
          at: now,
        },
      ],
      ...overrides,
    });

    return doc._id.toString();
  }

  it("1. Farmer confirms: produces statusHistory entry and emits order.confirmed", async () => {
    const orderId = await createInitialOrder();
    const emittedEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_CONFIRMED, (payload) => {
      emittedEvents.push(payload);
    });

    const handoverAt = new Date(testClock.now().getTime() + 86400000).toISOString();
    await service.confirm(orderId, farmerActor, {
      handoverAt,
      fulfilmentMethod: FulfilmentMethod.PICKUP,
      note: "Ready tomorrow 10am",
    });

    // Check DB statusHistory
    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.CONFIRMED);
    expect(dbOrder?.statusHistory).toHaveLength(2);

    const historyEntry = dbOrder?.statusHistory[1];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.CONFIRMED);
    expect(historyEntry.byUserId?.toString()).toBe(farmerId);
    expect(historyEntry.note).toBe("Ready tomorrow 10am");

    // Check emitted domain event
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]).toMatchObject({
      orderId,
      farmerId,
      buyerId,
      handoverAt,
      note: "Ready tomorrow 10am",
    });
  });

  it("2. Farmer marks delivered: produces statusHistory entry and emits order.delivered (+ payment.paid on COD)", async () => {
    const orderId = await createInitialOrder({
      status: OrderStatus.CONFIRMED,
      confirmedAt: testClock.now(),
      payment: {
        method: PaymentMethod.COD,
        status: PaymentStatus.UNPAID,
      },
      statusHistory: [
        { status: OrderStatus.PENDING, at: testClock.now() },
        { status: OrderStatus.CONFIRMED, at: testClock.now(), byUserId: farmerId },
      ],
    });

    const deliveredEvents: unknown[] = [];
    const paymentEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_DELIVERED, (payload) => {
      deliveredEvents.push(payload);
    });
    getDomainEventEmitter().on(DomainEventName.PAYMENT_PAID, (payload) => {
      paymentEvents.push(payload);
    });

    await service.markDelivered(orderId, farmerActor, {
      note: "Handed over to buyer directly",
    });

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.DELIVERED);
    expect(dbOrder?.statusHistory).toHaveLength(3);

    const historyEntry = dbOrder?.statusHistory[2];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.DELIVERED);
    expect(historyEntry.byUserId?.toString()).toBe(farmerId);
    expect(historyEntry.note).toBe("Handed over to buyer directly");

    // COD transitioned to PAID on delivery
    expect(dbOrder?.payment.status).toBe(PaymentStatus.PAID);

    expect(deliveredEvents).toHaveLength(1);
    expect(deliveredEvents[0]).toMatchObject({
      orderId,
      farmerId,
      buyerId,
      note: "Handed over to buyer directly",
    });

    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0]).toMatchObject({
      orderId,
      farmerId,
      buyerId,
      method: PaymentMethod.COD,
    });
  });

  it("3. Buyer marks paid: emits payment.paid event", async () => {
    const orderId = await createInitialOrder({
      status: OrderStatus.CONFIRMED,
      confirmedAt: testClock.now(),
      payment: {
        method: PaymentMethod.WALLET_SIM,
        status: PaymentStatus.UNPAID,
      },
    });

    const paymentEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.PAYMENT_PAID, (payload) => {
      paymentEvents.push(payload);
    });

    await service.markPaid(orderId, buyerActor, {
      method: PaymentMethod.WALLET_SIM,
    });

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder!.payment.status).toBe(PaymentStatus.PAID);
    expect(dbOrder!.payment.method).toBe(PaymentMethod.WALLET_SIM);

    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0]).toMatchObject({
      orderId,
      buyerId,
      farmerId,
      amount: 150000,
      method: PaymentMethod.WALLET_SIM,
    });
  });

  it("4. Buyer completes: produces statusHistory entry and emits order.completed", async () => {
    const orderId = await createInitialOrder({
      status: OrderStatus.DELIVERED,
      confirmedAt: testClock.now(),
      deliveredAt: testClock.now(),
      statusHistory: [
        { status: OrderStatus.PENDING, at: testClock.now() },
        { status: OrderStatus.CONFIRMED, at: testClock.now() },
        { status: OrderStatus.DELIVERED, at: testClock.now() },
      ],
    });

    const completedEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_COMPLETED, (payload) => {
      completedEvents.push(payload);
    });

    await service.complete(orderId, buyerActor, {
      note: "Goods received in excellent condition",
    });

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.COMPLETED);
    expect(dbOrder?.statusHistory).toHaveLength(4);

    const historyEntry = dbOrder?.statusHistory[3];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.COMPLETED);
    expect(historyEntry.byUserId?.toString()).toBe(buyerId);
    expect(historyEntry.note).toBe("Goods received in excellent condition");

    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0]).toMatchObject({
      orderId,
      buyerId,
      farmerId,
      note: "Goods received in excellent condition",
    });
  });

  it("5. Buyer disputes: produces statusHistory entry and emits order.disputed", async () => {
    const orderId = await createInitialOrder({
      status: OrderStatus.DELIVERED,
      confirmedAt: testClock.now(),
      deliveredAt: testClock.now(),
      statusHistory: [
        { status: OrderStatus.PENDING, at: testClock.now() },
        { status: OrderStatus.CONFIRMED, at: testClock.now() },
        { status: OrderStatus.DELIVERED, at: testClock.now() },
      ],
    });

    const disputedEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_DISPUTED, (payload) => {
      disputedEvents.push(payload);
    });

    await service.dispute(orderId, buyerActor, {
      reason: "GRADE_LOWER_THAN_LISTED",
      note: "Grade B delivered instead of Grade A",
    });

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.DISPUTED);
    expect(dbOrder?.statusHistory).toHaveLength(4);

    const historyEntry = dbOrder?.statusHistory[3];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.DISPUTED);
    expect(historyEntry.byUserId?.toString()).toBe(buyerId);
    expect(historyEntry.note).toBe("GRADE_LOWER_THAN_LISTED: Grade B delivered instead of Grade A");

    expect(disputedEvents).toHaveLength(1);
    expect(disputedEvents[0]).toMatchObject({
      orderId,
      buyerId,
      farmerId,
      reason: "GRADE_LOWER_THAN_LISTED",
      note: "Grade B delivered instead of Grade A",
    });
  });

  it("6. Participant cancels: produces statusHistory entry and emits order.cancelled with refund flag", async () => {
    const orderId = await createInitialOrder({
      status: OrderStatus.CONFIRMED,
      confirmedAt: testClock.now(),
      payment: {
        method: PaymentMethod.WALLET_SIM,
        status: PaymentStatus.PAID,
        paidAt: testClock.now(),
      },
      statusHistory: [
        { status: OrderStatus.PENDING, at: testClock.now() },
        { status: OrderStatus.CONFIRMED, at: testClock.now() },
      ],
    });

    const cancelledEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_CANCELLED, (payload) => {
      cancelledEvents.push(payload);
    });

    await service.cancel(orderId, buyerActor, {
      reason: "BUYER_REQUEST",
      note: "Ordered wrong crop",
    });

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.CANCELLED);
    expect(dbOrder?.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(dbOrder?.statusHistory).toHaveLength(3);

    const historyEntry = dbOrder?.statusHistory[2];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.CANCELLED);
    expect(historyEntry.byUserId?.toString()).toBe(buyerId);
    expect(historyEntry.note).toBe("BUYER_REQUEST: Ordered wrong crop");

    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0]).toMatchObject({
      orderId,
      cancelledBy: buyerId,
      reason: "BUYER_REQUEST",
      refunded: true,
    });
  });

  it("7. System auto-cancel: produces statusHistory entry and emits order.cancelled", async () => {
    // Created 13 hours ago (past 12h deadline)
    const createdAt = new Date(testClock.now().getTime() - 13 * 3600 * 1000);
    const orderId = await createInitialOrder({
      status: OrderStatus.PENDING,
      createdAt,
      statusHistory: [{ status: OrderStatus.PENDING, at: createdAt }],
    });

    const cancelledEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_CANCELLED, (payload) => {
      cancelledEvents.push(payload);
    });

    const summary = await cancelDuePendingOrders({ clock: testClock, isDemoMode: false });
    expect(summary.processed).toBe(1);

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.CANCELLED);
    expect(dbOrder?.statusHistory).toHaveLength(2);

    const historyEntry = dbOrder?.statusHistory[1];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.CANCELLED);
    expect(historyEntry.note).toContain("NOT_CONFIRMED_IN_TIME");

    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0]).toMatchObject({
      orderId,
      reason: "NOT_CONFIRMED_IN_TIME",
    });
  });

  it("8. System auto-complete: produces statusHistory entry and emits order.completed", async () => {
    // Delivered 25 hours ago (past 24h deadline)
    const deliveredAt = new Date(testClock.now().getTime() - 25 * 3600 * 1000);
    const orderId = await createInitialOrder({
      status: OrderStatus.DELIVERED,
      deliveredAt,
      statusHistory: [
        { status: OrderStatus.PENDING, at: deliveredAt },
        { status: OrderStatus.CONFIRMED, at: deliveredAt },
        { status: OrderStatus.DELIVERED, at: deliveredAt },
      ],
    });

    const completedEvents: unknown[] = [];
    getDomainEventEmitter().on(DomainEventName.ORDER_COMPLETED, (payload) => {
      completedEvents.push(payload);
    });

    const summary = await completeDueDeliveredOrders({ clock: testClock, isDemoMode: false });
    expect(summary.processed).toBe(1);

    const dbOrder = await Order.findById(orderId).lean();
    expect(dbOrder).toBeDefined();
    expect(dbOrder?.status).toBe(OrderStatus.COMPLETED);
    expect(dbOrder?.statusHistory).toHaveLength(4);

    const historyEntry = dbOrder?.statusHistory[3];
    expect(historyEntry).toBeDefined();
    if (!historyEntry) throw new Error("Expected historyEntry to be defined");
    expect(historyEntry.status).toBe(OrderStatus.COMPLETED);
    expect(historyEntry.note).toBe("Auto-completed by system after 24h with no dispute");

    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0]).toMatchObject({
      orderId,
      note: "Auto-completed by system after 24h with no dispute",
    });
  });
});
