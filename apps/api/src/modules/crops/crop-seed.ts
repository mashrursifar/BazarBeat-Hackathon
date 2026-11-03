import { CROP_SEED_DATA, type CropSeed } from "./crop-seed-data.js";

export type CropUpsert = (crop: CropSeed) => Promise<unknown>;

export async function seedCropCatalog(upsertCrop: CropUpsert): Promise<void> {
  for (const crop of CROP_SEED_DATA) {
    await upsertCrop(crop);
  }
}
