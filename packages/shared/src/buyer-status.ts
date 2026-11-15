import { ListingStatus } from "./enums.js";

export const BuyerListingStatus = {
  NONE: "NONE",
  WINNING: "WINNING",
  OUTBID: "OUTBID",
  WON: "WON",
  LOST: "LOST",
} as const;

export type BuyerListingStatus = (typeof BuyerListingStatus)[keyof typeof BuyerListingStatus];

export interface DeriveBuyerListingStatusInput {
  listingStatus: ListingStatus;
  currentBidderId?: string | null;
  buyerId: string;
  hasBids: boolean;
}

/**
 * Derives the buyer's own status for a listing across the five auction states:
 * - NONE: buyer has never placed any bids on this listing
 * - WINNING: listing is ACTIVE and the buyer is currently the highest bidder
 * - OUTBID: listing is ACTIVE and the buyer has bid, but someone else is highest bidder
 * - WON: listing is SOLD and the buyer is the winning bidder
 * - LOST: listing is ended (SOLD, EXPIRED_UNSOLD, CANCELLED) and the buyer did not win
 */
export function deriveBuyerListingStatus(input: DeriveBuyerListingStatusInput): BuyerListingStatus {
  if (!input.hasBids) {
    return BuyerListingStatus.NONE;
  }

  const isCurrentHighest =
    input.currentBidderId !== undefined &&
    input.currentBidderId !== null &&
    input.currentBidderId.toLowerCase() === input.buyerId.toLowerCase();

  if (input.listingStatus === ListingStatus.ACTIVE) {
    return isCurrentHighest ? BuyerListingStatus.WINNING : BuyerListingStatus.OUTBID;
  }

  if (input.listingStatus === ListingStatus.SOLD) {
    return isCurrentHighest ? BuyerListingStatus.WON : BuyerListingStatus.LOST;
  }

  // EXPIRED_UNSOLD, CANCELLED, DRAFT, etc.
  return BuyerListingStatus.LOST;
}
