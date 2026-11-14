import { CropGrade, ListingStatus, MarketplaceErrorCode } from "./enums.js";
import { getDisplayPricePerKg } from "./display-price.js";

export class CompareMixedCropsError extends Error {
  public readonly code = MarketplaceErrorCode.COMPARE_MIXED_CROPS;

  public constructor(message = "All listings in compare must belong to the same crop") {
    super(message);
    this.name = "CompareMixedCropsError";
  }
}

export interface CompareListingItem {
  id: string;
  cropId: string;
  grade: CropGrade;
  quantityKg: number;
  floorPricePerKg: number;
  currentBidPerKg?: number | null;
  bidCount?: number;
  status: ListingStatus;
  aiExpectedPricePerKg?: number | null;
  aiPriceGuidance?: {
    expectedPerKg: number;
  } | null;
}

export interface ListingHighlightFlags {
  isLowestPrice: boolean;
  isBestGrade: boolean;
  isLargestQuantity: boolean;
  isBestValue: boolean;
}

export interface CompareHighlights {
  lowestPriceListingIds: string[];
  bestGradeListingIds: string[];
  largestQuantityListingIds: string[];
  bestValueListingIds: string[];
  byListingId: Record<string, ListingHighlightFlags>;
}

const GRADE_RANKS: Record<CropGrade, number> = {
  [CropGrade.A]: 1,
  [CropGrade.B]: 2,
  [CropGrade.C]: 3,
};

/**
 * Calculates compare highlights across a set of listings according to Task 5.1 rules:
 * - Only among ACTIVE listings of the same crop:
 *   - lowest price per kg (using display price)
 *   - best grade (A over B over C)
 *   - largest quantity
 *   - lowest percentage versus the AI expected price (clearest "best value" signal)
 * - Ties highlight all tied columns.
 * - Ended listings (SOLD, EXPIRED_UNSOLD, CANCELLED, DRAFT) are shown but never highlighted.
 * - Throws CompareMixedCropsError (code COMPARE_MIXED_CROPS) if listings belong to multiple crops.
 */
export function calculateCompareHighlights(listings: CompareListingItem[]): CompareHighlights {
  const byListingId: Record<string, ListingHighlightFlags> = {};

  // Initialize flags for all listings to false
  for (const listing of listings) {
    byListingId[listing.id] = {
      isLowestPrice: false,
      isBestGrade: false,
      isLargestQuantity: false,
      isBestValue: false,
    };
  }

  if (listings.length === 0) {
    return {
      lowestPriceListingIds: [],
      bestGradeListingIds: [],
      largestQuantityListingIds: [],
      bestValueListingIds: [],
      byListingId,
    };
  }

  // Verify single crop rule
  const distinctCrops = new Set(listings.map((l) => l.cropId));
  if (distinctCrops.size > 1) {
    throw new CompareMixedCropsError();
  }

  // Filter only ACTIVE listings
  const activeListings = listings.filter((l) => l.status === ListingStatus.ACTIVE);

  if (activeListings.length === 0) {
    return {
      lowestPriceListingIds: [],
      bestGradeListingIds: [],
      largestQuantityListingIds: [],
      bestValueListingIds: [],
      byListingId,
    };
  }

  // 1. Lowest price per kg
  const pricesWithIds = activeListings.map((l) => ({
    id: l.id,
    pricePerKg: getDisplayPricePerKg(l),
  }));
  const minPrice = Math.min(...pricesWithIds.map((p) => p.pricePerKg));
  const lowestPriceListingIds = pricesWithIds
    .filter((p) => p.pricePerKg === minPrice)
    .map((p) => p.id);

  for (const id of lowestPriceListingIds) {
    byListingId[id]!.isLowestPrice = true;
  }

  // 2. Best grade (A over B over C)
  const gradesWithIds = activeListings.map((l) => ({
    id: l.id,
    rank: GRADE_RANKS[l.grade] ?? 999,
  }));
  const bestGradeRank = Math.min(...gradesWithIds.map((g) => g.rank));
  const bestGradeListingIds = gradesWithIds
    .filter((g) => g.rank === bestGradeRank)
    .map((g) => g.id);

  for (const id of bestGradeListingIds) {
    byListingId[id]!.isBestGrade = true;
  }

  // 3. Largest quantity
  const maxQty = Math.max(...activeListings.map((l) => l.quantityKg));
  const largestQuantityListingIds = activeListings
    .filter((l) => l.quantityKg === maxQty)
    .map((l) => l.id);

  for (const id of largestQuantityListingIds) {
    byListingId[id]!.isLargestQuantity = true;
  }

  // 4. Lowest percentage versus AI expected price (best value signal)
  const candidatesForValue: Array<{ id: string; price: bigint; expected: bigint }> = [];
  for (const l of activeListings) {
    const expected = l.aiPriceGuidance?.expectedPerKg ?? l.aiExpectedPricePerKg;
    if (expected && Number.isSafeInteger(expected) && expected > 0) {
      candidatesForValue.push({
        id: l.id,
        price: BigInt(getDisplayPricePerKg(l)),
        expected: BigInt(expected),
      });
    }
  }

  const bestValueListingIds: string[] = [];
  if (candidatesForValue.length > 0) {
    // Find item with lowest price / expected ratio using cross-multiplication
    let minCandidate = candidatesForValue[0]!;
    for (let i = 1; i < candidatesForValue.length; i++) {
      const current = candidatesForValue[i]!;
      // current.price / current.expected < minCandidate.price / minCandidate.expected
      // <=> current.price * minCandidate.expected < minCandidate.price * current.expected
      if (current.price * minCandidate.expected < minCandidate.price * current.expected) {
        minCandidate = current;
      }
    }

    // Identify all candidates that tie the minimum ratio
    for (const c of candidatesForValue) {
      if (c.price * minCandidate.expected === minCandidate.price * c.expected) {
        bestValueListingIds.push(c.id);
        byListingId[c.id]!.isBestValue = true;
      }
    }
  }

  return {
    lowestPriceListingIds,
    bestGradeListingIds,
    largestQuantityListingIds,
    bestValueListingIds,
    byListingId,
  };
}
