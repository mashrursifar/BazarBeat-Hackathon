import { z } from "zod";

import { ListingStatus, MarketplaceSort } from "../enums.js";
import { BANGLADESH_DISTRICTS, BANGLADESH_DIVISIONS } from "../locations.js";
import { BuyerListingStatus } from "../buyer-status.js";
import {
  aiProviderSchema,
  confidenceBandSchema,
  cropGradeSchema,
  listingImageSchema,
  listingLocationSchema,
  listingResponseMetaSchema,
  listingStatusSchema,
  priceTrendSchema,
} from "./ai-listings.js";
import { databaseIdSchema, inventoryQuantityKgSchema } from "./catalog-inventory.js";

const poishaSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const ENDING_WITHIN_HOURS_PRESETS = [1, 3, 6, 24] as const;
export type EndingWithinHoursPreset = (typeof ENDING_WITHIN_HOURS_PRESETS)[number];

export const marketplaceSortSchema = z.enum([
  MarketplaceSort.ENDING_SOONEST,
  MarketplaceSort.LOWEST_PRICE,
  MarketplaceSort.HIGHEST_GRADE,
  MarketplaceSort.NEWEST,
]);

/**
 * Validates division against shared BANGLADESH_DIVISIONS (by id or English name, case-insensitive).
 */
export const divisionQuerySchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (val) =>
      BANGLADESH_DIVISIONS.some(
        (d) =>
          d.id.toLowerCase() === val.toLowerCase() ||
          d.nameEn.toLowerCase() === val.toLowerCase(),
      ),
    { message: "Invalid Bangladesh division" },
  );

/**
 * Validates district against shared BANGLADESH_DISTRICTS (by id or English name, case-insensitive).
 */
export const districtQuerySchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (val) =>
      BANGLADESH_DISTRICTS.some(
        (d) =>
          d.id.toLowerCase() === val.toLowerCase() ||
          d.nameEn.toLowerCase() === val.toLowerCase(),
      ),
    { message: "Invalid Bangladesh district" },
  );

/**
 * Marketplace search query params schema.
 */
