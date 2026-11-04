import mongoose, { type InferSchemaType } from "mongoose";

import { MarketPriceSource } from "@bazarbeat/shared";

const marketPriceSchema = new mongoose.Schema(
  {
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", required: true },
    division: { type: String, required: true, trim: true, lowercase: true },
    date: { type: Date, required: true },
    avgPricePerKg: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Average price must be integer poisha" },
    },
    minPricePerKg: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Minimum price must be integer poisha" },
    },
    maxPricePerKg: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Maximum price must be integer poisha" },
    },
    source: { type: String, enum: Object.values(MarketPriceSource), required: true },
  },
  { timestamps: true, collection: "market_prices", versionKey: false },
);

marketPriceSchema.index({ cropId: 1, division: 1, date: -1 });
marketPriceSchema.index({ cropId: 1, division: 1, date: 1, source: 1 }, { unique: true });

marketPriceSchema.pre("validate", function () {
  if (this.minPricePerKg > this.avgPricePerKg) {
    this.invalidate("minPricePerKg", "Minimum price cannot exceed average price");
  }
  if (this.avgPricePerKg > this.maxPricePerKg) {
    this.invalidate("maxPricePerKg", "Maximum price cannot be below average price");
  }
});

export type MarketPriceRecord = InferSchemaType<typeof marketPriceSchema>;
export const MarketPrice = mongoose.models.MarketPrice
  ? mongoose.model<MarketPriceRecord>("MarketPrice")
  : mongoose.model<MarketPriceRecord>("MarketPrice", marketPriceSchema);
