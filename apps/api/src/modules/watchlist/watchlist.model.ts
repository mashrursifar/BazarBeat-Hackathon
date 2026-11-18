import mongoose, { Schema, type Types } from "mongoose";

export interface WatchlistItemRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const watchlistItemSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    listingId: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound unique index ensuring idempotent saves and fast queries per user
watchlistItemSchema.index({ userId: 1, listingId: 1 }, { unique: true });
watchlistItemSchema.index({ userId: 1, createdAt: -1 });

export const WatchlistItem: mongoose.Model<WatchlistItemRecord> =
  mongoose.models.WatchlistItem
    ? (mongoose.models.WatchlistItem as mongoose.Model<WatchlistItemRecord>)
    : mongoose.model<WatchlistItemRecord>("WatchlistItem", watchlistItemSchema);
