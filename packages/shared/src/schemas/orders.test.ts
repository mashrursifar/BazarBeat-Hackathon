import { describe, expect, it } from "vitest";
import {
  CropGrade,
  FulfilmentMethod,
  OrderAction,
  OrderDisputeReason,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "../enums.js";
import {
  buyerOrderCardSchema,
  buyerOrderDetailSchema,
  cancelOrderRequestSchema,
  completeOrderRequestSchema,
  confirmOrderRequestSchema,
  counterpartySchema,
  disputeOrderRequestSchema,
  earningsCropSummarySchema,
  earningsDataSchema,
  earningsRecentPayoutSchema,
  earningsResponseSchema,
  farmerOrderCardSchema,
  farmerOrderDetailSchema,
  fulfilmentMethodSchema,
  markDeliveredRequestSchema,
  markPaidRequestSchema,
  maskedCounterpartySchema,
  minimalOrderSchema,
  orderActionSchema,
  orderDisputeSchema,
  orderFulfilmentSchema,
  orderListQuerySchema,
  orderPaymentSchema,
  orderStatusSchema,
  orderTimelineEntrySchema,
  paymentMethodSchema,
  paymentStatusSchema,
  revealedCounterpartySchema,
  saleItemSchema,
  salesQuerySchema,
  salesResponseSchema,
} from "./orders.js";

describe("orderStatusSchema without IN_TRANSIT", () => {
  it("accepts all 6 valid statuses", () => {
    const validStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.DISPUTED,
    ];
    for (const status of validStatuses) {
      expect(orderStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("strictly rejects IN_TRANSIT", () => {
    expect(orderStatusSchema.safeParse("IN_TRANSIT").success).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(orderStatusSchema.safeParse("SHIPPED").success).toBe(false);
  });
});

describe("Payment and Fulfilment schemas", () => {
  it("validates paymentStatusSchema and paymentMethodSchema", () => {
    expect(paymentStatusSchema.safeParse(PaymentStatus.UNPAID).success).toBe(true);
    expect(paymentStatusSchema.safeParse(PaymentStatus.PAID).success).toBe(true);
    expect(paymentStatusSchema.safeParse(PaymentStatus.REFUNDED).success).toBe(true);
    expect(paymentStatusSchema.safeParse("PENDING").success).toBe(false);

    expect(paymentMethodSchema.safeParse(PaymentMethod.COD).success).toBe(true);
    expect(paymentMethodSchema.safeParse(PaymentMethod.WALLET_SIM).success).toBe(true);
    expect(paymentMethodSchema.safeParse("BKASH").success).toBe(false);
  });

  it("validates fulfilmentMethodSchema", () => {
    expect(fulfilmentMethodSchema.safeParse(FulfilmentMethod.PICKUP).success).toBe(true);
    expect(fulfilmentMethodSchema.safeParse(FulfilmentMethod.BUYER_ARRANGED).success).toBe(true);
    expect(fulfilmentMethodSchema.safeParse("COURIER").success).toBe(false);
  });

  it("validates orderActionSchema", () => {
    const actions = [
      OrderAction.CONFIRM,
      OrderAction.MARK_PAID,
      OrderAction.MARK_DELIVERED,
      OrderAction.COMPLETE,
      OrderAction.DISPUTE,
      OrderAction.CANCEL,
    ];
    for (const action of actions) {
      expect(orderActionSchema.safeParse(action).success).toBe(true);
    }
  });

  it("validates orderPaymentSchema", () => {
    const validPayment = {
      status: PaymentStatus.PAID,
      method: PaymentMethod.WALLET_SIM,
      paidAt: "2026-11-16T12:00:00.000Z",
    };
    expect(orderPaymentSchema.safeParse(validPayment).success).toBe(true);
    expect(orderPaymentSchema.safeParse({ status: PaymentStatus.UNPAID }).success).toBe(true);
  });

  it("validates orderFulfilmentSchema", () => {
    const validFulfilment = {
      method: FulfilmentMethod.PICKUP,
      note: "Pickup at farm gate",
      handoverAt: "2026-11-17T10:00:00.000Z",
    };
    expect(orderFulfilmentSchema.safeParse(validFulfilment).success).toBe(true);
    // note > 200 chars fails
    expect(orderFulfilmentSchema.safeParse({ ...validFulfilment, note: "x".repeat(201) }).success).toBe(false);
  });

  it("validates orderDisputeSchema", () => {
    const validDispute = {
      reason: OrderDisputeReason.GRADE_MISMATCH,
      note: "Produce received was Grade B instead of A",
      raisedAt: "2026-11-16T14:00:00.000Z",
    };
    expect(orderDisputeSchema.safeParse(validDispute).success).toBe(true);
    expect(orderDisputeSchema.safeParse({ ...validDispute, reason: "INVALID_REASON" }).success).toBe(false);
  });

  it("validates orderTimelineEntrySchema", () => {
    const validEntry = {
      status: OrderStatus.CONFIRMED,
      at: "2026-11-16T12:00:00.000Z",
      byUserId: "651234567890abcdef123456",
      note: "Confirmed by farmer",
    };
    expect(orderTimelineEntrySchema.safeParse(validEntry).success).toBe(true);
  });
});

describe("Counterparty schemas (masked vs revealed)", () => {
  const maskedBuyer = {
    id: "651234567890abcdef123456",
    name: "Buyer #1",
    role: UserRole.BUYER,
    isMasked: true,
    division: "Dhaka",
    district: "Dhaka",
  };

  const revealedBuyer = {
    id: "651234567890abcdef123456",
    name: "Karim Traders",
    role: UserRole.BUYER,
    phone: "01712345678",
    organizationName: "Karim Agro",
    location: {
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Dhanmondi",
      address: "House 12, Road 5",
    },
    isMasked: false,
  };

  it("validates masked counterparty", () => {
    expect(maskedCounterpartySchema.safeParse(maskedBuyer).success).toBe(true);
    expect(counterpartySchema.safeParse(maskedBuyer).success).toBe(true);
  });

  it("validates revealed counterparty with phone and location", () => {
    expect(revealedCounterpartySchema.safeParse(revealedBuyer).success).toBe(true);
    expect(counterpartySchema.safeParse(revealedBuyer).success).toBe(true);
  });

  it("rejects invalid counterparty", () => {
    expect(counterpartySchema.safeParse({ id: "123", name: "Incomplete" }).success).toBe(false);
  });
});

describe("Order Card and Detail DTOs", () => {
  const baseCard = {
    id: "651234567890abcdef123450",
    listingId: "651234567890abcdef123451",
    cropId: "651234567890abcdef123452",
    cropName: "Onion",
    cropNameBn: "পেঁয়াজ",
    imageUrl: "https://example.com/onion.jpg",
    grade: CropGrade.A,
    quantityKg: 50.0,
    pricePerKg: 6000,
    subtotal: 300000,
    platformFee: 6000,
    farmerNet: 294000,
    status: OrderStatus.PENDING,
    payment: { status: PaymentStatus.UNPAID },
    fulfilment: { method: FulfilmentMethod.PICKUP },
    createdAt: "2026-11-16T10:00:00.000Z",
  };

  const maskedCounterparty = {
    id: "651234567890abcdef123453",
    name: "Buyer #1",
    role: UserRole.BUYER,
    isMasked: true,
  };

  const revealedCounterparty = {
    id: "651234567890abcdef123454",
    name: "Rahim Uddin",
    role: UserRole.FARMER,
    phone: "01700000001",
    isMasked: false,
  };

  it("validates farmerOrderCardSchema with buyer counterparty", () => {
    const card = {
      ...baseCard,
      buyer: maskedCounterparty,
    };
    expect(farmerOrderCardSchema.safeParse(card).success).toBe(true);
  });

  it("validates buyerOrderCardSchema with farmer counterparty and totalAmount", () => {
    const card = {
      ...baseCard,
      totalAmount: 300000,
      farmer: revealedCounterparty,
    };
    expect(buyerOrderCardSchema.safeParse(card).success).toBe(true);
  });

  it("validates farmerOrderDetailSchema with timeline and available actions", () => {
    const detail = {
      ...baseCard,
      buyer: maskedCounterparty,
      timeline: [
        {
          status: OrderStatus.PENDING,
          at: "2026-11-16T10:00:00.000Z",
          note: "Order created from auction",
        },
      ],
      availableActions: [OrderAction.CONFIRM, OrderAction.CANCEL],
      listingSummary: {
        id: "651234567890abcdef123451",
        title: "Fresh Savar Onions",
        division: "Dhaka",
        district: "Dhaka",
      },
    };
    expect(farmerOrderDetailSchema.safeParse(detail).success).toBe(true);
  });

  it("validates buyerOrderDetailSchema", () => {
    const detail = {
      ...baseCard,
      totalAmount: 300000,
      farmer: revealedCounterparty,
      timeline: [
        {
          status: OrderStatus.PENDING,
          at: "2026-11-16T10:00:00.000Z",
        },
      ],
      availableActions: [OrderAction.MARK_PAID, OrderAction.CANCEL],
    };
    expect(buyerOrderDetailSchema.safeParse(detail).success).toBe(true);
  });
});

describe("Action request schemas", () => {
  it("validates confirmOrderRequestSchema", () => {
    const valid = {
      handoverAt: "2026-11-17T10:00:00.000Z",
      note: "Ready tomorrow morning at warehouse",
      fulfilmentMethod: FulfilmentMethod.PICKUP,
    };
    expect(confirmOrderRequestSchema.safeParse(valid).success).toBe(true);
    expect(confirmOrderRequestSchema.safeParse({ handoverAt: "2026-11-17T10:00:00.000Z" }).success).toBe(true);
    expect(confirmOrderRequestSchema.safeParse({ handoverAt: "not-a-date" }).success).toBe(false);
  });

  it("validates markPaidRequestSchema", () => {
    expect(markPaidRequestSchema.safeParse({ method: PaymentMethod.WALLET_SIM }).success).toBe(true);
    expect(markPaidRequestSchema.safeParse({}).success).toBe(true);
    expect(markPaidRequestSchema.safeParse({ method: "INVALID" }).success).toBe(false);
  });

  it("validates markDeliveredRequestSchema", () => {
    expect(markDeliveredRequestSchema.safeParse({ note: "Handed over to buyer transport" }).success).toBe(true);
    expect(markDeliveredRequestSchema.safeParse({}).success).toBe(true);
    expect(markDeliveredRequestSchema.safeParse({ note: "x".repeat(201) }).success).toBe(false);
  });

  it("validates completeOrderRequestSchema", () => {
    expect(completeOrderRequestSchema.safeParse({ note: "Produce received in good quality" }).success).toBe(true);
    expect(completeOrderRequestSchema.safeParse({}).success).toBe(true);
  });

  it("validates disputeOrderRequestSchema", () => {
    expect(
      disputeOrderRequestSchema.safeParse({
        reason: OrderDisputeReason.QUANTITY_SHORT,
        note: "Scale showed 45kg instead of 50kg",
      }).success
    ).toBe(true);
    expect(
      disputeOrderRequestSchema.safeParse({
        reason: OrderDisputeReason.GRADE_LOWER_THAN_LISTED,
      }).success
    ).toBe(true);
    expect(disputeOrderRequestSchema.safeParse({ reason: "NOT_A_REASON" }).success).toBe(false);
    expect(
      disputeOrderRequestSchema.safeParse({
        reason: OrderDisputeReason.QUANTITY_SHORT,
        note: "a".repeat(201),
      }).success
    ).toBe(false);
  });

  it("validates cancelOrderRequestSchema", () => {
    expect(
      cancelOrderRequestSchema.safeParse({
        reason: "BUYER_CANNOT_COLLECT",
        note: "Transport vehicle broke down",
      }).success
    ).toBe(true);
    expect(cancelOrderRequestSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("validates orderListQuerySchema", () => {
    const parsed = orderListQuerySchema.parse({ status: OrderStatus.CONFIRMED, page: "2", limit: "15" });
    expect(parsed).toEqual({
      status: OrderStatus.CONFIRMED,
      page: 2,
      limit: 15,
    });
    // Defaults
    expect(orderListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
    // Max limit 50
    expect(orderListQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
});

describe("Sales and Earnings schemas", () => {
  it("validates saleItemSchema and salesResponseSchema", () => {
    const saleItem = {
      id: "651234567890abcdef123450",
      listingId: "651234567890abcdef123451",
      cropId: "651234567890abcdef123452",
      cropName: "Green Chilli",
      cropNameBn: "কাঁচা মরিচ",
      grade: CropGrade.A,
      quantityKg: 20.0,
      pricePerKg: 15000,
      expectedPricePerKg: 14000,
      subtotal: 300000,
      platformFee: 6000,
      farmerNet: 294000,
      pricePremiumPercent: 7.1,
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.WALLET_SIM,
      buyerName: "Karim Traders",
      buyerRegion: "Dhaka",
      buyerDivision: "Dhaka",
      date: "2026-11-16T10:00:00.000Z",
      soldAt: "2026-11-15T10:00:00.000Z",
      completedAt: "2026-11-16T10:00:00.000Z",
    };
    expect(saleItemSchema.safeParse(saleItem).success).toBe(true);

    const salesResponse = {
      data: [saleItem],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        serverTime: "2026-11-16T12:00:00.000Z",
        totals: {
          totalQuantityKg: 20.0,
          totalSubtotal: 300000,
          totalPlatformFee: 6000,
          totalFarmerNet: 294000,
        },
      },
    };
    expect(salesResponseSchema.safeParse(salesResponse).success).toBe(true);
    expect(salesQuerySchema.parse({ page: "1", limit: "10", buyerDivision: "Dhaka" })).toEqual({
      page: 1,
      limit: 10,
      buyerDivision: "Dhaka",
    });
  });

  it("validates earningsDataSchema and earningsResponseSchema", () => {
    const earningsData = {
      summary: {
        gross: 600000,
        fees: 12000,
        settledNet: 588000,
        expectedNet: 0,
        totalEarnings: 588000,
        totalSubtotal: 600000,
        totalPlatformFees: 12000,
        completedOrdersCount: 2,
        pendingPayout: 0,
        paidPayout: 588000,
        averagePricePremiumPercent: 8.5,
        feeRateBps: 200,
        feeRatePercent: 2.0,
      },
      byCrop: [
        {
          cropId: "651234567890abcdef123452",
          cropName: "Green Chilli",
          cropNameBn: "কাঁচা মরিচ",
          totalKg: 40.0,
          totalEarnings: 588000,
          averagePricePerKg: 15000,
          orderCount: 2,
          averagePremiumPercent: 8.5,
        },
      ],
      recentPayouts: [
        {
          orderId: "651234567890abcdef123450",
          cropName: "Green Chilli",
          amount: 294000,
          status: PaymentStatus.PAID,
          method: PaymentMethod.WALLET_SIM,
          date: "2026-11-16T10:00:00.000Z",
        },
      ],
      monthlySeries: [
        {
          month: "2026-11",
          year: 2026,
          monthIndex: 11,
          gross: 600000,
          fees: 12000,
          net: 588000,
          orderCount: 2,
          totalKg: 40.0,
        },
      ],
      feeRate: {
        bps: 200,
        percent: 2.0,
      },
    };
    expect(earningsCropSummarySchema.safeParse(earningsData.byCrop[0]).success).toBe(true);
    expect(earningsRecentPayoutSchema.safeParse(earningsData.recentPayouts[0]).success).toBe(true);
    expect(earningsDataSchema.safeParse(earningsData).success).toBe(true);

    const earningsResponse = {
      data: earningsData,
      meta: {
        serverTime: "2026-11-16T12:00:00.000Z",
      },
    };
    expect(earningsResponseSchema.safeParse(earningsResponse).success).toBe(true);
  });
});

describe("minimalOrderSchema", () => {
  const validOrder = {
    id: "651234567890abcdef123456",
    listingId: "651234567890abcdef123457",
    farmerId: "651234567890abcdef123458",
    buyerId: "651234567890abcdef123459",
    cropId: "651234567890abcdef12345a",
    quantityKg: 20.5,
    grade: CropGrade.A,
    pricePerKg: 5000,
    subtotal: 102500,
    platformFee: 2050,
    farmerNet: 100450,
    status: OrderStatus.PENDING,
    payment: {
      status: PaymentStatus.UNPAID,
    },
    createdAt: "2026-11-14T10:00:00.000Z",
  };

  it("accepts a valid minimal order document", () => {
    const result = minimalOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects when platformFee + farmerNet !== subtotal", () => {
    const invalid = {
      ...validOrder,
      farmerNet: 100000, // missing 450 poisha
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer poisha amounts", () => {
    const invalid = {
      ...validOrder,
      subtotal: 102500.5,
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects IN_TRANSIT status", () => {
    const invalid = {
      ...validOrder,
      status: "IN_TRANSIT",
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const invalid = {
      ...validOrder,
      status: "INVALID_STATUS",
    };
    const result = minimalOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
