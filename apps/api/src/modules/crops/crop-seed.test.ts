import { describe, expect, it } from "vitest";

import { Crop } from "./crop.model.js";
import { CROP_SEED_DATA } from "./crop-seed-data.js";
import { seedCropCatalog } from "./crop-seed.js";

describe("Crop model and catalog seed", () => {
  it("enforces unique slugs and defaults the minimum increment to 100 poisha", () => {
    const indexes = Crop.schema.indexes();
    const slugIndex = indexes.find(([keys]) => "slug" in keys);
    const crop = new Crop({
      slug: "bitter-gourd",
      nameEn: "Bitter Gourd",
      nameBn: "করলা",
      minLotKg: 1,
      maxLotKg: 10,
      shelfLifeHours: 24,
      gradeGuide: { A: "A", B: "B", C: "C" },
      imageUrl: "/images/crops/placeholder.svg",
    });

    expect(slugIndex?.[1].unique).toBe(true);
    expect(crop.minIncrementPerKg).toBe(100);
  });

  it("upserts the same five crops on repeated runs without duplicates", async () => {
    const stored = new Map<string, (typeof CROP_SEED_DATA)[number]>();
    const upsert = async (crop: (typeof CROP_SEED_DATA)[number]): Promise<void> => {
      stored.set(crop.slug, crop);
    };

    await seedCropCatalog(upsert);
    await seedCropCatalog(upsert);

    expect(stored.size).toBe(5);
    expect([...stored.keys()].sort()).toEqual(["bitter-gourd", "eggplant", "green-chilli", "onion", "potato"]);
    expect(CROP_SEED_DATA).toHaveLength(5);
  });
});