export const marketplaceQuerySchema = z
  .object({
    crop: z.string().trim().min(1).optional(),
    cropId: databaseIdSchema.optional(),
    grade: cropGradeSchema.optional(),
    division: divisionQuerySchema.optional(),
    district: districtQuerySchema.optional(),
    minPrice: z.coerce.number().int().nonnegative().optional(),
    maxPrice: z.coerce.number().int().positive().optional(),
    minQuantity: z.coerce.number().positive().optional(),
    minQty: z.coerce.number().positive().optional(),
    endingWithin: z.coerce
      .number()
      .int()
      .refine(
        (val) =>
          (ENDING_WITHIN_HOURS_PRESETS as readonly number[]).includes(val),
        { message: "endingWithin must be one of the presets: 1, 3, 6, or 24 hours" },
      )
      .optional(),
    sort: marketplaceSortSchema.default(MarketplaceSort.ENDING_SOONEST),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    status: z
      .literal(ListingStatus.ACTIVE, {
        message: "Buyers can only query ACTIVE listings",
      })
      .optional()
      .default(ListingStatus.ACTIVE),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    { path: ["maxPrice"], message: "maxPrice cannot be less than minPrice" },
  )
  .refine(
    (data) => {
      if (data.division && data.district) {
        const div = BANGLADESH_DIVISIONS.find(
          (d) =>
            d.id.toLowerCase() === data.division!.toLowerCase() ||
            d.nameEn.toLowerCase() === data.division!.toLowerCase(),
        );
        const dist = BANGLADESH_DISTRICTS.find(
          (d) =>
            d.id.toLowerCase() === data.district!.toLowerCase() ||
            d.nameEn.toLowerCase() === data.district!.toLowerCase(),
        );
        if (div && dist) {
          return dist.divisionId === div.id;
        }
      }
      return true;
    },
    { path: ["district"], message: "District does not belong to specified division" },
  );

export type MarketplaceQuery = z.infer<typeof marketplaceQuerySchema>;

/**
 * Crop summary nested in buyer listing cards.
 */
export const buyerCropSummarySchema = z
  .object({
    id: databaseIdSchema,
    slug: z.string(),
    nameEn: z.string(),
    nameBn: z.string(),
    unit: z.string().default("kg"),
  })
  .strict();

export type BuyerCropSummary = z.infer<typeof buyerCropSummarySchema>;

/**
 * Buyer-facing listing card DTO for marketplace grid.
 */
export const buyerListingCardSchema = z
  .object({
    id: databaseIdSchema,
    cropId: databaseIdSchema,
    crop: buyerCropSummarySchema,
    grade: cropGradeSchema,
    quantityKg: inventoryQuantityKgSchema,
    floorPricePerKg: poishaSchema,
    currentBidPerKg: poishaSchema.optional().nullable(),
    displayPricePerKg: poishaSchema,
    totalDisplayCost: poishaSchema,
    minIncrementPerKg: poishaSchema,
    hasBids: z.boolean().optional().default(false),
    bidCount: z.number().int().nonnegative(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: listingStatusSchema,
    location: listingLocationSchema,
    thumbnailUrl: z.string().optional().nullable(),
    images: z.array(listingImageSchema).min(1).max(4).optional(),
    aiExpectedPricePerKg: poishaSchema.optional(),
    isWatched: z.boolean().optional(),
  })
  .strict();

export type BuyerListingCard = z.infer<typeof buyerListingCardSchema>;

/**
 * Immutable AI price guidance snapshot for buyer-facing detail.
 */
export const aiPriceSnapshotSchema = z
  .object({
    lowPerKg: poishaSchema,
    expectedPerKg: poishaSchema,
    highPerKg: poishaSchema,
    trend: priceTrendSchema,
  })
  .strict();

export type AiPriceSnapshot = z.infer<typeof aiPriceSnapshotSchema>;

export const buyerListingStatusSchema = z.enum([
  BuyerListingStatus.NONE,
  BuyerListingStatus.WINNING,
  BuyerListingStatus.OUTBID,
  BuyerListingStatus.WON,
  BuyerListingStatus.LOST,
]);

/**
 * Buyer-facing listing detail DTO.
 * Excludes private farmer details (pickup notes, phone, exact address) and AI internal tokens.
 */
export const buyerListingDetailSchema = z
  .object({
    id: databaseIdSchema,
    cropId: databaseIdSchema,
    crop: z
      .object({
        id: databaseIdSchema,
        slug: z.string(),
        nameEn: z.string(),
        nameBn: z.string(),
        unit: z.string().default("kg"),
        minIncrementPerKg: poishaSchema,
      })
      .strict(),
    grade: cropGradeSchema,
    confidenceBand: confidenceBandSchema.optional().nullable(),
    reasons: z.array(z.string().trim().min(1)),
    aiPriceSnapshot: aiPriceSnapshotSchema,
    provider: aiProviderSchema,
    degraded: z.boolean(),
    quantityKg: inventoryQuantityKgSchema,
    images: z.array(listingImageSchema).min(1).max(4),
    floorPricePerKg: poishaSchema,
    minIncrementPerKg: poishaSchema,
    currentBidPerKg: poishaSchema.optional().nullable(),
    displayPricePerKg: poishaSchema,
    displayTotalCost: poishaSchema,
    bidCount: z.number().int().nonnegative(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    originalEndsAt: z.iso.datetime().optional(),
    extensionCount: z.number().int().nonnegative(),
    status: listingStatusSchema,
    location: z
      .object({
        division: z.string().trim().min(1),
        district: z.string().trim().min(1),
      })
      .strict(),
    myStatus: buyerListingStatusSchema,
    myHighestBidPerKg: poishaSchema.nullable().optional(),
    highestBidPerKg: poishaSchema.nullable().optional(),
    closedAt: z.iso.datetime().optional(),
    createdAt: z.iso.datetime(),
    isWatched: z.boolean().optional(),
  })
  .strict();

export type BuyerListingDetail = z.infer<typeof buyerListingDetailSchema>;

/**
 * Standard API response envelope for buyer-facing listing detail.
 */
export const buyerListingDetailResponseSchema = z
  .object({
    data: buyerListingDetailSchema,
    meta: listingResponseMetaSchema,
  })
  .strict();

export type BuyerListingDetailResponse = z.infer<typeof buyerListingDetailResponseSchema>;

/**
 * Query schema for GET /listings/compare?ids=a,b,c,d
 * Enforces 2 to 4 unique IDs.
 */
export const compareQuerySchema = z
  .object({
    ids: z.preprocess((val) => {
      if (typeof val === "string") {
        return val.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (Array.isArray(val)) {
        return val.flatMap((v) =>
          typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []
        );
      }
      return val;
    }, z.array(databaseIdSchema, { message: "Invalid listing ID format" })
      .min(2, "At least 2 listing IDs are required for comparison")
      .max(4, "At most 4 listing IDs can be compared at once")
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate listing IDs are not allowed in compare",
      })),
  })
  .strict();

export type CompareQuery = z.infer<typeof compareQuerySchema>;

/**
 * Flags for highlighted comparison attributes.
 */
export const listingHighlightFlagsSchema = z
  .object({
    isLowestPrice: z.boolean(),
    isBestGrade: z.boolean(),
    isLargestQuantity: z.boolean(),
    isBestValue: z.boolean(),
  })
  .strict();

export type ListingHighlightFlagsDto = z.infer<typeof listingHighlightFlagsSchema>;

/**
 * Compact AI price guidance range for comparison cards.
 */
export const aiPriceRangeSchema = z
  .object({
    lowPerKg: poishaSchema,
    expectedPerKg: poishaSchema,
    highPerKg: poishaSchema,
  })
  .strict();

export type AiPriceRangeDto = z.infer<typeof aiPriceRangeSchema>;

/**
 * Listing item schema inside the compare payload.
 */
export const compareListingSchema = z
  .object({
    id: databaseIdSchema,
    cropId: databaseIdSchema,
    crop: buyerCropSummarySchema.optional(),
    cropNameEn: z.string(),
    cropNameBn: z.string(),
    grade: cropGradeSchema,
    quantityKg: inventoryQuantityKgSchema,
    floorPricePerKg: poishaSchema,
    currentBidPerKg: poishaSchema.optional().nullable(),
    displayPricePerKg: poishaSchema,
    displayTotalCost: poishaSchema,
    totalDisplayCost: poishaSchema.optional(),
    minIncrementPerKg: poishaSchema,
    hasBids: z.boolean().optional(),
    bidCount: z.number().int().nonnegative(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: listingStatusSchema,
    location: listingLocationSchema,
    farmerRegion: z.string().optional(),
    timeLeftSeconds: z.number().int().nonnegative().optional(),
    aiExpectedPricePerKg: poishaSchema.optional().nullable(),
    aiRange: aiPriceRangeSchema.optional().nullable(),
    percentageVsAiExpected: z.number().optional().nullable(),
    highlights: listingHighlightFlagsSchema.optional(),
    thumbnailUrl: z.string().optional().nullable(),
    images: z.array(listingImageSchema).min(1).max(4).optional(),
    card: buyerListingCardSchema.optional(),
  })
  .strict();

export type CompareListing = z.infer<typeof compareListingSchema>;

/**
 * Highlights computed across compared listings.
 */
export const compareHighlightsSchema = z
  .object({
    lowestPriceListingIds: z.array(z.string()),
    bestGradeListingIds: z.array(z.string()),
    largestQuantityListingIds: z.array(z.string()),
    bestValueListingIds: z.array(z.string()),
    byListingId: z.record(z.string(), listingHighlightFlagsSchema),
  })
  .strict();

export type CompareHighlightsDto = z.infer<typeof compareHighlightsSchema>;

/**
 * Response payload for GET /listings/compare?ids=a,b,c,d.
 */
export const comparePayloadSchema = z
  .object({
    cropId: databaseIdSchema.optional().nullable(),
    listings: z.array(compareListingSchema).max(4),
    highlights: compareHighlightsSchema,
    missingIds: z.array(z.string()).default([]),
  })
  .strict();

export type ComparePayload = z.infer<typeof comparePayloadSchema>;

/**
 * Response envelope for GET /listings/compare.
 */
export const compareResponseSchema = z
  .object({
    data: comparePayloadSchema,
    meta: listingResponseMetaSchema,
  })
  .strict();

export type CompareResponse = z.infer<typeof compareResponseSchema>;

/**
 * Response envelope for marketplace listings list.
 */
export const marketplaceListingListResponseSchema = z
  .object({
    data: z.array(buyerListingCardSchema),
    meta: listingResponseMetaSchema
      .extend({
        page: z.number().int().positive(),
        limit: z.number().int().positive().max(50),
        total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type MarketplaceListingListResponse = z.infer<
  typeof marketplaceListingListResponseSchema
>;
