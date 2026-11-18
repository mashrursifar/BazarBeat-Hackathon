import { z } from "zod";
import { databaseIdSchema } from "./catalog-inventory.js";
import { buyerListingCardSchema } from "./marketplace.js";

/**
 * Watchlist item database representation schema.
 * Source: DATA_MODEL (WatchlistItem), docs/phase-8.md (Task 8.1, 8.5, D-34).
 */
export const watchlistItemSchema = z
  .object({
    id: databaseIdSchema,
    userId: databaseIdSchema,
    listingId: databaseIdSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export type WatchlistItem = z.infer<typeof watchlistItemSchema>;

/**
 * Request schema for adding a listing to the buyer's watchlist.
 */
export const addWatchlistRequestSchema = z
  .object({
    listingId: databaseIdSchema,
  })
  .strict();

export type AddWatchlistRequest = z.infer<typeof addWatchlistRequestSchema>;

/**
 * Paginated watchlist response schema returning buyer listing cards.
 */
export const watchlistResponseSchema = z
  .object({
    data: z.array(buyerListingCardSchema),
    meta: z
      .object({
        serverTime: z.string().datetime(),
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type WatchlistResponse = z.infer<typeof watchlistResponseSchema>;

/**
 * Single-action response for watchlist add/remove operations.
 */
export const watchlistActionResponseSchema = z
  .object({
    data: z
      .object({
        success: z.boolean(),
        listingId: databaseIdSchema,
        isWatched: z.boolean(),
      })
      .strict(),
    meta: z
      .object({
        serverTime: z.string().datetime(),
      })
      .strict(),
  })
  .strict();

export type WatchlistActionResponse = z.infer<typeof watchlistActionResponseSchema>;
