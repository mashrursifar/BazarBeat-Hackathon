import { describe, expect, it } from "vitest";

import {
  AIErrorCode,
  AIGradingProvider,
  AIPriceProvider,
  AIProvider,
  CropGrade,
  ListingStatus,
} from "../enums.js";
import {
  DEMO_LISTING_DURATION_PRESET_MINUTES,
  LISTING_DURATION_PRESETS,
  aiAssessmentSchema,
  aiErrorCodeSchema,
  aiGradingProviderSchema,
  aiPriceProviderSchema,
  aiProviderSchema,
  assessmentResultSchema,
  classProbabilitiesSchema,
  createListingRequestSchema,
  cropGradeSchema,
  farmerListingListResponseSchema,
  farmerListingQuerySchema,
  farmerListingResponseSchema,
  farmerListingSchema,
  listingDurationMinutesSchema,
  listingImageSchema,
  listingResponseMetaSchema,
  listingStatusSchema,
  predictPriceRequestSchema,
  priceGuidanceSchema,
  priceTrendSchema,
  publicConfigSchema,
  relistListingRequestSchema,
} from "./index.js";

const id = "0123456789abcdef01234567";

const assessment = {
  grade: "B",
  confidence: 0.9,
  classProbabilities: { A: 0.1, B: 0.8, C: 0.1 },
  qualityNotes: ["Firm and fresh"],
  cropMatch: true,
  modelVersion: "mock-v1",
  provider: "mock",
  degraded: false,
  assessedAt: "2026-11-04T00:00:00.000Z",
};

const guidance = {
  lowPerKg: 900,
  expectedPerKg: 1_000,
  highPerKg: 1_100,
  trend: "UP",
  confidence: 0.8,
  explanation: ["Recent local prices are rising"],
  modelVersion: "mock-v1",
  provider: "mock",
  degraded: false,
  generatedAt: "2026-11-04T00:00:00.000Z",
  suggestedFloorPerKg: 1_000,
};

const listing = {
  id,
  cropId: id,
  quantityKg: 12.5,
  images: [{ url: "/uploads/crop.jpg", width: 1200, height: 900 }],
  aiAssessment: assessment,
  aiPriceGuidance: guidance,
  floorPricePerKg: 950,
  minIncrementPerKg: 100,
  startsAt: "2026-11-04T00:00:00.000Z",
  endsAt: "2026-11-04T01:00:00.000Z",
  originalEndsAt: "2026-11-04T01:00:00.000Z",
  extensionCount: 0,
  status: "ACTIVE",
  bidCount: 0,
  createdAt: "2026-11-04T00:00:00.000Z",
};

