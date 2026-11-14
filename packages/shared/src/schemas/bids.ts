import { z } from "zod";
import { BidStatus, CropGrade, ListingStatus } from "../enums.js";
import { databaseIdSchema, inventoryQuantityKgSchema } from "./catalog-inventory.js";

/**
 * Request payload for placing a bid on an active listing.
 * AUCTION_RULES §3: Amount is strictly an integer in poisha per kg.
 */
export const placeBidRequestSchema = z.object({
  amountPerKg: z
    .number()
    .int("Bid amount must be an integer in poisha")
    .positive("Bid amount must be a positive integer in poisha"),
});

export type PlaceBidRequest = z.infer<typeof placeBidRequestSchema>;

/**
 * Single bid record contract.
 */
export const bidItemSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  buyerId: z.string(),
  amountPerKg: z.number().int().positive(),
  totalAmount: z.number().int().positive(),
  status: z.enum([BidStatus.ACCEPTED, BidStatus.WON, BidStatus.LOST]),
  placedAt: z.string().datetime(),
  seq: z.number().int().positive().optional(),
});

export type BidItem = z.infer<typeof bidItemSchema>;

/**
 * Standard API response envelope for placing a bid or reading a single bid.
 */
export const bidResponseSchema = z.object({
  data: bidItemSchema,
  meta: z.object({
    serverTime: z.string().datetime(),
  }),
});

export type BidResponse = z.infer<typeof bidResponseSchema>;

/**
 * Anonymized bid history item shown to farmers, other buyers, and marketplace viewers.
 * AUCTION_RULES §10: Bidders appear as anonymized labels (e.g. "Buyer #3") to preserve privacy.
 * isMine / isMyBid flag indicates if the bid belongs to the current authenticated buyer.
 */
export const anonymizedBidHistoryItemSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  amountPerKg: z.number().int().positive(),
  totalAmount: z.number().int().positive(),
  bidderLabel: z.string(),
  placedAt: z.string().datetime(),
  isMine: z.boolean().optional(),
  isMyBid: z.boolean().optional(),
});

export type AnonymizedBidHistoryItem = z.infer<typeof anonymizedBidHistoryItemSchema>;

/**
 * API response envelope for reading the bid history of a listing.
 */
export const anonymizedBidHistoryResponseSchema = z.object({
  data: z.array(anonymizedBidHistoryItemSchema),
  meta: z.object({
    serverTime: z.string().datetime(),
  }),
});

export type AnonymizedBidHistoryResponse = z.infer<typeof anonymizedBidHistoryResponseSchema>;

/**
 * Details returned with a BID_TOO_LOW error explaining the required floor / increment bounds.
 */
export const bidTooLowDetailsSchema = z.object({
  minimumRequiredPerKg: z.number().int().positive(),
  currentBidPerKg: z.number().int().positive().optional().nullable(),
  floorPricePerKg: z.number().int().positive(),
  minIncrementPerKg: z.number().int().positive(),
});

export type BidTooLowDetails = z.infer<typeof bidTooLowDetailsSchema>;

/**
 * Buyer bid status for My Bids view (derived from auction & bid state).
 */
export const buyerBidStatusSchema = z.enum(["WINNING", "OUTBID", "WON", "LOST"]);
export type BuyerBidStatus = z.infer<typeof buyerBidStatusSchema>;

/**
 * Single row in the buyer's My Bids list.
 */
export const myBidsRowSchema = z.object({
  bidId: databaseIdSchema,
  listingId: databaseIdSchema,
  cropId: databaseIdSchema,
  cropNameEn: z.string(),
  cropNameBn: z.string(),
  grade: z.enum([CropGrade.A, CropGrade.B, CropGrade.C]),
  quantityKg: inventoryQuantityKgSchema,
  myBidPerKg: z.number().int().positive(),
  myTotalAmount: z.number().int().positive(),
  currentBidPerKg: z.number().int().positive(),
  currentTotalAmount: z.number().int().positive(),
  bidCount: z.number().int().nonnegative(),
  status: buyerBidStatusSchema,
  listingStatus: z.enum([
    ListingStatus.DRAFT,
    ListingStatus.ACTIVE,
    ListingStatus.SOLD,
    ListingStatus.EXPIRED_UNSOLD,
    ListingStatus.CANCELLED,
  ]),
  endsAt: z.string().datetime(),
  placedAt: z.string().datetime(),
  thumbnailUrl: z.string().optional().nullable(),
});

export type MyBidsRow = z.infer<typeof myBidsRowSchema>;

/**
 * Grouped response envelope for GET /bids/mine.
 */
export const myBidsResponseSchema = z.object({
  data: z.object({
    active: z.array(myBidsRowSchema),
    won: z.array(myBidsRowSchema),
    lost: z.array(myBidsRowSchema),
  }),
  meta: z.object({
    serverTime: z.string().datetime(),
  }),
});

export type MyBidsResponse = z.infer<typeof myBidsResponseSchema>;

