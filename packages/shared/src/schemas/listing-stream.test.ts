import { describe, expect, it } from "vitest";
import { ListingStatus } from "../enums.js";
import {
  ListingStreamEventName,
  listingStreamAuctionClosedPatchSchema,
  listingStreamAuctionExtendedPatchSchema,
  listingStreamBidPlacedPatchSchema,
  listingStreamSnapshotSchema,
} from "./listing-stream.js";

describe("Listing Stream Schemas (Task 4.7 contracts)", () => {
  const validId = "507f1f77bcf86cd799439011";
  const validIso = "2026-11-14T12:00:00.000Z";

  it("validates a valid snapshot schema with and without active bids", () => {
    const openingSnapshot = {
      listingId: validId,
      currentPrice: 5000,
      currentBidPerKg: null,
      floorPricePerKg: 5000,
      bidCount: 0,
      endTime: validIso,
      endsAt: validIso,
      status: ListingStatus.ACTIVE,
      serverTime: validIso,
    };
    expect(listingStreamSnapshotSchema.parse(openingSnapshot)).toEqual(openingSnapshot);

    const activeSnapshot = {
      ...openingSnapshot,
      currentPrice: 5500,
      currentBidPerKg: 5500,
      bidCount: 1,
    };
    expect(listingStreamSnapshotSchema.parse(activeSnapshot)).toEqual(activeSnapshot);
  });

  it("validates bid.placed state patch and rejects extraneous buyerId", () => {
    const validPatch = {
      listingId: validId,
      bidId: validId,
      bidderLabel: "Buyer #1",
      currentPrice: 6000,
      currentBidPerKg: 6000,
      amountPerKg: 6000,
      totalAmount: 300000,
      bidCount: 2,
      placedAt: validIso,
      serverTime: validIso,
    };
    expect(listingStreamBidPlacedPatchSchema.parse(validPatch)).toEqual(validPatch);

    // Strict schema rejects leakage of buyerId and previousBidderId
    expect(() =>
      listingStreamBidPlacedPatchSchema.parse({
        ...validPatch,
        buyerId: "507f1f77bcf86cd799439012",
      }),
    ).toThrow();

    expect(() =>
      listingStreamBidPlacedPatchSchema.parse({
        ...validPatch,
        previousBidderId: "507f1f77bcf86cd799439014",
      }),
    ).toThrow();
  });

  it("validates auction.extended state patch", () => {
    const validPatch = {
      listingId: validId,
      endsAt: validIso,
      endTime: validIso,
      extensionCount: 1,
      extendedAt: validIso,
      serverTime: validIso,
    };
    expect(listingStreamAuctionExtendedPatchSchema.parse(validPatch)).toEqual(validPatch);
  });

  it("validates auction.closed state patch and rejects extraneous winningBidderId", () => {
    const soldPatch = {
      listingId: validId,
      status: ListingStatus.SOLD,
      closedAt: validIso,
      winningBidId: validId,
      winningAmountPerKg: 6500,
      totalAmount: 325000,
      serverTime: validIso,
    };
    expect(listingStreamAuctionClosedPatchSchema.parse(soldPatch)).toEqual(soldPatch);

    // Strict schema rejects leakage of winningBidderId
    expect(() =>
      listingStreamAuctionClosedPatchSchema.parse({
        ...soldPatch,
        winningBidderId: "507f1f77bcf86cd799439013",
      }),
    ).toThrow();

    const unsoldPatch = {
      listingId: validId,
      status: ListingStatus.EXPIRED_UNSOLD,
      closedAt: validIso,
      serverTime: validIso,
    };
    expect(listingStreamAuctionClosedPatchSchema.parse(unsoldPatch)).toEqual(unsoldPatch);
  });

  it("exports correct ListingStreamEventName constants", () => {
    expect(ListingStreamEventName.SNAPSHOT).toBe("snapshot");
    expect(ListingStreamEventName.BID_PLACED).toBe("bid.placed");
    expect(ListingStreamEventName.AUCTION_EXTENDED).toBe("auction.extended");
    expect(ListingStreamEventName.AUCTION_CLOSED).toBe("auction.closed");
  });
});