describe("shared AI and listing schemas", () => {
  it("validates the shared grade enum and probability schema", () => {
    expect(cropGradeSchema.parse(CropGrade.A)).toBe("A");
    expect(cropGradeSchema.safeParse("D").success).toBe(false);
    expect(classProbabilitiesSchema.safeParse({ A: 0.2, B: 0.5, C: 0.3 }).success).toBe(true);
    expect(classProbabilitiesSchema.safeParse({ A: 1.1, B: 0, C: 0 }).success).toBe(false);
  });

  it("validates assessment results, including the issued token and provider metadata", () => {
    expect(aiAssessmentSchema.safeParse(assessment).success).toBe(true);
    expect(
      assessmentResultSchema.safeParse({ ...assessment, assessmentToken: "signed-token" }).success,
    ).toBe(true);
    expect(assessmentResultSchema.safeParse({ ...assessment, assessmentToken: "" }).success).toBe(
      false,
    );
    expect(aiAssessmentSchema.safeParse({ ...assessment, confidence: 1.1 }).success).toBe(false);
    expect(aiAssessmentSchema.safeParse({ ...assessment, provider: "unknown" }).success).toBe(
      false,
    );
    expect(aiAssessmentSchema.safeParse({ ...assessment, provider: "gemini" }).success).toBe(true);
    expect(AIGradingProvider.MOCK).toBe("mock");
    expect(AIGradingProvider.GEMINI).toBe("gemini");
    expect(aiGradingProviderSchema.safeParse("mock").success).toBe(true);
    expect(aiGradingProviderSchema.safeParse("gemini").success).toBe(true);
    expect(aiGradingProviderSchema.safeParse("baseline").success).toBe(false);
    expect(aiProviderSchema.parse("gemini")).toBe("gemini");
  });

  it("validates price guidance and its ordered price range", () => {
    expect(priceGuidanceSchema.safeParse(guidance).success).toBe(true);
    expect(
      priceGuidanceSchema.safeParse({ ...guidance, degraded: true, provider: "http" }).success,
    ).toBe(true);
    expect(
      priceGuidanceSchema.safeParse({ ...guidance, provider: "baseline" }).success,
    ).toBe(true);
    expect(AIPriceProvider.MOCK).toBe("mock");
    expect(AIPriceProvider.BASELINE).toBe("baseline");
    expect(aiPriceProviderSchema.safeParse("mock").success).toBe(true);
    expect(aiPriceProviderSchema.safeParse("baseline").success).toBe(true);
    expect(aiPriceProviderSchema.safeParse("gemini").success).toBe(false);
    expect(aiProviderSchema.parse("baseline")).toBe("baseline");
    expect(priceGuidanceSchema.safeParse({ ...guidance, expectedPerKg: 800 }).success).toBe(false);
    expect(priceGuidanceSchema.safeParse({ ...guidance, highPerKg: 1.5 }).success).toBe(false);
    expect(priceTrendSchema.safeParse("FLAT").success).toBe(true);
    expect(priceTrendSchema.safeParse("SIDEWAYS").success).toBe(false);
  });

  it("validates the predict-price request and optional local selling cost", () => {
    const request = { cropId: id, grade: "A", quantityKg: 2.5 };
    expect(predictPriceRequestSchema.parse(request)).toEqual(request);
    expect(
      predictPriceRequestSchema.safeParse({ ...request, localSellingCostPerKg: 0 }).success,
    ).toBe(true);
    expect(predictPriceRequestSchema.safeParse({ ...request, cropId: "onion" }).success).toBe(
      false,
    );
    expect(
      predictPriceRequestSchema.safeParse({ ...request, localSellingCostPerKg: 1.2 }).success,
    ).toBe(false);
  });

  it("validates listing statuses, duration presets, and create-listing requests", () => {
    expect(listingStatusSchema.parse(ListingStatus.DRAFT)).toBe("DRAFT");
    expect(listingStatusSchema.safeParse("PENDING").success).toBe(false);
    expect(Object.values(LISTING_DURATION_PRESETS)).toEqual([60, 180, 360, 720, 1_440]);
    expect(DEMO_LISTING_DURATION_PRESET_MINUTES).toBe(2);
    expect(listingDurationMinutesSchema.safeParse(60).success).toBe(true);
    expect(listingDurationMinutesSchema.safeParse(2).success).toBe(true);
    expect(listingDurationMinutesSchema.safeParse(7).success).toBe(false);

    const request = {
      cropId: id,
      assessmentToken: "signed-token",
      quantityKg: 10,
      floorPricePerKg: 1_000,
      durationMinutes: 60,
      pickupNote: "Pickup from the farm gate",
    };
    expect(createListingRequestSchema.safeParse(request).success).toBe(true);
    expect(createListingRequestSchema.safeParse({ ...request, floorPricePerKg: 0 }).success).toBe(
      false,
    );
    expect(createListingRequestSchema.safeParse({ ...request, durationMinutes: 90 }).success).toBe(
      false,
    );
  });

  it("validates public config and listing image and response shapes", () => {
    expect(
      publicConfigSchema.safeParse({
        demoMode: true,
        durationPresets: LISTING_DURATION_PRESETS,
        platformFeeBps: 200,
      }).success,
    ).toBe(true);
    expect(publicConfigSchema.safeParse({ demoMode: "true" }).success).toBe(false);
    expect(
      publicConfigSchema.safeParse({
        demoMode: true,
        durationPresets: LISTING_DURATION_PRESETS,
        platformFeeBps: -10,
      }).success,
    ).toBe(false);
    expect(
      listingImageSchema.safeParse({
        url: "https://example.test/photo.jpg",
        width: 600,
        height: 400,
      }).success,
    ).toBe(true);
    expect(listingImageSchema.safeParse({ url: "/photo.jpg", width: 0, height: 400 }).success).toBe(
      false,
    );
    expect(farmerListingSchema.safeParse(listing).success).toBe(true);
    expect(
      farmerListingSchema.safeParse({
        ...listing,
        location: { division: "dhaka", district: "gazipur" },
      }).success,
    ).toBe(true);

    expect(farmerListingQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(farmerListingQuerySchema.parse({ status: "ACTIVE", page: "2", limit: "10" })).toEqual({
      status: "ACTIVE",
      page: 2,
      limit: 10,
    });
    expect(farmerListingQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(farmerListingQuerySchema.safeParse({ page: 0 }).success).toBe(false);

    const meta = { serverTime: "2026-11-04T00:00:00.000Z" };
    expect(listingResponseMetaSchema.safeParse(meta).success).toBe(true);
    expect(farmerListingResponseSchema.safeParse({ data: listing, meta }).success).toBe(true);
    expect(farmerListingResponseSchema.safeParse({ data: listing, meta: {} }).success).toBe(false);
    expect(
      farmerListingListResponseSchema.safeParse({
        data: [listing],
        meta: { ...meta, page: 1, limit: 20, total: 1 },
      }).success,
    ).toBe(true);
    expect(
      farmerListingListResponseSchema.safeParse({
        data: [listing],
        meta: { ...meta, page: 1, limit: 51, total: 1 },
      }).success,
    ).toBe(false);
  });

  it("validates relist-listing requests and relistedFromId on farmer listings", () => {
    const validRelist = {
      floorPricePerKg: 1200,
      durationMinutes: 180,
      pickupNote: "Relisted lot, farm gate pickup",
    };
    expect(relistListingRequestSchema.safeParse(validRelist).success).toBe(true);
    expect(
      relistListingRequestSchema.safeParse({ floorPricePerKg: 1200, durationMinutes: 180 }).success,
    ).toBe(true);
    expect(
      relistListingRequestSchema.safeParse({ ...validRelist, floorPricePerKg: 0 }).success,
    ).toBe(false);
    expect(
      relistListingRequestSchema.safeParse({ ...validRelist, durationMinutes: 45 }).success,
    ).toBe(false);

    expect(
      farmerListingSchema.safeParse({
        ...listing,
        relistedFromId: id,
      }).success,
    ).toBe(true);
  });

  it("defines the new AI error codes", () => {
    expect(aiErrorCodeSchema.parse(AIErrorCode.CROP_MISMATCH)).toBe("CROP_MISMATCH");
    expect(aiErrorCodeSchema.parse(AIErrorCode.GRADE_UNAVAILABLE)).toBe("GRADE_UNAVAILABLE");
    expect(aiErrorCodeSchema.parse(AIErrorCode.GRADE_STALE)).toBe("GRADE_STALE");
    expect(aiErrorCodeSchema.parse(AIErrorCode.DAILY_ASSESSMENT_LIMIT_EXCEEDED)).toBe(
      "DAILY_ASSESSMENT_LIMIT_EXCEEDED",
    );
    expect(aiErrorCodeSchema.safeParse("INTERNAL").success).toBe(false);
    expect(AIProvider.HTTP).toBe("http");
    expect(CropGrade.C).toBe("C");
    expect(ListingStatus.SOLD).toBe("SOLD");
  });
});
