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
const { assertAllowDemoSeed, seedDemo } = await import("./demo-seeder.js");

async function run(): Promise<void> {
  const isReset = process.argv.includes("--reset");
  const operationName = isReset ? "demo:reset" : "seed:demo";

  try {
    assertAllowDemoSeed();

    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/BazarBeat";
    await mongoose.connect(mongoUri);
    logger.info({ operationName }, "Connected to MongoDB for demo seeding");

    const startTime = Date.now();
    const result = await seedDemo();
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    const timingNote = isReset
      ? `\nDemo Reset Timing: ${elapsedSeconds}s (requirement: under 30 seconds)`
      : `\nDemo Seed Timing: ${elapsedSeconds}s`;

    process.stdout.write(timingNote + "\n\n");
    logger.info(
      {
        operationName,
        farmerCount: result.farmers.length,
        buyerCount: result.buyers.length,
        listingCount: result.listings.length,
        bidsCount: result.bidsCount,
        elapsedSeconds,
      },
      "Demo seed completed successfully",
    );
  } catch (error: unknown) {
    logger.error({ err: error, operationName }, "Demo seed operation failed");
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

void run();
