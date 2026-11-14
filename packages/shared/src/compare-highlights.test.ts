import { describe, expect, it } from "vitest";
import { CropGrade, ListingStatus, MarketplaceErrorCode } from "./enums.js";
import {
  type CompareListingItem,
  CompareMixedCropsError,
  calculateCompareHighlights,
} from "./compare-highlights.js";

describe("calculateCompareHighlights", () => {
  const baseListing = (overrides: Partial<CompareListingItem>): CompareListingItem => ({
    id: "l1",
    cropId: "crop-onion",
    grade: CropGrade.B,
    quantityKg: 100,
    floorPricePerKg: 5000,
    currentBidPerKg: null,
    bidCount: 0,
    status: ListingStatus.ACTIVE,
    aiExpectedPricePerKg: 6000,
    ...overrides,
  });

  it("highlights lowest price, best grade, largest quantity, and best value for single winner", () => {
    const l1 = baseListing({
      id: "l1",
      grade: CropGrade.A, // best grade
      quantityKg: 50,
      floorPricePerKg: 4000, // lowest price
      aiExpectedPricePerKg: 5000, // 4000 / 5000 = 80% (best value)
    });
    const l2 = baseListing({
      id: "l2",
      grade: CropGrade.B,
      quantityKg: 200, // largest quantity
      floorPricePerKg: 4500,
      aiExpectedPricePerKg: 5000, // 4500 / 5000 = 90%
    });

    const result = calculateCompareHighlights([l1, l2]);

    expect(result.lowestPriceListingIds).toEqual(["l1"]);
    expect(result.bestGradeListingIds).toEqual(["l1"]);
    expect(result.largestQuantityListingIds).toEqual(["l2"]);
    expect(result.bestValueListingIds).toEqual(["l1"]);

    expect(result.byListingId["l1"]).toEqual({
      isLowestPrice: true,
      isBestGrade: true,
      isLargestQuantity: false,
      isBestValue: true,
    });
    expect(result.byListingId["l2"]).toEqual({
      isLowestPrice: false,
      isBestGrade: false,
      isLargestQuantity: true,
      isBestValue: false,
    });
  });

  it("handles ties across multiple columns", () => {
    const l1 = baseListing({
      id: "l1",
      grade: CropGrade.A,
      quantityKg: 100,
      floorPricePerKg: 4000,
      aiExpectedPricePerKg: 5000,
    });
    const l2 = baseListing({
      id: "l2",
      grade: CropGrade.A, // tied best grade
      quantityKg: 100, // tied largest quantity
      floorPricePerKg: 4000, // tied lowest price
      aiExpectedPricePerKg: 5000, // tied best value (80%)
    });

    const result = calculateCompareHighlights([l1, l2]);

    expect(result.lowestPriceListingIds).toEqual(["l1", "l2"]);
    expect(result.bestGradeListingIds).toEqual(["l1", "l2"]);
    expect(result.largestQuantityListingIds).toEqual(["l1", "l2"]);
    expect(result.bestValueListingIds).toEqual(["l1", "l2"]);

    expect(result.byListingId["l1"]).toEqual({
      isLowestPrice: true,
      isBestGrade: true,
      isLargestQuantity: true,
      isBestValue: true,
    });
    expect(result.byListingId["l2"]).toEqual({
      isLowestPrice: true,
      isBestGrade: true,
      isLargestQuantity: true,
      isBestValue: true,
    });
  });

  it("uses currentBidPerKg when bids exist and floorPricePerKg when no bids", () => {
    const l1 = baseListing({
      id: "l1",
      floorPricePerKg: 3000,
      currentBidPerKg: 4200,
      bidCount: 2, // has bids -> display price is 4200
    });
    const l2 = baseListing({
      id: "l2",
      floorPricePerKg: 3500,
      currentBidPerKg: null,
      bidCount: 0, // no bids -> display price is 3500 (lowest!)
    });

    const result = calculateCompareHighlights([l1, l2]);
    expect(result.lowestPriceListingIds).toEqual(["l2"]);
  });

  it("evaluates best grade hierarchy (A over B over C)", () => {
    const l1 = baseListing({ id: "l1", grade: CropGrade.B });
    const l2 = baseListing({ id: "l2", grade: CropGrade.C });

    // When only B and C are present, B is best
    const result1 = calculateCompareHighlights([l1, l2]);
    expect(result1.bestGradeListingIds).toEqual(["l1"]);

    // When C is the only grade available, all C get highlighted
    const l3 = baseListing({ id: "l3", grade: CropGrade.C });
    const result2 = calculateCompareHighlights([l2, l3]);
    expect(result2.bestGradeListingIds).toEqual(["l2", "l3"]);
  });

  it("shows ended listings but never highlights them", () => {
    const active = baseListing({
      id: "l-active",
      status: ListingStatus.ACTIVE,
      floorPricePerKg: 5000,
      grade: CropGrade.B,
      quantityKg: 50,
      aiExpectedPricePerKg: 6000,
    });
    const sold = baseListing({
      id: "l-sold",
      status: ListingStatus.SOLD,
      floorPricePerKg: 2000, // lower price, but SOLD!
      grade: CropGrade.A, // better grade, but SOLD!
      quantityKg: 500, // larger quantity, but SOLD!
      aiExpectedPricePerKg: 6000,
    });
    const expired = baseListing({
      id: "l-expired",
      status: ListingStatus.EXPIRED_UNSOLD,
      floorPricePerKg: 1000,
      grade: CropGrade.A,
      quantityKg: 1000,
    });

    const result = calculateCompareHighlights([active, sold, expired]);

    // Active listing wins all metrics because sold and expired listings are excluded
    expect(result.lowestPriceListingIds).toEqual(["l-active"]);
    expect(result.bestGradeListingIds).toEqual(["l-active"]);
    expect(result.largestQuantityListingIds).toEqual(["l-active"]);
    expect(result.bestValueListingIds).toEqual(["l-active"]);

    expect(result.byListingId["l-sold"]).toEqual({
      isLowestPrice: false,
      isBestGrade: false,
      isLargestQuantity: false,
      isBestValue: false,
    });
    expect(result.byListingId["l-expired"]).toEqual({
      isLowestPrice: false,
      isBestGrade: false,
      isLargestQuantity: false,
      isBestValue: false,
    });
  });

  it("returns all empty highlights if all listings are ended", () => {
    const sold = baseListing({ id: "l1", status: ListingStatus.SOLD });
    const cancelled = baseListing({ id: "l2", status: ListingStatus.CANCELLED });

    const result = calculateCompareHighlights([sold, cancelled]);

    expect(result.lowestPriceListingIds).toEqual([]);
    expect(result.bestGradeListingIds).toEqual([]);
    expect(result.largestQuantityListingIds).toEqual([]);
    expect(result.bestValueListingIds).toEqual([]);
    expect(result.byListingId["l1"]?.isLowestPrice).toBe(false);
    expect(result.byListingId["l2"]?.isLowestPrice).toBe(false);
  });

  it("throws CompareMixedCropsError with COMPARE_MIXED_CROPS error code if listings have mixed crops", () => {
    const l1 = baseListing({ id: "l1", cropId: "crop-onion" });
    const l2 = baseListing({ id: "l2", cropId: "crop-potato" });

    expect(() => calculateCompareHighlights([l1, l2])).toThrow(CompareMixedCropsError);
    try {
      calculateCompareHighlights([l1, l2]);
    } catch (err: unknown) {
      expect((err as CompareMixedCropsError).code).toBe(MarketplaceErrorCode.COMPARE_MIXED_CROPS);
    }
  });

  it("returns empty highlights for empty array", () => {
    const result = calculateCompareHighlights([]);
    expect(result.lowestPriceListingIds).toEqual([]);
    expect(result.bestGradeListingIds).toEqual([]);
    expect(result.largestQuantityListingIds).toEqual([]);
    expect(result.bestValueListingIds).toEqual([]);
    expect(result.byListingId).toEqual({});
  });
});
