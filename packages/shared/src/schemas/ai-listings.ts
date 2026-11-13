import { z } from "zod";

import { AIErrorCode, AIProvider, CropGrade, ListingStatus } from "../enums.js";
import { databaseIdSchema, inventoryQuantityKgSchema } from "./catalog-inventory.js";

const probabilitySchema = z.number().min(0).max(1);
const poishaSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const cropGradeSchema = z.enum([CropGrade.A, CropGrade.B, CropGrade.C]);
export const aiProviderSchema = z.enum([AIProvider.MOCK, AIProvider.HTTP]);
export const aiErrorCodeSchema = z.enum([AIErrorCode.CROP_MISMATCH, AIErrorCode.GRADE_UNAVAILABLE]);
export const priceTrendSchema = z.enum(["UP", "FLAT", "DOWN"]);
export const confidenceBandSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const classProbabilitiesSchema = z
  .object({
    A: probabilitySchema,
    B: probabilitySchema,
    C: probabilitySchema,
  })
  .strict();

export const aiAssessmentSchema = z
  .object({
    grade: cropGradeSchema,
    confidence: probabilitySchema,
    confidenceBand: confidenceBandSchema.optional(),
    classProbabilities: classProbabilitiesSchema,
    qualityNotes: z.array(z.string().trim().min(1)),
    cropMatch: z.boolean(),
    modelVersion: z.string().trim().min(1),
    provider: aiProviderSchema,
    degraded: z.boolean(),
    assessedAt: z.iso.datetime(),
  })
  .strict();

export const assessmentResultSchema = aiAssessmentSchema
  .extend({
    assessmentToken: z.string().min(1).max(4096),
  })
  .strict();

export const priceGuidanceSchema = z
  .object({
    lowPerKg: poishaSchema,
    expectedPerKg: poishaSchema,
    highPerKg: poishaSchema,
    trend: priceTrendSchema,
    confidence: probabilitySchema,
    explanation: z.array(z.string().trim().min(1)),
    modelVersion: z.string().trim().min(1),
    provider: aiProviderSchema,
    degraded: z.boolean(),
    generatedAt: z.iso.datetime(),
    suggestedFloorPerKg: poishaSchema,
  })
  .strict()
  .refine(
    (guidance) =>
      guidance.lowPerKg <= guidance.expectedPerKg && guidance.expectedPerKg <= guidance.highPerKg,
    { path: ["expectedPerKg"], message: "Expected price must be between low and high prices" },
  );

export const predictPriceRequestSchema = z
  .object({
    cropId: databaseIdSchema,
    grade: cropGradeSchema,
    quantityKg: inventoryQuantityKgSchema,
    localSellingCostPerKg: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();

export const listingStatusSchema = z.enum([
  ListingStatus.DRAFT,
  ListingStatus.ACTIVE,
  ListingStatus.SOLD,
  ListingStatus.EXPIRED_UNSOLD,
  ListingStatus.CANCELLED,
]);

export const LISTING_DURATION_PRESETS = {
  ONE_HOUR: 60,
  THREE_HOURS: 180,
  SIX_HOURS: 360,
  TWELVE_HOURS: 720,
  TWENTY_FOUR_HOURS: 1440,
} as const;

export const DEMO_LISTING_DURATION_PRESET_MINUTES = 2;

const allowedListingDurations = new Set<number>([
  ...Object.values(LISTING_DURATION_PRESETS),
  DEMO_LISTING_DURATION_PRESET_MINUTES,
]);

export const listingDurationMinutesSchema = z
  .number()
  .int()
  .refine((durationMinutes) => allowedListingDurations.has(durationMinutes), {
    message: "Duration must be a supported listing preset",
  });

export const createListingRequestSchema = z
  .object({
    cropId: databaseIdSchema,
    assessmentToken: z.string().min(1).max(4096),
    quantityKg: inventoryQuantityKgSchema,
    floorPricePerKg: poishaSchema,
    durationMinutes: listingDurationMinutesSchema,
    pickupNote: z.string().trim().min(1).optional(),
  })
  .strict();

export const publicConfigSchema = z
  .object({
    demoMode: z.boolean(),
  })
  .strict();

export const listingImageSchema = z
  .object({
    url: z.union([z.string().url(), z.string().startsWith("/")]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export const farmerListingSchema = z
  .object({
    id: databaseIdSchema,
    cropId: databaseIdSchema,
    quantityKg: inventoryQuantityKgSchema,
    images: z.array(listingImageSchema).min(1).max(4),
    aiAssessment: aiAssessmentSchema,
    aiPriceGuidance: priceGuidanceSchema,
    floorPricePerKg: poishaSchema,
    minIncrementPerKg: poishaSchema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    originalEndsAt: z.iso.datetime(),
    extensionCount: z.number().int().nonnegative(),
    status: listingStatusSchema,
    currentBidPerKg: poishaSchema.optional(),
    bidCount: z.number().int().nonnegative(),
    pickupNote: z.string().optional(),
    closedAt: z.iso.datetime().optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const listingResponseMetaSchema = z
  .object({
    serverTime: z.iso.datetime(),
  })
  .strict();

export const farmerListingResponseSchema = z
  .object({
    data: farmerListingSchema,
    meta: listingResponseMetaSchema,
  })
  .strict();

export const farmerListingListResponseSchema = z
  .object({
    data: z.array(farmerListingSchema),
    meta: listingResponseMetaSchema
      .extend({
        page: z.number().int().positive(),
        limit: z.number().int().positive().max(50),
        total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const floorPriceEvaluationSchema = z.enum(["ok", "below-market", "overpriced"]);

export type AssessmentResult = z.infer<typeof assessmentResultSchema>;
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type PriceGuidance = z.infer<typeof priceGuidanceSchema>;
export type PredictPriceRequest = z.infer<typeof predictPriceRequestSchema>;
export type CreateListingRequest = z.infer<typeof createListingRequestSchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type FarmerListing = z.infer<typeof farmerListingSchema>;
export type FarmerListingResponse = z.infer<typeof farmerListingResponseSchema>;
export type FarmerListingListResponse = z.infer<typeof farmerListingListResponseSchema>;
export type FloorPriceEvaluation = z.infer<typeof floorPriceEvaluationSchema>;
