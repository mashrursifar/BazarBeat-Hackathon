import mongoose from "mongoose";

import { env } from "../config/env.js";
import { Crop } from "../modules/crops/crop.model.js";
import { seedCropCatalog } from "../modules/crops/crop-seed.js";
import { logger } from "../shared/logger.js";

async function run(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    await Crop.updateOne({ slug: "tomato" }, { $set: { isActive: false } });
    await seedCropCatalog(async (crop) => {
      await Crop.updateOne({ slug: crop.slug }, { $set: crop }, { upsert: true });
    });
    logger.info({ count: 5 }, "Crop catalog seed complete");
  } catch (error: unknown) {
    logger.error({ err: error }, "Crop catalog seed failed");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void run();
