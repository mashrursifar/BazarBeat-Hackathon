import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { formatPoisha } from "@bazarbeat/shared";

import { getOrderTransitionService } from "../src/modules/orders/order-transition.service.js";

// Load environment variables from repo root or package root
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnv = path.resolve(scriptDir, "../../../.env");
if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
}
const apiEnv = path.resolve(scriptDir, "../.env");
if (fs.existsSync(apiEnv)) {
  dotenv.config({ path: apiEnv });
}
dotenv.config();

export interface ResolveDisputeConfig {
  orderId: string;
  action: "COMPLETE" | "CANCEL";
  note?: string;
  nodeEnv?: string;
  mongoUri?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

export interface ResolveDisputeResult {
  success: boolean;
  orderId?: string;
  newStatus?: string;
  error?: unknown;
}

/**
 * Resolves a DISPUTED order by transitioning it to COMPLETED or CANCELLED.
 * Refuses to run in production (NODE_ENV=production).
 */
export async function runResolveDispute(config: ResolveDisputeConfig): Promise<ResolveDisputeResult> {
  const stdout =
    config.stdout ??
    ((message: string): void => {
      process.stdout.write(message);
    });
  const stderr =
    config.stderr ??
    ((message: string): void => {
      process.stderr.write(message);
    });

  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === "production") {
    stderr(
      "[dev:dispute] Error: Refusing to run resolve-dispute script in production environment (NODE_ENV=production).\n",
    );
    return { success: false, error: "PRODUCTION_ENV_FORBIDDEN" };
  }

  const { orderId, action, note } = config;
  if (!orderId || !orderId.trim()) {
    stderr("[dev:dispute] Error: Missing order ID.\nUsage: npm run resolve-dispute -- <orderId> <complete|cancel> [note]\n");
    return { success: false, error: "MISSING_ORDER_ID" };
  }

  const normalizedAction = action?.toUpperCase();
  if (normalizedAction !== "COMPLETE" && normalizedAction !== "CANCEL") {
    stderr(`[dev:dispute] Error: Invalid action "${action}". Must be "complete" or "cancel".\n`);
    return { success: false, error: "INVALID_ACTION" };
  }

  let shouldDisconnect = false;
  if (mongoose.connection.readyState === 0) {
    const mongoUri =
      config.mongoUri ??
      process.env.MONGODB_URI ??
      process.env.MONGO_URI ??
      "mongodb://127.0.0.1:27017/bazarbeat";
    stdout(`[dev:dispute] Connecting to MongoDB: ${mongoUri}...\n`);
    await mongoose.connect(mongoUri);
    shouldDisconnect = true;
  }

  try {
    const transitionService = getOrderTransitionService();
    stdout(`[dev:dispute] Resolving dispute on order ${orderId} -> ${normalizedAction}...\n`);

    const updated = await transitionService.resolveDispute(orderId, {
      action: normalizedAction,
      note: note?.trim(),
      resolvedBy: "DEV_SCRIPT",
    });

    stdout(
      `[dev:dispute] ✓ Successfully resolved order ${updated.id} to status ${updated.status} (subtotal: ${formatPoisha(updated.subtotal)})\n`,
    );

    return {
      success: true,
      orderId: updated.id,
      newStatus: updated.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stderr(`[dev:dispute] Error resolving dispute: ${message}\n`);
    return { success: false, error: message };
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
  }
}

// CLI entry point
const isDirectCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectCli) {
  const args = process.argv.slice(2);
  const orderId = args[0] ?? "";
  const action = (args[1] ?? "") as "COMPLETE" | "CANCEL";
  const note = args.slice(2).join(" ");

  runResolveDispute({ orderId, action, note }).then((result) => {
    if (!result.success) {
      process.exit(1);
    }
  });
}
