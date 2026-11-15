import { describe, expect, it } from "vitest";

import { CropGrade, ListingStatus, MarketplaceSort } from "../enums.js";
import {
  type CompareListing,
  buyerListingCardSchema,
  buyerListingDetailSchema,
  comparePayloadSchema,
  marketplaceListingListResponseSchema,
  marketplaceQuerySchema,
} from "./marketplace.js";

describe("Marketplace schemas", () => {
  describe("marketplaceQuerySchema", () => {
    it("applies default values for pagination, sort, and status", () => {
      const parsed = marketplaceQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sort).toBe(MarketplaceSort.ENDING_SOONEST);
      expect(parsed.status).toBe(ListingStatus.ACTIVE);
    });

    it("accepts valid Bangladesh division and district combinations", () => {
      const parsed = marketplaceQuerySchema.safeParse({
        division: "dhaka",
        district: "gazipur",
        grade: "A",
        minPrice: "2000",
        maxPrice: "5000",
        minQty: "50",
        endingWithin: "6",
        sort: MarketplaceSort.LOWEST_PRICE,
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.division).toBe("dhaka");
        expect(parsed.data.district).toBe("gazipur");
        expect(parsed.data.minPrice).toBe(2000);
        expect(parsed.data.maxPrice).toBe(5000);
        expect(parsed.data.minQty).toBe(50);
        expect(parsed.data.endingWithin).toBe(6);
        expect(parsed.data.sort).toBe(MarketplaceSort.LOWEST_PRICE);
      }
    });

    it("accepts division and district by English name case-insensitively", () => {
      const parsed = marketplaceQuerySchema.safeParse({
        division: "Chattogram",
        district: "Cox's Bazar",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects unknown division or district", () => {
      expect(marketplaceQuerySchema.safeParse({ division: "atlantis" }).success).toBe(false);
      expect(marketplaceQuerySchema.safeParse({ district: "gotham" }).success).toBe(false);
    });

    it("rejects district that does not belong to specified division", () => {
      // bogura belongs to rajshahi, not dhaka
      const result = marketplaceQuerySchema.safeParse({
        division: "dhaka",
        district: "bogura",
      });
      expect(result.success).toBe(false);
    });

    it("rejects maxPrice less than minPrice", () => {
      const result = marketplaceQuerySchema.safeParse({
        minPrice: 5000,
        maxPrice: 4000,
      });
      expect(result.success).toBe(false);
    });

    it("accepts status ACTIVE and rejects any other status for buyers", () => {
      expect(marketplaceQuerySchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
      expect(marketplaceQuerySchema.safeParse({ status: "SOLD" }).success).toBe(false);
      expect(marketplaceQuerySchema.safeParse({ status: "CANCELLED" }).success).toBe(false);
      expect(marketplaceQuerySchema.safeParse({ status: "EXPIRED_UNSOLD" }).success).toBe(false);
    });

    it("accepts valid endingWithin presets (1, 3, 6, 24) and rejects others", () => {
      for (const preset of [1, 3, 6, 24]) {
        expect(marketplaceQuerySchema.safeParse({ endingWithin: preset }).success).toBe(true);
      }
      expect(marketplaceQuerySchema.safeParse({ endingWithin: 5 }).success).toBe(false);
      expect(marketplaceQuerySchema.safeParse({ endingWithin: 12 }).success).toBe(false);
    });

    it("accepts all valid sort values and rejects invalid ones", () => {
      for (const sortVal of [
        MarketplaceSort.ENDING_SOONEST,
        MarketplaceSort.LOWEST_PRICE,
        MarketplaceSort.HIGHEST_GRADE,
        MarketplaceSort.NEWEST,
      ]) {
        expect(marketplaceQuerySchema.safeParse({ sort: sortVal }).success).toBe(true);
      }
      expect(marketplaceQuerySchema.safeParse({ sort: "unsupported" }).success).toBe(false);
    });
  });

  describe("buyerListingCardSchema & marketplaceListingListResponseSchema", () => {
    it("validates a buyer listing card and listing list response", () => {
      const card = {
        id: "507f1f77bcf86cd799439011",
        cropId: "507f1f77bcf86cd799439012",
        crop: {
          id: "507f1f77bcf86cd799439012",
          slug: "onion",
          nameEn: "Onion",
          nameBn: "পেঁয়াজ",
          unit: "kg",
        },
        grade: CropGrade.A,
        quantityKg: 100,
        floorPricePerKg: 4000,
        currentBidPerKg: 4500,
        displayPricePerKg: 4500,
        totalDisplayCost: 450000,
        minIncrementPerKg: 100,
        bidCount: 3,
        startsAt: "2026-11-14T10:00:00.000Z",
        endsAt: "2026-11-14T16:00:00.000Z",
        status: ListingStatus.ACTIVE,
        location: {
          division: "Dhaka",
          district: "Gazipur",
        },
        thumbnailUrl: "/uploads/onion.jpg",
        aiExpectedPricePerKg: 5000,
      };

      const cardResult = buyerListingCardSchema.safeParse(card);
      expect(cardResult.success).toBe(true);

      const listResult = marketplaceListingListResponseSchema.safeParse({
        data: [card],
        meta: {
          serverTime: "2026-11-14T12:00:00.000Z",
          page: 1,
          limit: 20,
          total: 1,
        },
      });
      expect(listResult.success).toBe(true);
    });
  });

  describe("buyerListingDetailSchema", () => {
    it("validates buyer listing detail with AI guidance, snapshot, and buyer status", () => {
      const detail = {
        id: "507f1f77bcf86cd799439011",
        cropId: "507f1f77bcf86cd799439012",
        crop: {
          id: "507f1f77bcf86cd799439012",
          slug: "onion",
          nameEn: "Onion",
          nameBn: "পেঁয়াজ",
          unit: "kg",
          minIncrementPerKg: 100,
        },
        grade: CropGrade.A,
        confidenceBand: "HIGH" as const,
        reasons: ["Firm skin", "Uniform size"],
        aiPriceSnapshot: {
          lowPerKg: 4000,
          expectedPerKg: 5000,
          highPerKg: 6000,
          trend: "UP" as const,
        },
        provider: "mock" as const,
        degraded: false,
        quantityKg: 100,
        images: [{ url: "/uploads/img1.jpg", width: 800, height: 600 }],
        aiAssessment: {
          grade: CropGrade.A,
          confidence: 0.95,
          confidenceBand: "HIGH" as const,
          classProbabilities: { A: 0.95, B: 0.04, C: 0.01 },
          qualityNotes: ["Firm skin", "Uniform size"],
          cropMatch: true,
          modelVersion: "mock-v1",
          provider: "mock" as const,
          degraded: false,
          assessedAt: "2026-11-14T09:00:00.000Z",
        },
        aiPriceGuidance: {
          lowPerKg: 4000,
          expectedPerKg: 5000,
          highPerKg: 6000,
          trend: "UP" as const,
          confidence: 0.9,
          explanation: ["High demand"],
          modelVersion: "mock-v1",
          provider: "mock" as const,
          degraded: false,
          generatedAt: "2026-11-14T09:00:00.000Z",
          suggestedFloorPerKg: 4200,
        },
        floorPricePerKg: 4200,
        minIncrementPerKg: 100,
        currentBidPerKg: 4500,
        displayPricePerKg: 4500,
        displayTotalCost: 450000,
        bidCount: 2,
        startsAt: "2026-11-14T10:00:00.000Z",
        endsAt: "2026-11-14T16:00:00.000Z",
        originalEndsAt: "2026-11-14T16:00:00.000Z",
        extensionCount: 0,
        status: ListingStatus.ACTIVE,
        location: { division: "Dhaka", district: "Gazipur" },
        myStatus: "WINNING" as const,
        myHighestBidPerKg: 4500,
        createdAt: "2026-11-14T09:30:00.000Z",
      };

      const result = buyerListingDetailSchema.safeParse(detail);
      expect(result.success).toBe(true);
    });

    it("rejects buyer listing detail if pickupNote is included (strict privacy)", () => {
      const detail = {
        id: "507f1f77bcf86cd799439011",
        cropId: "507f1f77bcf86cd799439012",
        crop: {
          id: "507f1f77bcf86cd799439012",
          slug: "onion",
          nameEn: "Onion",
          nameBn: "পেঁয়াজ",
          unit: "kg",
          minIncrementPerKg: 100,
        },
        grade: CropGrade.A,
        confidenceBand: "HIGH" as const,
        reasons: ["Firm skin"],
        aiPriceSnapshot: {
          lowPerKg: 4000,
          expectedPerKg: 5000,
          highPerKg: 6000,
          trend: "UP" as const,
        },
        provider: "mock" as const,
        degraded: false,
        quantityKg: 100,
        images: [{ url: "/uploads/img1.jpg", width: 800, height: 600 }],
        floorPricePerKg: 4200,
        minIncrementPerKg: 100,
        currentBidPerKg: null,
        displayPricePerKg: 4200,
        displayTotalCost: 420000,
        bidCount: 0,
        startsAt: "2026-11-14T10:00:00.000Z",
        endsAt: "2026-11-14T16:00:00.000Z",
        extensionCount: 0,
        status: ListingStatus.ACTIVE,
        location: { division: "Dhaka", district: "Gazipur" },
        myStatus: "NONE" as const,
        myHighestBidPerKg: null,
        createdAt: "2026-11-14T09:30:00.000Z",
        pickupNote: "Call me behind the school",
      };

      const result = buyerListingDetailSchema.safeParse(detail);
      expect(result.success).toBe(false);
    });
  });

  describe("comparePayloadSchema", () => {
    it("validates compare payload with listings and computed highlights", () => {
      const compareItem = {
        id: "507f1f77bcf86cd799439011",
        cropId: "507f1f77bcf86cd799439012",
        cropNameEn: "Onion",
        cropNameBn: "পেঁয়াজ",
        grade: CropGrade.A,
        quantityKg: 100,
        floorPricePerKg: 4000,
        currentBidPerKg: 4500,
        displayPricePerKg: 4500,
        displayTotalCost: 450000,
        minIncrementPerKg: 100,
        bidCount: 2,
        startsAt: "2026-11-14T10:00:00.000Z",
        endsAt: "2026-11-14T16:00:00.000Z",
        status: ListingStatus.ACTIVE,
        location: { division: "Dhaka", district: "Gazipur" },
      };

      const payload = {
        cropId: "507f1f77bcf86cd799439012",
        listings: [compareItem],
        highlights: {
          lowestPriceListingIds: ["507f1f77bcf86cd799439011"],
          bestGradeListingIds: ["507f1f77bcf86cd799439011"],
          largestQuantityListingIds: ["507f1f77bcf86cd799439011"],
          bestValueListingIds: ["507f1f77bcf86cd799439011"],
          byListingId: {
            "507f1f77bcf86cd799439011": {
              isLowestPrice: true,
              isBestGrade: true,
              isLargestQuantity: true,
              isBestValue: true,
            },
          },
        },
      };

      const result = comparePayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects compare payload with more than 4 listings", () => {
      const makeItem = (id: string): CompareListing => ({
        id,
        cropId: "507f1f77bcf86cd799439012",
        cropNameEn: "Onion",
        cropNameBn: "পেঁয়াজ",
        grade: CropGrade.A,
        quantityKg: 100,
        floorPricePerKg: 4000,
        displayPricePerKg: 4000,
        displayTotalCost: 400000,
        minIncrementPerKg: 100,
        bidCount: 0,
        startsAt: "2026-11-14T10:00:00.000Z",
        endsAt: "2026-11-14T16:00:00.000Z",
        status: ListingStatus.ACTIVE,
        location: { division: "Dhaka", district: "Gazipur" },
      });

      const payload = {
        cropId: "507f1f77bcf86cd799439012",
        listings: [
          makeItem("507f1f77bcf86cd799439011"),
          makeItem("507f1f77bcf86cd799439012"),
          makeItem("507f1f77bcf86cd799439013"),
          makeItem("507f1f77bcf86cd799439014"),
          makeItem("507f1f77bcf86cd799439015"), // 5th item exceeds max 4
        ],
        highlights: {
          lowestPriceListingIds: [],
          bestGradeListingIds: [],
          largestQuantityListingIds: [],
          bestValueListingIds: [],
          byListingId: {},
        },
      };

      expect(comparePayloadSchema.safeParse(payload).success).toBe(false);
    });
  });
});
