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

if (process.env.NODE_ENV === "production") {
  process.stderr.write(
    "Error: Refusing to run seed:dev-listings in production environment (NODE_ENV=production).\n",
  );
  process.exit(1);
}

// Dynamically import application services only in non-production environments
const { default: mongoose } = await import("mongoose");
const { logger } = await import("../shared/logger.js");
const { seedDevListings } = await import("./dev-listings.js");

async function run(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/BazarBeat";

    await mongoose.connect(mongoUri);
    logger.info("Connected to MongoDB for dev listings seeding");

    const result = await seedDevListings();
    logger.info(
      {
        farmerCount: result.farmers.length,
        buyerCount: result.buyers.length,
        listingCount: result.listings.length,
        bidsCount: result.bidsCount,
      },
      "Dev listing seeder completed successfully",
    );
  } catch (error: unknown) {
    logger.error({ err: error }, "Dev listing seeder failed");
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

void run();
