import mongoose, { type InferSchemaType } from "mongoose";
import { type QualityNote } from "@bazarbeat/shared";

const assessmentImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    hash: { type: String, required: true },
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

const aiAssessmentRecordSchema = new mongoose.Schema(
  {
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", required: true, index: true },
    assessmentTokenHash: { type: String, required: true, unique: true },
    grade: { type: String, enum: ["A", "B", "C"], required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    confidenceBand: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], required: true },
    classProbabilities: { type: classProbabilitiesSchema, required: true },
    qualityNotes: { type: [mongoose.Schema.Types.Mixed], required: true },
    cropMatch: { type: Boolean, required: true },
    modelVersion: { type: String, required: true },
    provider: { type: String, enum: ["mock", "http"], required: true },
    degraded: { type: Boolean, default: false, required: true },
    assessedAt: { type: Date, default: Date.now, required: true },
    images: { type: [assessmentImageSchema], required: true },
    imageHashes: { type: [String], required: true },
    isConsumed: { type: Boolean, default: false, required: true, index: true },
    consumedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: "ai_assessment_records", versionKey: false },
);

aiAssessmentRecordSchema.index({ farmerId: 1, createdAt: -1 });

export type AiAssessmentRecordDoc = Omit<
  InferSchemaType<typeof aiAssessmentRecordSchema>,
  "qualityNotes"
> & {
  qualityNotes: QualityNote[];
};
export const AiAssessmentRecord = mongoose.models.AiAssessmentRecord
  ? mongoose.model<AiAssessmentRecordDoc>("AiAssessmentRecord")
  : mongoose.model<AiAssessmentRecordDoc>("AiAssessmentRecord", aiAssessmentRecordSchema);
