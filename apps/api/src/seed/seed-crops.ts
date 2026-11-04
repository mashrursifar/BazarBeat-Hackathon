import mongoose from "mongoose";

import { env } from "../config/env.js";
import { Crop } from "../modules/crops/crop.model.js";
import { CROP_SEED_DATA } from "../modules/crops/crop-seed-data.js";
import { seedCropCatalog } from "../modules/crops/crop-seed.js";
import { seedMarketPriceHistory } from "../modules/market-prices/market-price-seed.js";
import { logger } from "../shared/logger.js";

async function run(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    await Crop.updateOne({ slug: "tomato" }, { $set: { isActive: false } });
    await seedCropCatalog(async (crop) => {
      await Crop.updateOne({ slug: crop.slug }, { $set: crop }, { upsert: true });
    });
    const crops = await Crop.find({ slug: { $in: CROP_SEED_DATA.map(({ slug }) => slug) } })
      .select("_id slug")
      .lean();
    if (crops.length !== CROP_SEED_DATA.length)
      throw new Error("Crop catalog is incomplete; cannot seed market prices");
    const marketPriceCount = await seedMarketPriceHistory(
      crops.map(({ _id, slug }) => ({ id: _id, slug })),
      new Date(),
    );

    logger.info(
      { cropCount: crops.length, marketPriceCount },
      "Crop and market price seed complete",
    );
  } catch (error: unknown) {
    logger.error({ err: error }, "Crop catalog seed failed");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
