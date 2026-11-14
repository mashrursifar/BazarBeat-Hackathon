import mongoose, { type InferSchemaType } from "mongoose";
import { BidStatus } from "@bazarbeat/shared";

const bidSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amountPerKg: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Bid amount must be an integer in poisha",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Total amount must be an integer in poisha",
      },
    },
    seq: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Bid seq must be a positive integer",
      },
    },
    status: {
      type: String,
      enum: Object.values(BidStatus),
      default: BidStatus.ACCEPTED,
      required: true,
    },
    placedAt: {
      type: Date,
      required: true,
    },
    idempotencyKey: {
      type: String,
      maxlength: 128,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "bids",
    versionKey: false,
  },
);

// Indexes defined in DATA_MODEL.md and AUCTION_RULES §4-5
bidSchema.index({ listingId: 1, seq: 1 }, { unique: true });
bidSchema.index({ listingId: 1, amountPerKg: -1 });
bidSchema.index({ buyerId: 1, placedAt: -1 });
bidSchema.index(
  { listingId: 1, buyerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);

// Append-only invariant enforcement: Individual bids are never deleted or rewritten
bidSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function (next) {
    next(new Error("Bids are append-only and cannot be deleted"));
  },
);

bidSchema.pre(
  ["deleteOne", "findOneAndDelete"],
  { document: false, query: true },
  function (next) {
    next(new Error("Bids are append-only and cannot be deleted"));
  },
);

export type BidRecord = InferSchemaType<typeof bidSchema>;
export const Bid = mongoose.models.Bid
  ? mongoose.model<BidRecord>("Bid")
  : mongoose.model<BidRecord>("Bid", bidSchema);
