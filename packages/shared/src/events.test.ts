import { describe, expect, it } from "vitest";
import { DomainEventName, ListingStatus } from "./enums.js";
import {
  auctionClosedEventPayloadSchema,
  auctionExtendedEventPayloadSchema,
  bidPlacedEventPayloadSchema,
  orderCreatedEventPayloadSchema,
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
  });
});

