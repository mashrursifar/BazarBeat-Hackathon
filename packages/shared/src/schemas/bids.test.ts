import { describe, expect, it } from "vitest";
import { BidStatus } from "../enums.js";
import {
  anonymizedBidHistoryItemSchema,
  anonymizedBidHistoryResponseSchema,
  bidItemSchema,
  bidResponseSchema,
  placeBidRequestSchema,
} from "./bids.js";

describe("Bid schemas", () => {
  describe("placeBidRequestSchema", () => {
    it("accepts a positive integer in poisha", () => {
      const result = placeBidRequestSchema.safeParse({ amountPerKg: 6500 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountPerKg).toBe(6500);
      }
    });

    it("rejects zero or negative amounts", () => {
      expect(placeBidRequestSchema.safeParse({ amountPerKg: 0 }).success).toBe(false);
      expect(placeBidRequestSchema.safeParse({ amountPerKg: -100 }).success).toBe(false);
    });

    it("rejects non-integer floating point amounts", () => {
      expect(placeBidRequestSchema.safeParse({ amountPerKg: 65.5 }).success).toBe(false);
    });

    it("rejects missing or non-number inputs", () => {
      expect(placeBidRequestSchema.safeParse({}).success).toBe(false);
      expect(placeBidRequestSchema.safeParse({ amountPerKg: "6500" }).success).toBe(false);
    });
  });

  describe("bidItemSchema & bidResponseSchema", () => {
    it("validates a complete bid item and response envelope", () => {
      const validBid = {
        id: "bid-123",
        listingId: "listing-456",
        buyerId: "buyer-789",
        amountPerKg: 6500,
        totalAmount: 650000,
        status: BidStatus.ACCEPTED,
        placedAt: "2026-11-14T10:00:00.000Z",
      };

      const itemResult = bidItemSchema.safeParse(validBid);
      expect(itemResult.success).toBe(true);

      const envelopeResult = bidResponseSchema.safeParse({
        data: validBid,
        meta: { serverTime: "2026-11-14T10:00:01.000Z" },
      });
      expect(envelopeResult.success).toBe(true);
    });

    it("accepts all valid BidStatus values", () => {
      for (const status of [BidStatus.ACCEPTED, BidStatus.WON, BidStatus.LOST]) {
        const result = bidItemSchema.safeParse({
          id: "bid-1",
          listingId: "listing-1",
          buyerId: "buyer-1",
          amountPerKg: 5000,
          totalAmount: 500000,
          status,
          placedAt: "2026-11-14T10:00:00.000Z",
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects unrecognized status values", () => {
      const result = bidItemSchema.safeParse({
        id: "bid-1",
        listingId: "listing-1",
        buyerId: "buyer-1",
        amountPerKg: 5000,
        totalAmount: 500000,
        status: "PENDING",
        placedAt: "2026-11-14T10:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("anonymizedBidHistoryItemSchema & anonymizedBidHistoryResponseSchema", () => {
    it("validates an anonymized bid history item without exposing buyer identity", () => {
      const validItem = {
        id: "bid-101",
        listingId: "listing-202",
        amountPerKg: 6200,
        totalAmount: 620000,
        bidderLabel: "Buyer #1",
        placedAt: "2026-11-14T10:05:00.000Z",
        isMyBid: true,
      };

      const itemResult = anonymizedBidHistoryItemSchema.safeParse(validItem);
      expect(itemResult.success).toBe(true);

      const listResult = anonymizedBidHistoryResponseSchema.safeParse({
        data: [validItem],
        meta: { serverTime: "2026-11-14T10:06:00.000Z" },
      });
      expect(listResult.success).toBe(true);
    });

    it("rejects invalid date formats in bid history", () => {
      const result = anonymizedBidHistoryItemSchema.safeParse({
        id: "bid-101",
        listingId: "listing-202",
        amountPerKg: 6200,
        totalAmount: 620000,
        bidderLabel: "Buyer #1",
        placedAt: "not-a-date",
      });
      expect(result.success).toBe(false);
    });
  });
});

