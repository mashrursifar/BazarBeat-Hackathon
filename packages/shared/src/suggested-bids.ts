import { calculateSubtotal } from "./money.js";

export interface SuggestedBidInput {
  floorPricePerKg: number;
  currentBidPerKg?: number | null;
  minIncrementPerKg: number;
  bidCount: number;
  quantityKg: number;
}

export interface SuggestedBid {
  amountPerKg: number;
  totalAmount: number;
  label: string;
}

/**
 * Calculates suggested bids for buyers on a listing according to Task 5.1 rules:
 * - Minimum: floor price when there are no bids; otherwise current bid + minIncrement.
 * - "+5%" and "+10%": current price (or floor) increased by that percentage, rounded up
 *   to the next multiple of minIncrement, and never below the minimum.
 * - Duplicates are removed when two suggestions are equal.
 * - All values are integer poisha per kg; total cost preview = per-kg amount × quantity using calculateSubtotal.
 */
export function calculateSuggestedBids(input: SuggestedBidInput): SuggestedBid[] {
  const { floorPricePerKg, currentBidPerKg, minIncrementPerKg, bidCount, quantityKg } = input;

  if (!Number.isSafeInteger(floorPricePerKg) || floorPricePerKg < 1) {
    throw new RangeError("Floor price must be a positive safe integer in poisha");
  }
  if (!Number.isSafeInteger(minIncrementPerKg) || minIncrementPerKg < 1) {
    throw new RangeError("Minimum increment must be a positive safe integer in poisha");
  }
  if (!Number.isSafeInteger(bidCount) || bidCount < 0) {
    throw new RangeError("Bid count must be a non-negative integer");
  }
  if (typeof quantityKg !== "number" || !Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new RangeError("Quantity in kg must be a positive finite number");
  }

  if (bidCount > 0) {
    if (
      currentBidPerKg === null ||
      currentBidPerKg === undefined ||
      !Number.isSafeInteger(currentBidPerKg) ||
      currentBidPerKg < 1
    ) {
      throw new RangeError("Current bid must be a positive safe integer in poisha when bids exist");
    }
  }

  const hasBids = bidCount > 0;

  const currentPrice = hasBids ? (currentBidPerKg as number) : floorPricePerKg;
  const minimumBid = hasBids ? (currentBidPerKg as number) + minIncrementPerKg : floorPricePerKg;

  function calculatePercentageBid(percent: number): number {
    const raw = currentPrice * (1 + percent / 100);
    // Rounded up to the next multiple of the minimum increment
    const roundedUp = Math.ceil(raw / minIncrementPerKg) * minIncrementPerKg;
    return Math.max(minimumBid, roundedUp);
  }

  const rawCandidates: Array<{ amountPerKg: number; label: string }> = [
    { amountPerKg: minimumBid, label: "Minimum" },
    { amountPerKg: calculatePercentageBid(5), label: "+5%" },
    { amountPerKg: calculatePercentageBid(10), label: "+10%" },
  ];

  const seen = new Set<number>();
  const suggestions: SuggestedBid[] = [];

  for (const item of rawCandidates) {
    if (!seen.has(item.amountPerKg)) {
      seen.add(item.amountPerKg);
      suggestions.push({
        amountPerKg: item.amountPerKg,
        totalAmount: calculateSubtotal(item.amountPerKg, quantityKg),
        label: item.label,
      });
    }
  }

  return suggestions;
}
