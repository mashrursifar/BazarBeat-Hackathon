import { z } from "zod";
import { BidStatus } from "../enums.js";

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
 */
export const anonymizedBidHistoryItemSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  amountPerKg: z.number().int().positive(),
  totalAmount: z.number().int().positive(),
  bidderLabel: z.string(),
  placedAt: z.string().datetime(),
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
