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
