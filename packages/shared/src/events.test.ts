import { describe, expect, it } from "vitest";
import { DomainEventName, ListingStatus, PaymentMethod } from "./enums.js";
import {
  auctionClosedEventPayloadSchema,
  auctionExtendedEventPayloadSchema,
  bidPlacedEventPayloadSchema,
  orderCancelledEventPayloadSchema,
  orderCompletedEventPayloadSchema,
  orderConfirmedEventPayloadSchema,
  orderCreatedEventPayloadSchema,
  orderDeliveredEventPayloadSchema,
  orderDisputedEventPayloadSchema,
  paymentPaidEventPayloadSchema,
} from "./events.js";

describe("Domain event schemas", () => {
  it("validates bid.placed payload", () => {
    const payload = {
      listingId: "listing-1",
      bidId: "bid-1",
      buyerId: "buyer-1",
      bidderLabel: "Buyer #1",
      amountPerKg: 7500,
      totalAmount: 750000,
      bidCount: 3,
      currentBidPerKg: 7500,
      placedAt: "2026-11-14T10:00:00.000Z",
    };
    const result = bidPlacedEventPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("validates auction.extended payload", () => {
    const payload = {
      listingId: "listing-1",
      endsAt: "2026-11-14T10:02:00.000Z",
      extensionCount: 1,
      extendedAt: "2026-11-14T10:00:00.000Z",
    };
    const result = auctionExtendedEventPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("validates auction.closed payload for SOLD and EXPIRED_UNSOLD", () => {
    const soldPayload = {
      listingId: "listing-1",
      status: ListingStatus.SOLD,
      closedAt: "2026-11-14T10:10:00.000Z",
      winningBidId: "bid-1",
      winningBidderId: "buyer-1",
      winningAmountPerKg: 8000,
      totalAmount: 800000,
    };
    expect(auctionClosedEventPayloadSchema.safeParse(soldPayload).success).toBe(true);

    const expiredPayload = {
      listingId: "listing-2",
      status: ListingStatus.EXPIRED_UNSOLD,
      closedAt: "2026-11-14T10:10:00.000Z",
    };
    expect(auctionClosedEventPayloadSchema.safeParse(expiredPayload).success).toBe(true);
  });

  it("validates order.created payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      cropId: "crop-1",
      quantityKg: 100,
      pricePerKg: 8000,
      totalAmount: 800000,
      platformFee: 0,
      farmerNet: 800000,
      createdAt: "2026-11-14T10:10:00.000Z",
    };
    expect(orderCreatedEventPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("verifies event names match constants", () => {
    expect(DomainEventName.BID_PLACED).toBe("bid.placed");
    expect(DomainEventName.AUCTION_EXTENDED).toBe("auction.extended");
    expect(DomainEventName.AUCTION_CLOSED).toBe("auction.closed");
    expect(DomainEventName.ORDER_CREATED).toBe("order.created");
    expect(DomainEventName.ORDER_CONFIRMED).toBe("order.confirmed");
    expect(DomainEventName.ORDER_DELIVERED).toBe("order.delivered");
    expect(DomainEventName.ORDER_COMPLETED).toBe("order.completed");
    expect(DomainEventName.ORDER_CANCELLED).toBe("order.cancelled");
    expect(DomainEventName.ORDER_DISPUTED).toBe("order.disputed");
    expect(DomainEventName.PAYMENT_PAID).toBe("payment.paid");
    expect(DomainEventName.NOTIFICATION_CREATED).toBe("notification.created");
    expect(DomainEventName.NOTIFICATION_UPDATED).toBe("notification.updated");
  });

  it("validates order.confirmed payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      confirmedAt: "2026-11-16T12:00:00.000Z",
      handoverAt: "2026-11-17T10:00:00.000Z",
      note: "Pickup at depot",
    };
    expect(orderConfirmedEventPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("validates order.delivered payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      deliveredAt: "2026-11-17T11:00:00.000Z",
      note: "Handed over 50kg produce",
    };
    expect(orderDeliveredEventPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("validates order.completed payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      completedAt: "2026-11-17T12:00:00.000Z",
      note: "Confirmed quality and receipt",
    };
    expect(orderCompletedEventPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("validates order.cancelled payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      cancelledBy: "buyer-1",
      reason: "BUYER_CANNOT_COLLECT",
      note: "Transport issue",
      cancelledAt: "2026-11-16T13:00:00.000Z",
      refunded: true,
    };
    expect(orderCancelledEventPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("validates payment.paid payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      buyerId: "buyer-1",
      farmerId: "farmer-1",
      amount: 400000,
      method: PaymentMethod.WALLET_SIM,
      paidAt: "2026-11-16T12:30:00.000Z",
    };
    expect(paymentPaidEventPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("validates order.disputed payload", () => {
    const payload = {
      orderId: "order-1",
      listingId: "listing-1",
      farmerId: "farmer-1",
      buyerId: "buyer-1",
      disputedBy: "buyer-1",
      reason: "GRADE_LOWER_THAN_LISTED",
      note: "Lots of blemishes",
      disputedAt: "2026-11-16T14:00:00.000Z",
    };
    expect(orderDisputedEventPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

