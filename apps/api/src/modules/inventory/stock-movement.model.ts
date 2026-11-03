import mongoose, { type InferSchemaType } from "mongoose";

import { StockMovementStatus, StockMovementType } from "@bazarbeat/shared";

const stockMovementSchema = new mongoose.Schema(
  {
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", required: true },
    type: { type: String, enum: Object.values(StockMovementType), required: true },
    quantityKg: {
      type: Number,
      required: true,
      min: 0.1,
      validate: { validator: (value: number): boolean => Number.isInteger(value * 10), message: "Quantity must have at most one decimal place" },
    },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    operationId: { type: String, required: true, unique: true },
    status: { type: String, enum: Object.values(StockMovementStatus), required: true },
    note: { type: String, maxlength: 200 },
  },
  { timestamps: true, collection: "stock_movements", versionKey: false },
);

stockMovementSchema.index({ farmerId: 1, cropId: 1, createdAt: 1 });

export type StockMovementRecord = InferSchemaType<typeof stockMovementSchema>;
export const StockMovement = mongoose.models.StockMovement
  ? mongoose.model<StockMovementRecord>("StockMovement")
  : mongoose.model<StockMovementRecord>("StockMovement", stockMovementSchema);
