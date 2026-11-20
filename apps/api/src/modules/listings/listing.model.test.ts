import { describe, expect, it } from "vitest";
import { ObjectId } from "bson";
import { AIProvider, CropGrade, ListingStatus } from "@bazarbeat/shared";

import { Listing } from "./listing.model.js";

describe("Listing Model Schema Validation", () => {
  const baseListingData = {
    farmerId: new ObjectId("507f1f77bcf86cd799439011"),
    cropId: new ObjectId("507f1f77bcf86cd799439022"),
    quantityKg: 100,
    images: [{ url: "/uploads/img.jpg", width: 800, height: 600 }],
    aiAssessment: {
      grade: CropGrade.A,
      confidence: 0.95,
      confidenceBand: "HIGH",
      classProbabilities: { A: 0.95, B: 0.03, C: 0.02 },
      qualityNotes: [{ code: "GRADE_A_PREMIUM" }],
      cropMatch: true,
      modelVersion: "gemini-3.1-flash-lite",
      provider: AIProvider.GEMINI,
      degraded: false,
      assessedAt: new Date(),
      imageHashes: ["hash1"],
    },
    aiPriceGuidance: {
      lowPerKg: 3500,
      expectedPerKg: 4200,
      highPerKg: 5000,
      trend: "UP",
      confidence: 0.88,
      explanation: [{ code: "SEASONAL_TREND", factor: 1.1, message: "Peak season" }],
      modelVersion: "seasonal-baseline-v1",
      provider: AIProvider.BASELINE,
      degraded: false,
      generatedAt: new Date(),
      suggestedFloorPerKg: 3500,
    },
    floorPricePerKg: 3600,
    minIncrementPerKg: 100,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 3600000),
    originalEndsAt: new Date(Date.now() + 3600000),
    extensionCount: 0,
    status: ListingStatus.ACTIVE,
    bidCount: 0,
    location: {
      division: "Dhaka",
      district: "Gazipur",
      upazila: "Sreepur",
    },
  };

  it("successfully validates Listing document with gemini assessment and baseline price guidance", () => {
    const doc = new Listing(baseListingData);
    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it("successfully validates Listing document with mock assessment and mock price guidance", () => {
    const doc = new Listing({
      ...baseListingData,
      aiAssessment: {
        ...baseListingData.aiAssessment,
        provider: AIProvider.MOCK,
      },
      aiPriceGuidance: {
        ...baseListingData.aiPriceGuidance,
        provider: AIProvider.MOCK,
      },
    });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it("rejects invalid aiAssessment provider", () => {
    const doc = new Listing({
      ...baseListingData,
      aiAssessment: {
        ...baseListingData.aiAssessment,
        provider: "unknown-provider" as never,
      },
    });
    const error = doc.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["aiAssessment.provider"]).toBeDefined();
  });

  it("rejects invalid aiPriceGuidance provider", () => {
    const doc = new Listing({
      ...baseListingData,
      aiPriceGuidance: {
        ...baseListingData.aiPriceGuidance,
        provider: "unknown-provider" as never,
      },
    });
    const error = doc.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["aiPriceGuidance.provider"]).toBeDefined();
  });
});
