import { z } from "zod";

import { ListingStatus } from "../enums.js";
import { databaseIdSchema } from "./catalog-inventory.js";
import { listingStatusSchema } from "./ai-listings.js";

const poishaSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/**
 * Event names broadcast on the listing SSE stream (GET /api/v1/listings/:id/stream).
 */
export const ListingStreamEventName = {
  SNAPSHOT: "snapshot",
  BID_PLACED: "bid.placed",
  AUCTION_EXTENDED: "auction.extended",
  AUCTION_CLOSED: "auction.closed",
} as const;

export type ListingStreamEventName =
  (typeof ListingStreamEventName)[keyof typeof ListingStreamEventName];

/**
 * Initial snapshot event emitted immediately upon SSE client connection.
 * Carries current price, bid count, end time, status, and serverTime.
 */
export const listingStreamSnapshotSchema = z
  .object({
    listingId: databaseIdSchema,
    currentPrice: poishaSchema,
    currentBidPerKg: poishaSchema.nullable(),
    floorPricePerKg: poishaSchema,
    bidCount: z.number().int().nonnegative(),
    endTime: z.string().datetime(),
    endsAt: z.string().datetime(),
    status: listingStatusSchema,
    serverTime: z.string().datetime(),
  })
  .strict();

export type ListingStreamSnapshot = z.infer<typeof listingStreamSnapshotSchema>;

/**
 * Lightweight state patch emitted when a new bid is placed.
 * Privacy rule: Excludes buyerId to avoid leaking internal user IDs to stream listeners.
 */
export const listingStreamBidPlacedPatchSchema = z
  .object({
    listingId: databaseIdSchema,
    bidId: databaseIdSchema,
    bidderLabel: z.string().trim().min(1),
    currentPrice: poishaSchema,
    currentBidPerKg: poishaSchema,
    amountPerKg: poishaSchema,
    totalAmount: poishaSchema,
    bidCount: z.number().int().positive(),
    placedAt: z.string().datetime(),
    serverTime: z.string().datetime(),
  })
  .strict();

export type ListingStreamBidPlacedPatch = z.infer<typeof listingStreamBidPlacedPatchSchema>;

/**
 * Lightweight state patch emitted when an auction is extended due to anti-sniping.
 */
export const listingStreamAuctionExtendedPatchSchema = z
  .object({
    listingId: databaseIdSchema,
    endsAt: z.string().datetime(),
    endTime: z.string().datetime(),
    extensionCount: z.number().int().positive(),
    extendedAt: z.string().datetime(),
    serverTime: z.string().datetime(),
  })
  .strict();

export type ListingStreamAuctionExtendedPatch = z.infer<
  typeof listingStreamAuctionExtendedPatchSchema
>;

/**
 * Lightweight state patch emitted when an auction transitions to a closed status
 * (SOLD, EXPIRED_UNSOLD, or CANCELLED).
 * Privacy rule: Excludes winningBidderId to avoid leaking winner user ID.
 */
export const listingStreamAuctionClosedPatchSchema = z
  .object({
    listingId: databaseIdSchema,
    status: z.enum([ListingStatus.SOLD, ListingStatus.EXPIRED_UNSOLD, ListingStatus.CANCELLED]),
    closedAt: z.string().datetime(),
    winningBidId: databaseIdSchema.optional(),
    winningAmountPerKg: poishaSchema.optional(),
    totalAmount: poishaSchema.optional(),
    serverTime: z.string().datetime(),
  })
  .strict();

export type ListingStreamAuctionClosedPatch = z.infer<typeof listingStreamAuctionClosedPatchSchema>;
