import {
  type BuyerListingCard,
  type FarmerListing,
  ListingStatus,
  calculateSubtotal,
} from "@bazarbeat/shared";
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

export interface RawMarketplaceListingDoc {
  _id: { toString(): string };
  cropId: { toString(): string };
  cropDoc: {
    _id: { toString(): string };
    slug: string;
    nameEn: string;
    nameBn: string;
    unit?: string;
  };
  aiAssessment: {
    grade: "A" | "B" | "C";
  };
  aiPriceGuidance?: {
    expectedPerKg?: number;
  };
  quantityKg: number;
  floorPricePerKg: number;
  currentBidPerKg?: number | null;
  displayPricePerKg?: number;
  minIncrementPerKg?: number;
  bidCount: number;
  startsAt: Date | string;
  endsAt: Date | string;
  status: "ACTIVE";
  location: {
    division: string;
    district: string;
    upazila?: string;
  };
  images?: Array<{ url: string; width: number; height: number }>;
}

/**
 * Maps a raw aggregated listing record to a buyer-facing listing card DTO.
 * Strictly excludes private fields (farmer identity, phone, pickup note, AI internals).
 */
export function mapListingToBuyerCard(doc: RawMarketplaceListingDoc): BuyerListingCard {
  const displayPricePerKg =
    doc.displayPricePerKg ??
    (doc.bidCount > 0 && doc.currentBidPerKg != null
      ? doc.currentBidPerKg
      : doc.floorPricePerKg);

  const totalDisplayCost = calculateSubtotal(displayPricePerKg, doc.quantityKg);

  const card: BuyerListingCard = {
    id: doc._id.toString(),
    cropId: doc.cropId.toString(),
    crop: {
      id: doc.cropDoc._id.toString(),
      slug: doc.cropDoc.slug,
      nameEn: doc.cropDoc.nameEn,
      nameBn: doc.cropDoc.nameBn,
      unit: doc.cropDoc.unit ?? "kg",
    },
    grade: doc.aiAssessment.grade,
    quantityKg: doc.quantityKg,
    floorPricePerKg: doc.floorPricePerKg,
    currentBidPerKg: doc.currentBidPerKg ?? null,
    displayPricePerKg,
    totalDisplayCost,
    minIncrementPerKg: doc.minIncrementPerKg ?? 100,
    hasBids: doc.bidCount > 0,
    bidCount: doc.bidCount,
    startsAt:
      doc.startsAt instanceof Date
        ? doc.startsAt.toISOString()
        : new Date(doc.startsAt).toISOString(),
    endsAt:
      doc.endsAt instanceof Date
        ? doc.endsAt.toISOString()
        : new Date(doc.endsAt).toISOString(),
    status: ListingStatus.ACTIVE,
    location: {
      division: doc.location.division,
      district: doc.location.district,
    },
    thumbnailUrl: doc.images?.[0]?.url ?? null,
    images: doc.images?.map((img) => ({
      url: img.url,
      width: img.width,
      height: img.height,
    })),
  };

  if (doc.aiPriceGuidance?.expectedPerKg !== undefined) {
    card.aiExpectedPricePerKg = doc.aiPriceGuidance.expectedPerKg;
  }

  return card;
}

