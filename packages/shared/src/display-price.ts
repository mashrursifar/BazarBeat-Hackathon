import { calculateSubtotal, formatPoisha } from "./money.js";

export interface ListingPriceSource {
  floorPricePerKg: number;
  currentBidPerKg?: number | null;
  bidCount?: number;
}

/**
 * Returns the effective display price per kg for a listing in integer poisha.
 * If the listing has bids (bidCount > 0 and currentBidPerKg is present), returns currentBidPerKg.
 * Otherwise, returns the floorPricePerKg.
 */
export function getDisplayPricePerKg(listing: ListingPriceSource): number {
  if (!Number.isSafeInteger(listing.floorPricePerKg) || listing.floorPricePerKg < 1) {
    throw new RangeError("Floor price must be a positive safe integer in poisha");
  }

  const hasBids =
    typeof listing.bidCount === "number" &&
    listing.bidCount > 0 &&
    listing.currentBidPerKg !== null &&
    listing.currentBidPerKg !== undefined;

  if (hasBids) {
    if (!Number.isSafeInteger(listing.currentBidPerKg) || (listing.currentBidPerKg as number) < 1) {
      throw new RangeError("Current bid must be a positive safe integer in poisha when bids exist");
    }
    return listing.currentBidPerKg as number;
  }

  return listing.floorPricePerKg;
}

export interface DisplayPriceSummary {
  amountPerKg: number;
  isFloor: boolean;
  totalCost?: number;
}

/**
 * Returns full display price summary including whether the price is the floor price
 * and optional totalCost when quantityKg is provided.
 */
export function getDisplayPrice(
  listing: ListingPriceSource & { quantityKg?: number },
): DisplayPriceSummary {
  const isFloor =
    listing.bidCount === undefined ||
    listing.bidCount === 0 ||
    listing.currentBidPerKg === null ||
    listing.currentBidPerKg === undefined;

  const amountPerKg = getDisplayPricePerKg(listing);
  const totalCost =
    listing.quantityKg !== undefined
      ? calculateSubtotal(amountPerKg, listing.quantityKg)
      : undefined;

  return {
    amountPerKg,
    isFloor,
    ...(totalCost !== undefined ? { totalCost } : {}),
  };
}

/**
 * Formats poisha per kg into a user-facing string (e.g., "৳50.00/kg").
 */
export function formatDisplayPrice(pricePerKgInPoisha: number): string {
  return `${formatPoisha(pricePerKgInPoisha)}/kg`;
}
