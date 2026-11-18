import mongoose, { type InferSchemaType } from "mongoose";
import {
  CropGrade,
  ListingStatus,
  type PriceExplanation,
  type QualityNote,
} from "@bazarbeat/shared";

const listingImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const classProbabilitiesSchema = new mongoose.Schema(
  {
    A: { type: Number, required: true, min: 0, max: 1 },
    B: { type: Number, required: true, min: 0, max: 1 },
    C: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const listingAiAssessmentSchema = new mongoose.Schema(
  {
    grade: { type: String, enum: Object.values(CropGrade), required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    confidenceBand: { type: String, enum: ["HIGH", "MEDIUM", "LOW"] },
    classProbabilities: { type: classProbabilitiesSchema, required: true },
    qualityNotes: { type: [mongoose.Schema.Types.Mixed], required: true },
    cropMatch: { type: Boolean, required: true },
    modelVersion: { type: String, required: true },
    provider: { type: String, enum: ["mock", "http"], required: true },
    degraded: { type: Boolean, default: false, required: true },
    assessedAt: { type: Date, required: true },
    imageHashes: { type: [String], required: true },
  },
  { _id: false },
);

const listingAiPriceGuidanceSchema = new mongoose.Schema(
  {
    lowPerKg: { type: Number, required: true, min: 1 },
    expectedPerKg: { type: Number, required: true, min: 1 },
    highPerKg: { type: Number, required: true, min: 1 },
    trend: { type: String, enum: ["UP", "FLAT", "DOWN"], required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    explanation: { type: [mongoose.Schema.Types.Mixed], required: true },
    modelVersion: { type: String, required: true },
    provider: { type: String, enum: ["mock", "http"], required: true },
    degraded: { type: Boolean, default: false, required: true },
    generatedAt: { type: Date, required: true },
    suggestedFloorPerKg: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const listingLocationSchema = new mongoose.Schema(
  {
    division: { type: String, required: true },
    district: { type: String, required: true },
    upazila: { type: String },
  },
  { _id: false },
);

const listingSchema = new mongoose.Schema(
  {
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", required: true, index: true },
    quantityKg: {
      type: Number,
      required: true,
      min: 0.1,
      validate: {
        validator: (value: number): boolean => Number.isInteger(value * 10),
        message: "Quantity must have at most one decimal place",
      },
    },
    images: { type: [listingImageSchema], required: true },
    aiAssessment: { type: listingAiAssessmentSchema, required: true },
    aiPriceGuidance: { type: listingAiPriceGuidanceSchema, required: true },
    floorPricePerKg: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Floor price must be integer poisha" },
    },
    buyNowPricePerKg: {
      type: Number,
      validate: { validator: Number.isInteger, message: "Buy-now price must be integer poisha" },
    },
    minIncrementPerKg: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
      validate: { validator: Number.isInteger, message: "Min increment must be integer poisha" },
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    originalEndsAt: { type: Date, required: true },
    extensionCount: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: Object.values(ListingStatus),
      default: ListingStatus.ACTIVE,
      required: true,
      index: true,
    },
    currentBidPerKg: {
      type: Number,
      validate: { validator: Number.isInteger, message: "Current bid must be integer poisha" },
    },
    currentBidderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    bidCount: { type: Number, required: true, default: 0, min: 0 },
    winningBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid" },
    location: { type: listingLocationSchema, required: true },
    pickupNote: { type: String, maxlength: 500 },
    closedAt: { type: Date },
    relistedFromId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    relistedToListingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
  },
  { timestamps: true, collection: "listings", versionKey: false },
);

// Indexes defined in DATA_MODEL.md
listingSchema.index({ status: 1, endsAt: 1 });
listingSchema.index({ status: 1, cropId: 1, "location.division": 1 });
listingSchema.index({ status: 1, cropId: 1, "location.division": 1, "location.district": 1 });
listingSchema.index({ status: 1, "aiAssessment.grade": 1, endsAt: 1 });
listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ farmerId: 1, status: 1 });
listingSchema.index({ farmerId: 1, status: 1, endsAt: 1 });

export type ListingRecord = Omit<
  InferSchemaType<typeof listingSchema>,
  "aiAssessment" | "aiPriceGuidance"
> & {
  aiAssessment: Omit<InferSchemaType<typeof listingAiAssessmentSchema>, "qualityNotes"> & {
    qualityNotes: QualityNote[];
  };
  aiPriceGuidance: Omit<InferSchemaType<typeof listingAiPriceGuidanceSchema>, "explanation"> & {
    explanation: PriceExplanation[];
  };
};
export const Listing = mongoose.models.Listing
  ? mongoose.model<ListingRecord>("Listing")
  : mongoose.model<ListingRecord>("Listing", listingSchema);
