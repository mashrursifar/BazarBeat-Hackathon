import type { CropResponse } from "@bazarbeat/shared";

import { Crop } from "./crop.model.js";
import { toCropResponse } from "./crop.mapper.js";

export async function listActiveCrops(): Promise<CropResponse[]> {
  const crops = await Crop.find({ isActive: true }).sort({ nameEn: 1 }).lean();
  return crops.map(toCropResponse);
}
