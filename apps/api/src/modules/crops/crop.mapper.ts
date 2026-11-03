import { type CropResponse, cropResponseSchema } from "@bazarbeat/shared";
import { Types } from "mongoose";

import type { CropRecord } from "./crop.model.js";

type CropView = Pick<
  CropRecord,
  | "slug"
  | "nameEn"
  | "nameBn"
  | "unit"
  | "minLotKg"
  | "maxLotKg"
  | "shelfLifeHours"
  | "gradeGuide"
  | "minIncrementPerKg"
  | "imageUrl"
> & { _id: Types.ObjectId };

export function toCropResponse(crop: CropView): CropResponse {
  return cropResponseSchema.parse({
    id: crop._id.toString(),
    slug: crop.slug,
    nameEn: crop.nameEn,
    nameBn: crop.nameBn,
    unit: crop.unit,
    minLotKg: crop.minLotKg,
    maxLotKg: crop.maxLotKg,
    shelfLifeHours: crop.shelfLifeHours,
    gradeGuide: crop.gradeGuide,
    minIncrementPerKg: crop.minIncrementPerKg,
    imageUrl: crop.imageUrl,
  });
}
