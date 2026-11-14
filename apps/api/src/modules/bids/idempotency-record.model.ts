import mongoose, { type InferSchemaType } from "mongoose";

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      maxlength: 128,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      required: true,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    collection: "idempotency_records",
    versionKey: false,
  },
);

idempotencyRecordSchema.index({ key: 1, userId: 1 }, { unique: true });

export type IdempotencyRecordDoc = InferSchemaType<typeof idempotencyRecordSchema>;
export const IdempotencyRecord = mongoose.models.IdempotencyRecord
  ? mongoose.model<IdempotencyRecordDoc>("IdempotencyRecord")
  : mongoose.model<IdempotencyRecordDoc>("IdempotencyRecord", idempotencyRecordSchema);

