import { describe, expect, it } from "vitest";
import {
  OrderAction,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "./enums.js";
import {
  ALLOWED_ORDER_TRANSITIONS,
  ALLOWED_PAYMENT_TRANSITIONS,
  canPerformOrderAction,
  getOrderActions,
  isAllowedOrderTransition,
  isAllowedPaymentTransition,
  validateHandoverSchedule,
} from "./order-rules.js";
import { ORDER_HANDOVER } from "./timing.js";

describe("ALLOWED_ORDER_TRANSITIONS & isAllowedOrderTransition", () => {
  it("defines transitions matching AUCTION_RULES §11", () => {
    expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.PENDING]).toEqual([
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
    ]);
    expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.CONFIRMED]).toEqual([
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ]);
    expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
    ]);
    expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.COMPLETED]).toEqual([]);
    expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
    expect(ALLOWED_ORDER_TRANSITIONS[OrderStatus.DISPUTED]).toEqual([]);
  });

  it("permits valid transitions", () => {
    expect(isAllowedOrderTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(isAllowedOrderTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(isAllowedOrderTransition(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)).toBe(true);
    expect(isAllowedOrderTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    expect(isAllowedOrderTransition(OrderStatus.DELIVERED, OrderStatus.COMPLETED)).toBe(true);
    expect(isAllowedOrderTransition(OrderStatus.DELIVERED, OrderStatus.DISPUTED)).toBe(true);
  });

  it("rejects illegal transitions and jumps", () => {
    expect(isAllowedOrderTransition(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
    expect(isAllowedOrderTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toBe(false);
    expect(isAllowedOrderTransition(OrderStatus.CONFIRMED, OrderStatus.COMPLETED)).toBe(false);
    expect(isAllowedOrderTransition(OrderStatus.COMPLETED, OrderStatus.PENDING)).toBe(false);
    expect(isAllowedOrderTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
    expect(isAllowedOrderTransition(OrderStatus.DISPUTED, OrderStatus.DELIVERED)).toBe(false);
  });
});

describe("ALLOWED_PAYMENT_TRANSITIONS & isAllowedPaymentTransition", () => {
  it("defines transitions matching independent payment flow", () => {
    expect(ALLOWED_PAYMENT_TRANSITIONS[PaymentStatus.UNPAID]).toEqual([PaymentStatus.PAID]);
    expect(ALLOWED_PAYMENT_TRANSITIONS[PaymentStatus.PAID]).toEqual([PaymentStatus.REFUNDED]);
    expect(ALLOWED_PAYMENT_TRANSITIONS[PaymentStatus.REFUNDED]).toEqual([]);
  });

  it("allows UNPAID -> PAID and PAID -> REFUNDED", () => {
    expect(isAllowedPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.PAID)).toBe(true);
    expect(isAllowedPaymentTransition(PaymentStatus.PAID, PaymentStatus.REFUNDED)).toBe(true);
  });

  it("rejects backwards or invalid payment transitions", () => {
    expect(isAllowedPaymentTransition(PaymentStatus.PAID, PaymentStatus.UNPAID)).toBe(false);
    expect(isAllowedPaymentTransition(PaymentStatus.REFUNDED, PaymentStatus.PAID)).toBe(false);
    expect(isAllowedPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.REFUNDED)).toBe(false);
  });
});

describe("getOrderActions for every role and status", () => {
  const statuses = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
    OrderStatus.DISPUTED,
  ] as const;

  describe("Farmer actions", () => {
    it("PENDING: can CONFIRM and CANCEL", () => {
      const actions = getOrderActions(UserRole.FARMER, { status: OrderStatus.PENDING });
      expect(actions).toEqual([OrderAction.CONFIRM, OrderAction.CANCEL]);
      expect(canPerformOrderAction(UserRole.FARMER, OrderAction.CONFIRM, { status: OrderStatus.PENDING })).toBe(true);
      expect(canPerformOrderAction(UserRole.FARMER, OrderAction.CANCEL, { status: OrderStatus.PENDING })).toBe(true);
      expect(canPerformOrderAction(UserRole.FARMER, OrderAction.MARK_DELIVERED, { status: OrderStatus.PENDING })).toBe(false);
    });

    it("CONFIRMED: can MARK_DELIVERED and CANCEL", () => {
      const actions = getOrderActions(UserRole.FARMER, { status: OrderStatus.CONFIRMED });
      expect(actions).toEqual([OrderAction.MARK_DELIVERED, OrderAction.CANCEL]);
      expect(canPerformOrderAction(UserRole.FARMER, OrderAction.MARK_DELIVERED, { status: OrderStatus.CONFIRMED })).toBe(true);
      expect(canPerformOrderAction(UserRole.FARMER, OrderAction.CANCEL, { status: OrderStatus.CONFIRMED })).toBe(true);
      expect(canPerformOrderAction(UserRole.FARMER, OrderAction.CONFIRM, { status: OrderStatus.CONFIRMED })).toBe(false);
    });

    it("DELIVERED, COMPLETED, CANCELLED, DISPUTED: no actions for farmer", () => {
      const terminalOrWaiting = [
        OrderStatus.DELIVERED,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
        OrderStatus.DISPUTED,
      ];
      for (const status of terminalOrWaiting) {
        expect(getOrderActions(UserRole.FARMER, { status })).toEqual([]);
      }
    });
  });

  describe("Buyer actions", () => {
    it("PENDING (unpaid): can MARK_PAID and CANCEL", () => {
      const actions = getOrderActions(UserRole.BUYER, {
        status: OrderStatus.PENDING,
        payment: { status: PaymentStatus.UNPAID },
      });
      expect(actions).toEqual([OrderAction.MARK_PAID, OrderAction.CANCEL]);
      expect(canPerformOrderAction(UserRole.BUYER, OrderAction.MARK_PAID, { status: OrderStatus.PENDING })).toBe(true);
      expect(canPerformOrderAction(UserRole.BUYER, OrderAction.CANCEL, { status: OrderStatus.PENDING })).toBe(true);
    });

    it("PENDING (paid): can CANCEL only", () => {
      const actions = getOrderActions(UserRole.BUYER, {
        status: OrderStatus.PENDING,
        payment: { status: PaymentStatus.PAID },
      });
      expect(actions).toEqual([OrderAction.CANCEL]);
      expect(canPerformOrderAction(UserRole.BUYER, OrderAction.MARK_PAID, {
        status: OrderStatus.PENDING,
        payment: { status: PaymentStatus.PAID },
      })).toBe(false);
    });

    it("CONFIRMED (unpaid): can MARK_PAID and CANCEL", () => {
      const actions = getOrderActions(UserRole.BUYER, {
        status: OrderStatus.CONFIRMED,
        payment: { status: PaymentStatus.UNPAID },
      });
      expect(actions).toEqual([OrderAction.MARK_PAID, OrderAction.CANCEL]);
    });

    it("CONFIRMED (paid with WALLET_SIM): can CANCEL only", () => {
      const actions = getOrderActions(UserRole.BUYER, {
        status: OrderStatus.CONFIRMED,
        payment: { status: PaymentStatus.PAID, method: PaymentMethod.WALLET_SIM },
      });
      expect(actions).toEqual([OrderAction.CANCEL]);
    });

    it("DELIVERED (unpaid): can COMPLETE, DISPUTE, and MARK_PAID", () => {
      const actions = getOrderActions(UserRole.BUYER, {
        status: OrderStatus.DELIVERED,
        payment: { status: PaymentStatus.UNPAID },
      });
      expect(actions).toEqual([OrderAction.COMPLETE, OrderAction.DISPUTE, OrderAction.MARK_PAID]);
      expect(canPerformOrderAction(UserRole.BUYER, OrderAction.COMPLETE, { status: OrderStatus.DELIVERED })).toBe(true);
      expect(canPerformOrderAction(UserRole.BUYER, OrderAction.DISPUTE, { status: OrderStatus.DELIVERED })).toBe(true);
    });

    it("DELIVERED (paid): can COMPLETE and DISPUTE", () => {
      const actions = getOrderActions(UserRole.BUYER, {
        status: OrderStatus.DELIVERED,
        payment: { status: PaymentStatus.PAID },
      });
      expect(actions).toEqual([OrderAction.COMPLETE, OrderAction.DISPUTE]);
      expect(canPerformOrderAction(UserRole.BUYER, OrderAction.MARK_PAID, {
        status: OrderStatus.DELIVERED,
        payment: { status: PaymentStatus.PAID },
      })).toBe(false);
    });

    it("COMPLETED, CANCELLED, DISPUTED: no actions for buyer", () => {
      const terminalStatuses = [
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
        OrderStatus.DISPUTED,
      ];
      for (const status of terminalStatuses) {
        expect(getOrderActions(UserRole.BUYER, { status })).toEqual([]);
      }
    });
  });

  describe("Non-matching / invalid roles", () => {
    it("returns empty array for any status", () => {
      for (const status of statuses) {
        expect(getOrderActions("UNKNOWN_ROLE" as unknown as UserRole, { status })).toEqual([]);
      }
    });
  });
});

describe("validateHandoverSchedule", () => {
  const baseNow = new Date("2026-11-16T12:00:00.000Z");

  it("references ORDER_HANDOVER constants", () => {
    expect(ORDER_HANDOVER.MAX_HOURS_AHEAD).toBe(72);
    expect(ORDER_HANDOVER.MAX_NOTE_LENGTH).toBe(200);
  });

  it("accepts valid future handover time within 72 hours", () => {
    const handoverAt = new Date("2026-11-17T12:00:00.000Z"); // +24 hours
    const result = validateHandoverSchedule(handoverAt, baseNow);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("accepts string ISO datetime", () => {
    const result = validateHandoverSchedule("2026-11-18T10:00:00.000Z", baseNow);
    expect(result.valid).toBe(true);
  });

  it("accepts valid note within 200 characters", () => {
    const handoverAt = new Date("2026-11-17T12:00:00.000Z");
    const result = validateHandoverSchedule(handoverAt, baseNow, "Please meet at Savar Bazar warehouse entrance.");
    expect(result.valid).toBe(true);
  });

  it("rejects invalid date string", () => {
    const result = validateHandoverSchedule("not-a-date", baseNow);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid handover date format");
  });

  it("rejects past handover time (> 1 minute past)", () => {
    const past = new Date("2026-11-16T10:00:00.000Z"); // -2 hours
    const result = validateHandoverSchedule(past, baseNow);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Handover time must be in the future");
  });

  it("rejects handover time more than 72 hours ahead", () => {
    const farFuture = new Date("2026-11-20T14:00:00.000Z"); // ~98 hours
    const result = validateHandoverSchedule(farFuture, baseNow);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("72 hours ahead");
  });

  it("rejects note longer than 200 characters", () => {
    const handoverAt = new Date("2026-11-17T12:00:00.000Z");
    const longNote = "a".repeat(201);
    const result = validateHandoverSchedule(handoverAt, baseNow, longNote);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("exceeds maximum length of 200 characters");
  });
});
