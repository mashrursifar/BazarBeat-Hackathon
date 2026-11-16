import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CropGrade,
  DomainEventName,
  FulfilmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockReturnDecision,
  UserRole,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import { DomainEventEmitter, resetDomainEventEmitter, setDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { InventoryItem } from "../inventory/inventory-item.model.js";
import { addStock, markStockSold, reserveStockForListing } from "../inventory/inventory.service.js";
import { StockMovement } from "../inventory/stock-movement.model.js";
import { Order, type OrderRecord } from "./order.model.js";
import { OrderTransitionService } from "./order-transition.service.js";

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;
let service: OrderTransitionService;

const farmerId = new Types.ObjectId().toString();
const buyerId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
const cropId = new Types.ObjectId().toString();

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoReplSet.getUri());
  await Promise.all([Order.init(), InventoryItem.init(), StockMovement.init()]);
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
  service = new OrderTransitionService();
});

afterEach(() => {
  resetClock();
  resetDomainEventEmitter();
});

interface CreateOrderOptions {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  quantityKg?: number;
  pricePerKg?: number;
  platformFee?: number;
  farmerNet?: number;
}

async function createTestOrder(
  options: CreateOrderOptions = {},
): Promise<mongoose.HydratedDocument<OrderRecord>> {
  const listingId = new Types.ObjectId().toString();
  const quantityKg = options.quantityKg ?? 50;
  const pricePerKg = options.pricePerKg ?? 4000;
  const subtotal = quantityKg * pricePerKg; // 200,000 poisha
  const platformFee = options.platformFee ?? 4000; // 200 bps
  const farmerNet = options.farmerNet ?? subtotal - platformFee;

  const order = await Order.create({
    listingId,
    farmerId,
    buyerId,
    cropId,
    quantityKg,
    grade: CropGrade.A,
    pricePerKg,
    subtotal,
    platformFee,
    farmerNet,
    status: options.status ?? OrderStatus.PENDING,
    payment: {
      status: options.paymentStatus ?? PaymentStatus.UNPAID,
      ...(options.paymentMethod ? { method: options.paymentMethod } : {}),
      ...(options.paymentStatus === PaymentStatus.PAID ? { paidAt: testClock.now() } : {}),
    },
    fulfilment: {
      method: FulfilmentMethod.PICKUP,
    },
    statusHistory: [
      {
        status: options.status ?? OrderStatus.PENDING,
        at: testClock.now(),
        note: "Initial test creation",
      },
    ],
  });

  return order;
}

