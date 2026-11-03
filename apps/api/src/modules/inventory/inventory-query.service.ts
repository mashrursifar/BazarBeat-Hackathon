import { randomUUID } from "node:crypto";

import type {
  AddStockRequest,
  InventorySummaryItem,
  StockMovementQuery,
  StockMovementResponse,
} from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { Crop } from "../crops/crop.model.js";
import { toCropResponse } from "../crops/crop.mapper.js";
import { InventoryItem } from "./inventory-item.model.js";
import { toInventorySummaryItem, toStockMovementResponse } from "./inventory.mapper.js";
import { addStock } from "./inventory.service.js";
import { StockMovement } from "./stock-movement.model.js";

export interface StockMovementPage {
  items: StockMovementResponse[];
  total: number;
}

export async function getFarmerInventory(farmerId: string): Promise<InventorySummaryItem[]> {
  const [crops, inventory] = await Promise.all([
    Crop.find({ isActive: true }).sort({ nameEn: 1 }).lean(),
    InventoryItem.find({ farmerId }).lean(),
  ]);
  const inventoryByCropId = new Map(inventory.map((item) => [String(item.cropId), item]));
  return crops.map((crop) => {
    const cropResponse = toCropResponse(crop);
    return toInventorySummaryItem(cropResponse, inventoryByCropId.get(cropResponse.id));
  });
}

export async function addFarmerStock(farmerId: string, input: AddStockRequest): Promise<InventorySummaryItem> {
  const crop = await Crop.findOne({ _id: input.cropId, isActive: true }).lean();
  if (crop === null) throw new AppError(404, "NOT_FOUND", "Active crop was not found");
  await addStock({
    farmerId,
    cropId: input.cropId,
    quantityKg: input.quantityKg,
    operationId: randomUUID(),
    ...(input.note === undefined ? {} : { note: input.note }),
  });
  const inventory = await InventoryItem.findOne({ farmerId, cropId: input.cropId }).lean();
  return toInventorySummaryItem(toCropResponse(crop), inventory ?? undefined);
}

export async function getFarmerStockMovements(
  farmerId: string,
  query: StockMovementQuery,
): Promise<StockMovementPage> {
  const filter = { farmerId, cropId: query.cropId };
  const skip = (query.page - 1) * query.limit;
  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);
  return { items: movements.map(toStockMovementResponse), total };
}
