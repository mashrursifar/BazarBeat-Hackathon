import type { Server } from "node:http";
import mongoose from "mongoose";

import { stopScheduler } from "../modules/auctions/scheduler.service.js";
import { getListingStreamHub } from "../modules/realtime/sse-hub.js";
import { getUserStreamHub } from "../modules/realtime/user-stream-hub.js";
import { logger } from "./logger.js";

export interface GracefulShutdownOptions {
  exitProcess?: boolean;
  timeoutMs?: number;
}

/**
 * Performs graceful shutdown of all server resources:
 * 1. Stops background auction and order timers (scheduler)
 * 2. Terminates and cleans up all active SSE streams (listing and user hubs)
 * 3. Closes HTTP server to stop receiving new traffic
 * 4. Disconnects database connection cleanly
 */
export async function performGracefulShutdown(
  httpServer?: Server,
  options: GracefulShutdownOptions = {},
): Promise<void> {
  const { exitProcess = true } = options;
  logger.info("Gracefully shutting down BazarBeat API server...");

  // 1. Stop scheduler
  try {
    stopScheduler();
    logger.info("Scheduler stopped");
  } catch (err) {
    logger.error({ err }, "Error stopping scheduler during shutdown");
  }

  // 2. Close and clean up all SSE streams
  try {
    getListingStreamHub().destroy();
    getUserStreamHub().destroy();
    logger.info("Active SSE streams closed");
  } catch (err) {
    logger.error({ err }, "Error closing SSE streams during shutdown");
  }

  // 3. Close HTTP server if provided
  if (httpServer && httpServer.listening) {
    await new Promise<void>((resolve) => {
      httpServer.close((err) => {
        if (err) {
          logger.warn({ err }, "HTTP server close reported an error");
        } else {
          logger.info("HTTP server closed");
        }
        resolve();
      });
    });
  }

  // 4. Disconnect MongoDB
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info("Database connection closed");
    }
  } catch (err) {
    logger.error({ err }, "Error closing database connection");
  }

  if (exitProcess) {
    process.exit(0);
  }
}
