import { describe, expect, it } from "vitest";

import { BuyerListingStatus, deriveBuyerListingStatus } from "./buyer-status.js";
import { ListingStatus } from "./enums.js";

describe("deriveBuyerListingStatus", () => {
  const buyerId = "buyer-123";
  const otherBuyerId = "buyer-456";

  it("derives NONE when the buyer has placed no bids, regardless of auction status", () => {
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.ACTIVE,
        currentBidderId: otherBuyerId,
        buyerId,
        hasBids: false,
      }),
    ).toBe(BuyerListingStatus.NONE);

    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.SOLD,
        currentBidderId: otherBuyerId,
        buyerId,
        hasBids: false,
      }),
    ).toBe(BuyerListingStatus.NONE);
  });

  it("derives WINNING when listing is ACTIVE and buyer is current highest bidder", () => {
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.ACTIVE,
        currentBidderId: buyerId,
        buyerId,
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.WINNING);

    // Case insensitive matching
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.ACTIVE,
        currentBidderId: buyerId.toUpperCase(),
        buyerId: buyerId.toLowerCase(),
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.WINNING);
  });

  it("derives OUTBID when listing is ACTIVE and buyer has bid but is not highest bidder", () => {
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.ACTIVE,
        currentBidderId: otherBuyerId,
        buyerId,
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.OUTBID);
  });

  it("derives WON when listing is SOLD and buyer is the winning bidder", () => {
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.SOLD,
        currentBidderId: buyerId,
        buyerId,
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.WON);
  });

  it("derives LOST when listing is SOLD and another buyer won", () => {
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.SOLD,
        currentBidderId: otherBuyerId,
        buyerId,
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.LOST);
  });

  it("derives LOST when listing ended with EXPIRED_UNSOLD or CANCELLED for a bidder", () => {
    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.EXPIRED_UNSOLD,
        currentBidderId: null,
        buyerId,
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.LOST);

    expect(
      deriveBuyerListingStatus({
        listingStatus: ListingStatus.CANCELLED,
        currentBidderId: null,
        buyerId,
        hasBids: true,
      }),
    ).toBe(BuyerListingStatus.LOST);
  });
});
