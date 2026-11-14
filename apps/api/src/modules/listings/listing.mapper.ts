import type { FarmerListing } from "@bazarbeat/shared";
import type { ListingRecord } from "./listing.model.js";

export function mapListingToFarmerListing(
  listing: ListingRecord & { _id: { toString(): string }; createdAt: Date },
): FarmerListing {
  const doc: FarmerListing = {
    id: listing._id.toString(),
    cropId: listing.cropId.toString(),
    quantityKg: listing.quantityKg,
    images: listing.images.map((img) => ({
      url: img.url,
      width: img.width,
      height: img.height,
    })),
    aiAssessment: {
      grade: listing.aiAssessment.grade as "A" | "B" | "C",
      confidence: listing.aiAssessment.confidence,
      confidenceBand: listing.aiAssessment.confidenceBand as "HIGH" | "MEDIUM" | "LOW" | undefined,
      classProbabilities: {
        A: listing.aiAssessment.classProbabilities.A,
        B: listing.aiAssessment.classProbabilities.B,
        C: listing.aiAssessment.classProbabilities.C,
      },
      qualityNotes: [...listing.aiAssessment.qualityNotes],
      cropMatch: listing.aiAssessment.cropMatch,
      modelVersion: listing.aiAssessment.modelVersion,
      provider: listing.aiAssessment.provider as "mock" | "http",
      degraded: listing.aiAssessment.degraded,
      assessedAt: listing.aiAssessment.assessedAt.toISOString(),
    },
    aiPriceGuidance: {
      lowPerKg: listing.aiPriceGuidance.lowPerKg,
      expectedPerKg: listing.aiPriceGuidance.expectedPerKg,
      highPerKg: listing.aiPriceGuidance.highPerKg,
      trend: listing.aiPriceGuidance.trend as "UP" | "FLAT" | "DOWN",
      confidence: listing.aiPriceGuidance.confidence,
      explanation: [...listing.aiPriceGuidance.explanation],
      modelVersion: listing.aiPriceGuidance.modelVersion,
      provider: listing.aiPriceGuidance.provider as "mock" | "http",
      degraded: listing.aiPriceGuidance.degraded,
      generatedAt: listing.aiPriceGuidance.generatedAt.toISOString(),
      suggestedFloorPerKg: listing.aiPriceGuidance.suggestedFloorPerKg,
    },
    floorPricePerKg: listing.floorPricePerKg,
    minIncrementPerKg: listing.minIncrementPerKg,
    startsAt: listing.startsAt.toISOString(),
    endsAt: listing.endsAt.toISOString(),
    originalEndsAt: listing.originalEndsAt.toISOString(),
    extensionCount: listing.extensionCount,
    status: listing.status as "DRAFT" | "ACTIVE" | "SOLD" | "EXPIRED_UNSOLD" | "CANCELLED",
    bidCount: listing.bidCount,
    createdAt: listing.createdAt.toISOString(),
  };

  if (listing.currentBidPerKg !== undefined && listing.currentBidPerKg !== null) {
    doc.currentBidPerKg = listing.currentBidPerKg;
  }
  if (listing.location) {
    doc.location = {
      division: listing.location.division,
      district: listing.location.district,
      ...(listing.location.upazila ? { upazila: listing.location.upazila } : {}),
    };
  }
  if (listing.pickupNote) {
    doc.pickupNote = listing.pickupNote;
  }
  if (listing.closedAt) {
    doc.closedAt = listing.closedAt.toISOString();
  }
  if (listing.relistedFromId) {
    doc.relistedFromId = listing.relistedFromId.toString();
  }

  return doc;
}
