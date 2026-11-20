import { z } from "zod";

import {
  AIErrorCode,
  AIGradingProvider,
  AIPriceProvider,
  AIProvider,
  CropGrade,
  GradingReasonCode,
  ListingStatus,
  PriceReasonCode,
} from "../enums.js";
import { databaseIdSchema, inventoryQuantityKgSchema } from "./catalog-inventory.js";

const probabilitySchema = z.number().min(0).max(1);
const poishaSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const cropGradeSchema = z.enum([CropGrade.A, CropGrade.B, CropGrade.C]);
export const aiGradingProviderSchema = z.enum([AIGradingProvider.MOCK, AIGradingProvider.GEMINI]);
export const aiPriceProviderSchema = z.enum([AIPriceProvider.MOCK, AIPriceProvider.BASELINE]);
export const aiProviderSchema = z.enum([
  AIProvider.MOCK,
  AIProvider.HTTP,
  AIProvider.GEMINI,
  AIProvider.BASELINE,
]);
export const aiErrorCodeSchema = z.enum([
  AIErrorCode.CROP_MISMATCH,
  AIErrorCode.GRADE_UNAVAILABLE,
  AIErrorCode.GRADE_STALE,
  AIErrorCode.DAILY_ASSESSMENT_LIMIT_EXCEEDED,
]);
export const priceTrendSchema = z.enum(["UP", "FLAT", "DOWN"]);
export const confidenceBandSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const gradingReasonCodeSchema = z.nativeEnum(GradingReasonCode);
export const priceReasonCodeSchema = z.nativeEnum(PriceReasonCode);

export const gradingReasonItemSchema = z
  .object({
    code: gradingReasonCodeSchema,
    params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  })
  .strict();

export type GradingReasonItem = z.infer<typeof gradingReasonItemSchema>;

export const priceReasonItemSchema = z
  .object({
    code: priceReasonCodeSchema,
    params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  })
  .strict();

export type PriceReasonItem = z.infer<typeof priceReasonItemSchema>;

export const qualityNoteSchema = z.union([
  z.string().trim().min(1),
  gradingReasonItemSchema,
]);

export type QualityNote = z.infer<typeof qualityNoteSchema>;

export const priceExplanationSchema = z.union([
  z.string().trim().min(1),
  priceReasonItemSchema,
]);

export type PriceExplanation = z.infer<typeof priceExplanationSchema>;


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
    qualityNotes: z.array(qualityNoteSchema),
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
    explanation: z.array(priceExplanationSchema),
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

export const relistListingRequestSchema = z
  .object({
    floorPricePerKg: poishaSchema,
    durationMinutes: listingDurationMinutesSchema,
    pickupNote: z.string().trim().min(1).optional(),
  })
  .strict();

export const durationPresetsSchema = z.record(z.string(), z.number().int().positive());

export const publicConfigSchema = z
  .object({
    demoMode: z.boolean(),
    durationPresets: durationPresetsSchema,
    platformFeeBps: z.number().int().nonnegative(),
  })
  .strict();

export const publicConfigResponseSchema = z
  .object({
    data: publicConfigSchema,
  })
  .strict();

export const listingLocationSchema = z
  .object({
    division: z.string().trim().min(1),
    district: z.string().trim().min(1),
    upazila: z.string().trim().min(1).optional(),
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
    location: listingLocationSchema.optional(),
    pickupNote: z.string().optional(),
    closedAt: z.iso.datetime().optional(),
    relistedFromId: databaseIdSchema.optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const farmerListingQuerySchema = z
  .object({
    status: listingStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
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

export const listingDetailResponseSchema = farmerListingResponseSchema;
export const publicListingResponseSchema = farmerListingResponseSchema;

export type AssessmentResult = z.infer<typeof assessmentResultSchema>;
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type PriceGuidance = z.infer<typeof priceGuidanceSchema>;
export type PredictPriceRequest = z.infer<typeof predictPriceRequestSchema>;
export type CreateListingRequest = z.infer<typeof createListingRequestSchema>;
export type RelistListingRequest = z.infer<typeof relistListingRequestSchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type PublicConfigResponse = z.infer<typeof publicConfigResponseSchema>;
export type DurationPresets = z.infer<typeof durationPresetsSchema>;
export type ListingLocation = z.infer<typeof listingLocationSchema>;
export type FarmerListing = z.infer<typeof farmerListingSchema>;
export type FarmerListingQuery = z.infer<typeof farmerListingQuerySchema>;
export type FarmerListingResponse = z.infer<typeof farmerListingResponseSchema>;
export type FarmerListingListResponse = z.infer<typeof farmerListingListResponseSchema>;
export type ListingDetailResponse = z.infer<typeof listingDetailResponseSchema>;
export type PublicListingResponse = z.infer<typeof publicListingResponseSchema>;
export type FloorPriceEvaluation = z.infer<typeof floorPriceEvaluationSchema>;
