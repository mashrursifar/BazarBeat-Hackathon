import {
  type CropResponse,
  type InventorySummaryItem,
  type StockMovementResponse,
  inventorySummaryItemSchema,
  stockMovementResponseSchema,
} from "@bazarbeat/shared";
import { Types } from "mongoose";

import type { InventoryItemRecord } from "./inventory-item.model.js";
import type { StockMovementRecord } from "./stock-movement.model.js";

type InventoryView = Pick<InventoryItemRecord, "availableKg" | "listedKg" | "soldKg">;
type MovementView = StockMovementRecord & { _id: Types.ObjectId; createdAt: Date };

export function toInventorySummaryItem(crop: CropResponse, inventory?: InventoryView): InventorySummaryItem {
  return inventorySummaryItemSchema.parse({
    crop,
    availableKg: inventory?.availableKg ?? 0,
    listedKg: inventory?.listedKg ?? 0,
    soldKg: inventory?.soldKg ?? 0,
  });
}

export function toStockMovementResponse(movement: MovementView): StockMovementResponse {
  return stockMovementResponseSchema.parse({
    id: movement._id.toString(),
    farmerId: String(movement.farmerId),
    cropId: String(movement.cropId),
    type: movement.type,
    quantityKg: movement.quantityKg,
    ...(movement.listingId == null ? {} : { listingId: String(movement.listingId) }),
    ...(movement.orderId == null ? {} : { orderId: String(movement.orderId) }),
    ...(movement.note == null ? {} : { note: movement.note }),
    createdAt: movement.createdAt.toISOString(),
  });
}
