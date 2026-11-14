import { describe, expect, it } from "vitest";
import { BidStatus } from "../enums.js";
import {
  anonymizedBidHistoryItemSchema,
  anonymizedBidHistoryResponseSchema,
  bidItemSchema,
  bidResponseSchema,
  bidTooLowDetailsSchema,
  myBidsResponseSchema,
  myBidsRowSchema,
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

    it("accepts isMine property on anonymized bid history item", () => {
      const validItem = {
        id: "bid-101",
        listingId: "listing-202",
        amountPerKg: 6200,
        totalAmount: 620000,
        bidderLabel: "Buyer #1",
        placedAt: "2026-11-14T10:05:00.000Z",
        isMine: true,
      };
      const result = anonymizedBidHistoryItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isMine).toBe(true);
      }
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

  describe("bidTooLowDetailsSchema", () => {
    it("validates valid BID_TOO_LOW details payload", () => {
      const validWithCurrentBid = {
        minimumRequiredPerKg: 5100,
        currentBidPerKg: 5000,
        floorPricePerKg: 4000,
        minIncrementPerKg: 100,
      };
      const result1 = bidTooLowDetailsSchema.safeParse(validWithCurrentBid);
      expect(result1.success).toBe(true);

      const validWithoutCurrentBid = {
        minimumRequiredPerKg: 4000,
        currentBidPerKg: null,
        floorPricePerKg: 4000,
        minIncrementPerKg: 100,
      };
      const result2 = bidTooLowDetailsSchema.safeParse(validWithoutCurrentBid);
      expect(result2.success).toBe(true);
    });

    it("rejects non-positive minimumRequiredPerKg", () => {
      const invalid = {
        minimumRequiredPerKg: 0,
        currentBidPerKg: null,
        floorPricePerKg: 4000,
        minIncrementPerKg: 100,
      };
      expect(bidTooLowDetailsSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("myBidsRowSchema & myBidsResponseSchema", () => {
    it("validates My Bids row and grouped response envelope", () => {
      const row = {
        bidId: "507f1f77bcf86cd799439011",
        listingId: "507f1f77bcf86cd799439012",
        cropId: "507f1f77bcf86cd799439013",
        cropNameEn: "Onion",
        cropNameBn: "পেঁয়াজ",
        grade: "A" as const,
        quantityKg: 100,
        myBidPerKg: 5500,
        myTotalAmount: 550000,
        currentBidPerKg: 5500,
        currentTotalAmount: 550000,
        bidCount: 4,
        status: "WINNING" as const,
        listingStatus: "ACTIVE" as const,
        endsAt: "2026-11-14T15:00:00.000Z",
        placedAt: "2026-11-14T11:00:00.000Z",
        thumbnailUrl: "/uploads/onion.jpg",
      };

      const rowResult = myBidsRowSchema.safeParse(row);
      expect(rowResult.success).toBe(true);

      const envelopeResult = myBidsResponseSchema.safeParse({
        data: {
          active: [row],
          won: [],
          lost: [],
        },
        meta: {
          serverTime: "2026-11-14T11:05:00.000Z",
        },
      });
      expect(envelopeResult.success).toBe(true);
    });
  });
});

