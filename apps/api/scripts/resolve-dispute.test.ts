import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CropGrade,
  DomainEventName,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@bazarbeat/shared";

import { TestClock, resetClock, setClock } from "../src/shared/clock.js";
import { getDomainEventEmitter } from "../src/shared/domain-event-emitter.js";
import { Order } from "../src/modules/orders/order.model.js";
import { runResolveDispute } from "./resolve-dispute.js";

describe("dev-only resolve-dispute script (Task 6.11)", () => {
  let replSet: MongoMemoryReplSet;

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
    setClock(new TestClock(new Date("2026-11-16T12:00:00.000Z")));
    await Order.deleteMany({});
  });

  it("refuses to run when NODE_ENV is production", async () => {
    const stderrMock = vi.fn();
    const result = await runResolveDispute({
      orderId: "6788f4b5c92842f1b0a81123",
      action: "COMPLETE",
      nodeEnv: "production",
      stderr: stderrMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("PRODUCTION_ENV_FORBIDDEN");
    expect(stderrMock).toHaveBeenCalledWith(
      expect.stringContaining("Refusing to run resolve-dispute script in production environment"),
    );
  });

  it("rejects when order ID is missing or empty", async () => {
    const stderrMock = vi.fn();
    const result = await runResolveDispute({
      orderId: "   ",
      action: "COMPLETE",
      nodeEnv: "development",
      stderr: stderrMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("MISSING_ORDER_ID");
    expect(stderrMock).toHaveBeenCalledWith(expect.stringContaining("Missing order ID"));
  });

  it("rejects invalid resolution action", async () => {
    const stderrMock = vi.fn();
    const result = await runResolveDispute({
      orderId: "6788f4b5c92842f1b0a81123",
      action: "INVALID" as unknown as "complete",
      nodeEnv: "development",
      stderr: stderrMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_ACTION");
    expect(stderrMock).toHaveBeenCalledWith(
      expect.stringContaining('Must be "complete" or "cancel"'),
    );
  });

  it("resolves a DISPUTED order as COMPLETE", async () => {
    const eventSpy = vi.fn();
    getDomainEventEmitter().on(DomainEventName.ORDER_COMPLETED, eventSpy);

    const order = await Order.create({
      listingId: new mongoose.Types.ObjectId(),
      farmerId: new mongoose.Types.ObjectId(),
      buyerId: new mongoose.Types.ObjectId(),
      cropId: new mongoose.Types.ObjectId(),
      quantityKg: 100,
      grade: CropGrade.A,
      pricePerKg: 3500,
      subtotal: 350000,
      platformFee: 7000,
      farmerNet: 343000,
      status: OrderStatus.DISPUTED,
      payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      deliveredAt: new Date("2026-11-16T10:00:00.000Z"),
      dispute: {
        reason: "GRADE_LOWER_THAN_LISTED",
        note: "Produce grade A expected, got lower",
        raisedAt: new Date("2026-11-16T11:00:00.000Z"),
      },
      statusHistory: [
        {
          status: OrderStatus.DELIVERED,
          at: new Date("2026-11-16T10:00:00.000Z"),
        },
        {
          status: OrderStatus.DISPUTED,
          at: new Date("2026-11-16T11:00:00.000Z"),
          note: "GRADE_LOWER_THAN_LISTED",
        },
      ],
    });

    const stdoutMock = vi.fn();
    const result = await runResolveDispute({
      orderId: order._id.toString(),
      action: "COMPLETE",
      note: "Produce verified to meet grade A standard",
      nodeEnv: "development",
      stdout: stdoutMock,
    });

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe(OrderStatus.COMPLETED);

    // Verify DB update
    const updated = await Order.findById(order._id);
    expect(updated?.status).toBe(OrderStatus.COMPLETED);
    expect(updated?.dispute?.resolution).toBe("Produce verified to meet grade A standard");
    expect(updated?.completedAt).toBeDefined();

    // Verify statusHistory
    const lastHistory = updated?.statusHistory[updated.statusHistory.length - 1];
    expect(lastHistory?.status).toBe(OrderStatus.COMPLETED);
    expect(lastHistory?.note).toContain("Produce verified to meet grade A standard");

    // Verify domain event
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order._id.toString(),
      }),
    );
  });

  it("resolves a DISPUTED order as CANCEL and refunds wallet payment", async () => {
    const eventSpy = vi.fn();
    getDomainEventEmitter().on(DomainEventName.ORDER_CANCELLED, eventSpy);

    const order = await Order.create({
      listingId: new mongoose.Types.ObjectId(),
      farmerId: new mongoose.Types.ObjectId(),
      buyerId: new mongoose.Types.ObjectId(),
      cropId: new mongoose.Types.ObjectId(),
      quantityKg: 80,
      grade: CropGrade.B,
      pricePerKg: 2000,
      subtotal: 160000,
      platformFee: 3200,
      farmerNet: 156800,
      status: OrderStatus.DISPUTED,
      payment: {
        status: PaymentStatus.PAID,
        method: PaymentMethod.WALLET_SIM,
        paidAt: new Date("2026-11-16T09:00:00.000Z"),
      },
      deliveredAt: new Date("2026-11-16T10:00:00.000Z"),
      dispute: {
        reason: "SPOILED",
        note: "Rotten produce in transit",
        raisedAt: new Date("2026-11-16T11:00:00.000Z"),
      },
      statusHistory: [
        {
          status: OrderStatus.DISPUTED,
          at: new Date("2026-11-16T11:00:00.000Z"),
        },
      ],
    });

    const result = await runResolveDispute({
      orderId: order._id.toString(),
      action: "CANCEL",
      note: "Produce spoiled upon arrival; refund approved",
      nodeEnv: "development",
    });

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe(OrderStatus.CANCELLED);

    // Verify DB update
    const updated = await Order.findById(order._id);
    expect(updated?.status).toBe(OrderStatus.CANCELLED);
    expect(updated?.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(updated?.payment.refundedAt).toBeDefined();
    expect(updated?.cancelReason).toBe("DISPUTE_RESOLVED_CANCELLED");
    expect(updated?.dispute?.resolution).toBe("Produce spoiled upon arrival; refund approved");

    // Verify event
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order._id.toString(),
        refunded: true,
      }),
    );
  });

  it("rejects resolving an order that is not DISPUTED", async () => {
    const order = await Order.create({
      listingId: new mongoose.Types.ObjectId(),
      farmerId: new mongoose.Types.ObjectId(),
      buyerId: new mongoose.Types.ObjectId(),
      cropId: new mongoose.Types.ObjectId(),
      quantityKg: 50,
      grade: CropGrade.A,
      pricePerKg: 3000,
      subtotal: 150000,
      platformFee: 3000,
      farmerNet: 147000,
      status: OrderStatus.DELIVERED,
      payment: { status: PaymentStatus.UNPAID },
    });

    const stderrMock = vi.fn();
    const result = await runResolveDispute({
      orderId: order._id.toString(),
      action: "COMPLETE",
      nodeEnv: "development",
      stderr: stderrMock,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("must be DISPUTED");
  });
});
