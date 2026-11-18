import { app } from "./app.js";
import { env } from "./config/env.js";
import {
  runStartupCatchUp,
  startScheduler,
  stopScheduler,
} from "./modules/auctions/scheduler.service.js";
import { registerNotificationSubscribers } from "./modules/notifications/notification.subscribers.js";
import { connectDatabase } from "./shared/db.js";
import { logger } from "./shared/logger.js";

// Register notification subscribers for domain events (Task 8.2)
registerNotificationSubscribers();

const server = app.listen(env.PORT, () =>

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
    startScheduler();
  })
  .catch((error: unknown) => {
    logger.warn(
      { err: error },
      "Database connection unavailable; health endpoint will report disconnected",
    );
  });

function shutdown(): void {
  logger.info("Gracefully shutting down BazarBeat API server...");
  stopScheduler();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
