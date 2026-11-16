import {
  OrderStatus,
  getOrderAutoCancelMs,
  getOrderAutoCompleteMs,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { type Clock, getClock } from "../../shared/clock.js";
import { logger } from "../../shared/logger.js";
import { getOrderTransitionService } from "./order-transition.service.js";
import { Order } from "./order.model.js";

export interface OrderTimerOutcome {
  orderId: string;
  success: boolean;
  status?: OrderStatus;
  error?: unknown;
}

export interface OrderTimerSummary {
  checkedAt: Date;
  found: number;
  processed: number;
  failed: number;
  results: OrderTimerOutcome[];
  durationMs: number;
}

export interface OrderTimerJobOptions {
  /** Target time to compare timestamps against; defaults to clock.now() */
  asOf?: Date;
  /** Clock to use; defaults to active system or test clock */
  clock?: Clock;
  /** Override demo mode flag */
  isDemoMode?: boolean;
}

interface DueOrderCandidate {
  _id: { toString(): string };
  status: OrderStatus;
  createdAt: Date;
  deliveredAt?: Date;
}

/**
 * Job 1: Auto-cancel PENDING orders past the confirmation deadline.
 * Cancelled by SYSTEM with reason NOT_CONFIRMED_IN_TIME.
 * Uses injected Clock, transitions via OrderTransitionEngine, isolates errors per order, and is idempotent.
 */
export async function cancelDuePendingOrders(
  options: OrderTimerJobOptions = {},
): Promise<OrderTimerSummary> {
  const clock: Clock = options.clock ?? getClock();
  const asOf: Date = options.asOf ?? clock.now();
  const isDemoMode = options.isDemoMode ?? env.DEMO_MODE;
  const timeoutMs = getOrderAutoCancelMs(isDemoMode);
  const threshold = new Date(asOf.getTime() - timeoutMs);
  const transitionService = getOrderTransitionService();
  const startTime = Date.now();

  logger.debug(
    { asOf: asOf.toISOString(), threshold: threshold.toISOString(), isDemoMode },
    "Checking for unconfirmed PENDING orders to auto-cancel",
  );

  const candidates = (await Order.find({
    status: OrderStatus.PENDING,
    createdAt: { $lte: threshold },
  })
    .sort({ createdAt: 1 })
    .select("_id status createdAt")
    .lean()) as unknown as DueOrderCandidate[];

  const results: OrderTimerOutcome[] = [];
  let processed = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const orderId = candidate._id.toString();
    try {
      const order = await transitionService.cancel(
        orderId,
        {
          userId: "SYSTEM",
          role: "SYSTEM",
          isSystem: true,
        },
        {
          reason: "NOT_CONFIRMED_IN_TIME",
          note: "Confirmation deadline expired without farmer confirmation",
        },
      );

      processed++;
      results.push({
        orderId,
        success: true,
        status: order.status as OrderStatus,
      });

      logger.info(
        { orderId, status: order.status },
        "Successfully auto-cancelled expired PENDING order",
      );
    } catch (error: unknown) {
      failed++;
      results.push({
        orderId,
        success: false,
        error,
      });

      logger.error(
        { orderId, err: error },
        "Failed to auto-cancel expired PENDING order; isolating error",
      );
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    checkedAt: asOf,
    found: candidates.length,
    processed,
    failed,
    results,
    durationMs,
  };
}

/**
 * Job 2: Auto-complete DELIVERED orders past 24 hours with no dispute.
 * Uses injected Clock, transitions via OrderTransitionEngine, isolates errors per order, and is idempotent.
 */
export async function completeDueDeliveredOrders(
  options: OrderTimerJobOptions = {},
): Promise<OrderTimerSummary> {
  const clock: Clock = options.clock ?? getClock();
  const asOf: Date = options.asOf ?? clock.now();
  const isDemoMode = options.isDemoMode ?? env.DEMO_MODE;
  const timeoutMs = getOrderAutoCompleteMs(isDemoMode);
  const threshold = new Date(asOf.getTime() - timeoutMs);
  const transitionService = getOrderTransitionService();
  const startTime = Date.now();

  logger.debug(
    { asOf: asOf.toISOString(), threshold: threshold.toISOString(), isDemoMode },
    "Checking for DELIVERED orders to auto-complete",
  );

  // Orders in DELIVERED status whose deliveredAt has passed threshold and no dispute exists
  const candidates = (await Order.find({
    status: OrderStatus.DELIVERED,
    deliveredAt: { $lte: threshold },
    dispute: { $exists: false },
  })
    .sort({ deliveredAt: 1 })
    .select("_id status deliveredAt")
    .lean()) as unknown as DueOrderCandidate[];

  const results: OrderTimerOutcome[] = [];
  let processed = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const orderId = candidate._id.toString();
    try {
      const order = await transitionService.complete(
        orderId,
        {
          userId: "SYSTEM",
          role: "SYSTEM",
          isSystem: true,
        },
        {
          note: "Auto-completed by system after 24h with no dispute",
        },
      );

      processed++;
      results.push({
        orderId,
        success: true,
        status: order.status as OrderStatus,
      });

      logger.info(
        { orderId, status: order.status },
        "Successfully auto-completed DELIVERED order",
      );
    } catch (error: unknown) {
      failed++;
      results.push({
        orderId,
        success: false,
        error,
      });

      logger.error(
        { orderId, err: error },
        "Failed to auto-complete DELIVERED order; isolating error",
      );
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    checkedAt: asOf,
    found: candidates.length,
    processed,
    failed,
    results,
    durationMs,
  };
}

/**
 * Runs both order timer jobs (auto-cancel and auto-complete) sequentially.
 */
export async function runOrderTimerJobs(
  options: OrderTimerJobOptions = {},
): Promise<{
  autoCancel: OrderTimerSummary;
  autoComplete: OrderTimerSummary;
}> {
  const autoCancel = await cancelDuePendingOrders(options);
  const autoComplete = await completeDueDeliveredOrders(options);
  return { autoCancel, autoComplete };
}
