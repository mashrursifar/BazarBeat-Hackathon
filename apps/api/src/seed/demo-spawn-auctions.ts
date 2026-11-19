import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load environment variables from repo root or package root before inspection
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnv = path.resolve(scriptDir, "../../../../.env");
if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
}
const apiEnv = path.resolve(scriptDir, "../../.env");
if (fs.existsSync(apiEnv)) {
  dotenv.config({ path: apiEnv });
}
dotenv.config();

const { default: mongoose } = await import("mongoose");
const { logger } = await import("../shared/logger.js");
const { assertAllowDemoSeed, spawnDemoAuctions } = await import("./demo-seeder.js");

async function run(): Promise<void> {
  try {
    assertAllowDemoSeed();

    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/BazarBeat";
    await mongoose.connect(mongoUri);
    logger.info("Connected to MongoDB for demo auction spawning");

    const result = await spawnDemoAuctions();
    logger.info(
      {
        spawnedCount: result.listings.length,
        bidsCount: result.bidsCount,
      },
      "Demo auction spawning completed successfully",
    );
  } catch (error: unknown) {
    logger.error({ err: error }, "Demo auction spawn failed");
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

void run();
