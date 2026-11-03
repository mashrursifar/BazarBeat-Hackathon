import mongoose, { type InferSchemaType } from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", required: true },
    availableKg: { type: Number, required: true, min: 0, default: 0 },
    listedKg: { type: Number, required: true, min: 0, default: 0 },
    soldKg: { type: Number, required: true, min: 0, default: 0 },
    pendingMovementId: { type: String },
  },
  { timestamps: true, collection: "inventory_items", versionKey: false },
);

inventoryItemSchema.index({ farmerId: 1, cropId: 1 }, { unique: true });

export type InventoryItemRecord = InferSchemaType<typeof inventoryItemSchema>;
export const InventoryItem = mongoose.models.InventoryItem
  ? mongoose.model<InventoryItemRecord>("InventoryItem")
  : mongoose.model<InventoryItemRecord>("InventoryItem", inventoryItemSchema);
