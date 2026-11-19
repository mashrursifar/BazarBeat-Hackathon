import type { Server } from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import {
  runStartupCatchUp,
  startScheduler,
} from "./modules/auctions/scheduler.service.js";
import { registerNotificationSubscribers } from "./modules/notifications/notification.subscribers.js";
import { connectDatabase } from "./shared/db.js";
import { logger } from "./shared/logger.js";
import { performGracefulShutdown } from "./shared/shutdown.js";

export { performGracefulShutdown };

// Register notification subscribers for domain events (Task 8.2)
registerNotificationSubscribers();

export const server: Server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "BazarBeat API listening"),
);

void connectDatabase()
  .then(async () => {
    logger.info("Database connected; executing startup catch-up for expired auctions");
    try {
      await runStartupCatchUp();
    } catch (catchUpError: unknown) {
      logger.error({ err: catchUpError }, "Error occurred during startup catch-up pass");
    }

    try {
      const { Crop } = await import("./modules/crops/crop.model.js");
      const cropCount = await Crop.countDocuments();
      if (cropCount === 0) {
        logger.info("Crop catalog is empty; seeding base crop catalog");
        const { seedCropCatalog } = await import("./modules/crops/crop-seed.js");
        await seedCropCatalog(async (crop) => {
          await Crop.updateOne({ slug: crop.slug }, { $set: crop }, { upsert: true });
        });
      }

      if (env.NODE_ENV !== "production") {
        const { Listing } = await import("./modules/listings/listing.model.js");
        const { ListingStatus } = await import("@bazarbeat/shared");
        const activeCount = await Listing.countDocuments({
          status: ListingStatus.ACTIVE,
          endsAt: { $gt: new Date() },
        });
        if (activeCount === 0) {
          logger.info("No active listings found in development; auto-seeding fresh dev listings");
          const { seedDevListings } = await import("./seed/dev-listings.js");
          await seedDevListings({ silent: true, history: false });
          logger.info("Auto-seeded active dev listings successfully");
        }
      }
    } catch (startupSeedError: unknown) {
      logger.warn({ err: startupSeedError }, "Optional startup seeding did not run");
    }

    startScheduler();
  })
  .catch((error: unknown) => {
    logger.warn(
      { err: error },
      "Database connection unavailable; health endpoint will report disconnected",
    );
  });

let isShuttingDown = false;
function onSignal(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Received termination signal");
  void performGracefulShutdown(server, { exitProcess: true });
}

process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));