describe("OrderTransitionService (Task 6.3 - Transition Engine)", () => {
  describe("Valid Transitions", () => {
    it("confirms a PENDING order with handover schedule and note (farmer)", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });
      const events: unknown[] = [];
      eventEmitter.on(DomainEventName.ORDER_CONFIRMED, (payload) => {
        events.push(payload);
      });

      const handoverAt = new Date("2026-11-17T12:00:00.000Z").toISOString();
      const updated = await service.confirm(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { handoverAt, note: "Meet at central collection point", fulfilmentMethod: FulfilmentMethod.PICKUP },
      );

      expect(updated.status).toBe(OrderStatus.CONFIRMED);
      expect(updated.confirmedAt).toBe(testClock.iso());
      expect(updated.fulfilment?.handoverAt).toBe(handoverAt);
      expect(updated.fulfilment?.note).toBe("Meet at central collection point");
      expect(updated.statusHistory).toHaveLength(2);
      expect(updated.statusHistory?.[1]).toMatchObject({
        status: OrderStatus.CONFIRMED,
        at: testClock.iso(),
        byUserId: farmerId,
        note: "Meet at central collection point",
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        orderId: order._id.toString(),
        farmerId,
        buyerId,
        confirmedAt: testClock.iso(),
        handoverAt,
      });
    });

    it("marks payment as PAID via WALLET_SIM (buyer)", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING, paymentStatus: PaymentStatus.UNPAID });
      const paymentEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.PAYMENT_PAID, (payload) => {
        paymentEvents.push(payload);
      });

      const updated = await service.markPaid(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
      );

      expect(updated.payment.status).toBe(PaymentStatus.PAID);
      expect(updated.payment.method).toBe(PaymentMethod.WALLET_SIM);
      expect(updated.payment.paidAt).toBe(testClock.iso());
      expect(updated.status).toBe(OrderStatus.PENDING); // Order status untouched
      expect(paymentEvents).toHaveLength(1);
      expect(paymentEvents[0]).toMatchObject({
        orderId: order._id.toString(),
        buyerId,
        amount: 200000,
        method: PaymentMethod.WALLET_SIM,
        paidAt: testClock.iso(),
      });
    });

    it("marks order as DELIVERED by farmer; COD becomes PAID automatically", async () => {
      const order = await createTestOrder({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: PaymentMethod.COD,
      });
      const deliveredEvents: unknown[] = [];
      const paymentEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.ORDER_DELIVERED, (payload) => {
        deliveredEvents.push(payload);
      });
      eventEmitter.on(DomainEventName.PAYMENT_PAID, (payload) => {
        paymentEvents.push(payload);
      });

      const updated = await service.markDelivered(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { note: "Goods inspected and handed over" },
      );

      expect(updated.status).toBe(OrderStatus.DELIVERED);
      expect(updated.deliveredAt).toBe(testClock.iso());
      expect(updated.payment.status).toBe(PaymentStatus.PAID);
      expect(updated.payment.method).toBe(PaymentMethod.COD);
      expect(updated.payment.paidAt).toBe(testClock.iso());

      expect(deliveredEvents).toHaveLength(1);
      expect(paymentEvents).toHaveLength(1);
    });

    it("marks order as DELIVERED when already paid by wallet; does not overwrite payment method", async () => {
      const order = await createTestOrder({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.WALLET_SIM,
      });
      const paymentEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.PAYMENT_PAID, (payload) => {
        paymentEvents.push(payload);
      });

      const updated = await service.markDelivered(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
      );

      expect(updated.status).toBe(OrderStatus.DELIVERED);
      expect(updated.payment.status).toBe(PaymentStatus.PAID);
      expect(updated.payment.method).toBe(PaymentMethod.WALLET_SIM);
      // No duplicate payment.paid event because it was already paid
      expect(paymentEvents).toHaveLength(0);
    });

    it("completes order from DELIVERED (buyer)", async () => {
      const order = await createTestOrder({
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      });
      const completedEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.ORDER_COMPLETED, (payload) => {
        completedEvents.push(payload);
      });

      const updated = await service.complete(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
        { note: "Everything verified in good condition" },
      );

      expect(updated.status).toBe(OrderStatus.COMPLETED);
      expect(updated.completedAt).toBe(testClock.iso());
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toMatchObject({
        orderId: order._id.toString(),
        completedAt: testClock.iso(),
      });
    });

    it("cancels from PENDING by buyer", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });
      const cancelEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.ORDER_CANCELLED, (payload) => {
        cancelEvents.push(payload);
      });

      const updated = await service.cancel(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
        { reason: "BUYER_CANNOT_COLLECT", note: "Vehicle breakdown" },
      );

      expect(updated.status).toBe(OrderStatus.CANCELLED);
      expect(updated.cancelledAt).toBe(testClock.iso());
      expect(updated.cancelledBy).toBe(buyerId);
      expect(updated.cancelReason).toBe("BUYER_CANNOT_COLLECT");
      expect(updated.cancelNote).toBe("Vehicle breakdown");
      expect(cancelEvents).toHaveLength(1);
      expect(cancelEvents[0]).toMatchObject({
        orderId: order._id.toString(),
        cancelledBy: buyerId,
        refunded: false,
      });
    });

    it("cancels from CONFIRMED by farmer", async () => {
      const order = await createTestOrder({ status: OrderStatus.CONFIRMED });

      const updated = await service.cancel(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { reason: "FARMER_CROP_DAMAGED", note: "Storage pest damage" },
      );

      expect(updated.status).toBe(OrderStatus.CANCELLED);
      expect(updated.cancelledAt).toBe(testClock.iso());
      expect(updated.cancelledBy).toBe(farmerId);
      expect(updated.cancelReason).toBe("FARMER_CROP_DAMAGED");
    });
  });

  describe("Invalid Transitions & State Guards", () => {
    it("rejects confirming an already CONFIRMED order with INVALID_TRANSITION", async () => {
      const order = await createTestOrder({ status: OrderStatus.CONFIRMED });

      await expect(
        service.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt: new Date("2026-11-17T12:00:00.000Z").toISOString() },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("rejects completing an order in PENDING status with INVALID_TRANSITION", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      await expect(
        service.complete(order._id.toString(), { userId: buyerId, role: UserRole.BUYER }),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("rejects mark-delivered on an order in PENDING status", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      await expect(
        service.markDelivered(order._id.toString(), { userId: farmerId, role: UserRole.FARMER }),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("rejects cancellation on a DELIVERED order", async () => {
      const order = await createTestOrder({ status: OrderStatus.DELIVERED });

      await expect(
        service.cancel(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
          { reason: "BUYER_CHANGE_OF_MIND" },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("rejects cancellation on a COMPLETED order", async () => {
      const order = await createTestOrder({ status: OrderStatus.COMPLETED });

      await expect(
        service.cancel(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { reason: "OTHER" },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("rejects buyer trying to confirm", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      await expect(
        service.confirm(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
          { handoverAt: new Date("2026-11-17T12:00:00.000Z").toISOString() },
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });

    it("rejects farmer trying to complete", async () => {
      const order = await createTestOrder({ status: OrderStatus.DELIVERED });

      await expect(
        service.complete(order._id.toString(), { userId: farmerId, role: UserRole.FARMER }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });

    it("rejects a random third party from cancelling", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      await expect(
        service.cancel(
          order._id.toString(),
          { userId: otherUserId, role: UserRole.BUYER },
          { reason: "OTHER" },
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });

    it("rejects invalid handover schedule (in the past or > 72h ahead)", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      // Past time
      await expect(
        service.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt: new Date("2026-11-16T08:00:00.000Z").toISOString() },
        ),
      ).rejects.toMatchObject({
        code: "HANDOVER_TIME_INVALID",
        statusCode: 400,
      });

      // Too far in future (> 72 hours)
      await expect(
        service.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt: new Date("2026-11-20T12:00:00.000Z").toISOString() },
        ),
      ).rejects.toMatchObject({
        code: "HANDOVER_TIME_INVALID",
        statusCode: 400,
      });
    });
  });

  describe("Confirm versus Cancel Race & Repeated Actions", () => {
    it("handles simultaneous confirm versus cancel race; exactly one wins and the loser gets INVALID_TRANSITION", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });
      const handoverAt = new Date("2026-11-17T12:00:00.000Z").toISOString();

      const [confirmResult, cancelResult] = await Promise.allSettled([
        service.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt },
        ),
        service.cancel(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
          { reason: "BUYER_CANNOT_COLLECT" },
        ),
      ]);

      const fulfilled = [confirmResult, cancelResult].filter((r) => r.status === "fulfilled");
      const rejected = [confirmResult, cancelResult].filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });

      const finalDbOrder = await Order.findById(order._id);
      expect([OrderStatus.CONFIRMED, OrderStatus.CANCELLED]).toContain(finalDbOrder?.status);
    });

    it("returns INVALID_TRANSITION when calling confirm repeatedly", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });
      const handoverAt = new Date("2026-11-17T12:00:00.000Z").toISOString();

      await service.confirm(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { handoverAt },
      );

      await expect(
        service.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("returns INVALID_TRANSITION when calling cancel repeatedly", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      await service.cancel(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
        { reason: "BUYER_CHANGE_OF_MIND" },
      );

      await expect(
        service.cancel(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
          { reason: "BUYER_CHANGE_OF_MIND" },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });

    it("returns ORDER_ALREADY_PAID when calling markPaid repeatedly", async () => {
      const order = await createTestOrder({ status: OrderStatus.PENDING });

      await service.markPaid(order._id.toString(), { userId: buyerId, role: UserRole.BUYER });

      await expect(
        service.markPaid(order._id.toString(), { userId: buyerId, role: UserRole.BUYER }),
      ).rejects.toMatchObject({
        code: "ORDER_ALREADY_PAID",
        statusCode: 409,
      });
    });
  });

  describe("Payment Outcomes in Each Path", () => {
    it("Path A (COD): UNPAID switches to PAID upon delivery, emitting payment.paid", async () => {
      const order = await createTestOrder({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: PaymentMethod.COD,
      });
      const paymentEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.PAYMENT_PAID, (p) => {
        paymentEvents.push(p);
      });

      const updated = await service.markDelivered(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
      );

      expect(updated.payment.status).toBe(PaymentStatus.PAID);
      expect(updated.payment.method).toBe(PaymentMethod.COD);
      expect(paymentEvents).toHaveLength(1);
    });

    it("Path B (Wallet Simulation): UNPAID switches to PAID via markPaid; subsequent delivery does not duplicate payment", async () => {
      const order = await createTestOrder({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
      });
      const paymentEvents: unknown[] = [];
      eventEmitter.on(DomainEventName.PAYMENT_PAID, (p) => {
        paymentEvents.push(p);
      });

      // Buyer pays
      const paidOrder = await service.markPaid(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
      );
      expect(paidOrder.payment.status).toBe(PaymentStatus.PAID);
      expect(paidOrder.payment.method).toBe(PaymentMethod.WALLET_SIM);
      expect(paymentEvents).toHaveLength(1);

      // Farmer delivers
      const deliveredOrder = await service.markDelivered(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
      );
      expect(deliveredOrder.payment.status).toBe(PaymentStatus.PAID);
      expect(deliveredOrder.payment.method).toBe(PaymentMethod.WALLET_SIM);
      expect(paymentEvents).toHaveLength(1); // No new event
    });

    it("Path C (Wallet Refund Simulation): Order paid via WALLET_SIM is refunded on cancellation", async () => {
      const order = await createTestOrder({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.WALLET_SIM,
      });
      const cancelEvents: Array<{ refunded?: boolean }> = [];
      eventEmitter.on(DomainEventName.ORDER_CANCELLED, (p) => {
        cancelEvents.push(p);
      });

      const cancelled = await service.cancel(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
        { reason: "BUYER_CANNOT_COLLECT" },
      );

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.payment.status).toBe(PaymentStatus.REFUNDED);
      expect(cancelled.payment.refundedAt).toBe(testClock.iso());
      expect(cancelEvents).toHaveLength(1);
      expect(cancelEvents[0]?.refunded).toBe(true);
    });

    it("Path D (Unpaid COD Cancel): Cancellation of unpaid COD order does not trigger refund", async () => {
      const order = await createTestOrder({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: PaymentMethod.COD,
      });
      const cancelEvents: Array<{ refunded?: boolean }> = [];
      eventEmitter.on(DomainEventName.ORDER_CANCELLED, (p) => {
        cancelEvents.push(p);
      });

      const cancelled = await service.cancel(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { reason: "FARMER_UNABLE_TO_FULFILL" },
      );

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.payment.status).toBe(PaymentStatus.UNPAID);
      expect(cancelled.payment.refundedAt).toBeUndefined();
      expect(cancelEvents[0]?.refunded).toBe(false);
    });
  });

  describe("decideStockReturn & Ledger Reconciliation", () => {
    it("allows farmer to return stock (RETURNED) after cancellation and reconciles the ledger", async () => {
      // Setup inventory: 100 kg added, 50 kg listed, 50 kg sold
      const listingId = new Types.ObjectId().toString();
      await addStock({ farmerId, cropId, quantityKg: 100, operationId: "setup-add" });
      await reserveStockForListing({ farmerId, cropId, quantityKg: 50, listingId, operationId: "setup-list" });

      const order = await createTestOrder({
        status: OrderStatus.PENDING,
        quantityKg: 50,
      });

      await markStockSold({
        farmerId,
        cropId,
        quantityKg: 50,
        orderId: order._id.toString(),
        operationId: "setup-sell",
      });

      // Verification before cancel: available 50, listed 0, sold 50
      expect(await InventoryItem.findOne({ farmerId, cropId }).lean()).toMatchObject({
        availableKg: 50,
        listedKg: 0,
        soldKg: 50,
      });

      // Cancel the order
      await service.cancel(
        order._id.toString(),
        { userId: buyerId, role: UserRole.BUYER },
        { reason: "BUYER_CANNOT_COLLECT" },
      );

      // Farmer decides stock return -> RETURNED
      const updated = await service.decideStockReturn(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { decision: StockReturnDecision.RETURNED, note: "Produce still fresh and returned to store" },
      );

      expect(updated.stockReturn?.decision).toBe(StockReturnDecision.RETURNED);
      expect(updated.stockReturn?.decidedAt).toBe(testClock.iso());

      // Inventory check: sold decreases by 50 (to 0), available increases by 50 (to 100)
      const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
      expect(inventory).toMatchObject({
        availableKg: 100,
        listedKg: 0,
        soldKg: 0,
      });

      // Verify RETURN movement in ledger
      const returnMovement = await StockMovement.findOne({
        orderId: order._id.toString(),
        type: "RETURN",
      }).lean();
      expect(returnMovement).toBeDefined();
      expect(returnMovement?.quantityKg).toBe(50);
      expect(returnMovement?.status).toBe("APPLIED");

      // Full ledger reconciliation
      const allMovements = await StockMovement.find({ status: "APPLIED" }).lean();
      const ledgerTotals = allMovements.reduce(
        (totals, m) => {
          if (m.type === "ADD") totals.availableKg += m.quantityKg;
          if (m.type === "LIST") {
            totals.availableKg -= m.quantityKg;
            totals.listedKg += m.quantityKg;
          }
          if (m.type === "SELL") {
            totals.listedKg -= m.quantityKg;
            totals.soldKg += m.quantityKg;
          }
          if (m.type === "RETURN") {
            totals.availableKg += m.quantityKg;
            totals.soldKg -= m.quantityKg;
          }
          return totals;
        },
        { availableKg: 0, listedKg: 0, soldKg: 0 },
      );
      expect(inventory).toMatchObject(ledgerTotals);

      // Reject deciding stock return a second time (only once!)
      await expect(
        service.decideStockReturn(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { decision: StockReturnDecision.RETURNED },
        ),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    });

    it("allows farmer to discard stock (DISCARDED) without modifying inventory", async () => {
      await addStock({ farmerId, cropId, quantityKg: 50, operationId: "setup-discard-add" });
      const order = await createTestOrder({ status: OrderStatus.PENDING, quantityKg: 20 });
      await service.cancel(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { reason: "FARMER_CROP_DAMAGED" },
      );

      const updated = await service.decideStockReturn(
        order._id.toString(),
        { userId: farmerId, role: UserRole.FARMER },
        { decision: StockReturnDecision.DISCARDED, note: "Spoiled during delay" },
      );

      expect(updated.stockReturn?.decision).toBe(StockReturnDecision.DISCARDED);
      // No RETURN movement created
      expect(await StockMovement.countDocuments({ type: "RETURN" })).toBe(0);
    });

    it("rejects decideStockReturn on non-cancelled orders", async () => {
      const order = await createTestOrder({ status: OrderStatus.CONFIRMED });

      await expect(
        service.decideStockReturn(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { decision: StockReturnDecision.RETURNED },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_TRANSITION",
        statusCode: 409,
      });
    });
  });

  describe("Fee Snapshot Immutability", () => {
    it("ensures fee and farmer net remain identical to creation snapshot after config change and all transitions", async () => {
      // Initial platform fee 200 bps (2%)
      // subtotal 100,000 poisha -> fee 2,000 poisha, farmerNet 98,000 poisha
      const order = await createTestOrder({
        status: OrderStatus.PENDING,
        quantityKg: 25,
        pricePerKg: 4000,
        platformFee: 2000,
        farmerNet: 98000,
      });

      // Simulate a platform config change: PLATFORM_FEE_BPS changed to 500 bps (5%)
      const originalFeeBps = env.PLATFORM_FEE_BPS;
      (env as unknown as { PLATFORM_FEE_BPS: number }).PLATFORM_FEE_BPS = 500;

      try {
        const handoverAt = new Date("2026-11-17T12:00:00.000Z").toISOString();

        // Advance through all transitions: confirm -> markPaid -> markDelivered -> complete
        const confirmed = await service.confirm(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
          { handoverAt },
        );
        expect(confirmed.platformFee).toBe(2000);
        expect(confirmed.farmerNet).toBe(98000);
        expect(confirmed.subtotal).toBe(100000);

        const paid = await service.markPaid(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
        );
        expect(paid.platformFee).toBe(2000);
        expect(paid.farmerNet).toBe(98000);

        const delivered = await service.markDelivered(
          order._id.toString(),
          { userId: farmerId, role: UserRole.FARMER },
        );
        expect(delivered.platformFee).toBe(2000);
        expect(delivered.farmerNet).toBe(98000);

        const completed = await service.complete(
          order._id.toString(),
          { userId: buyerId, role: UserRole.BUYER },
        );
        expect(completed.platformFee).toBe(2000);
        expect(completed.farmerNet).toBe(98000);

        // Verify database document maintains snapshot
        const dbOrder = await Order.findById(order._id);
        expect(dbOrder?.platformFee).toBe(2000);
        expect(dbOrder?.farmerNet).toBe(98000);
        expect(dbOrder?.subtotal).toBe(100000);
      } finally {
        (env as unknown as { PLATFORM_FEE_BPS: number }).PLATFORM_FEE_BPS = originalFeeBps;
      }
    });
  });
});
