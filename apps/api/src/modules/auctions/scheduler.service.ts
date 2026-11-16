import { AuctionCloseTrigger, ListingStatus, getSchedulerIntervalMs } from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { type Clock, getClock } from "../../shared/clock.js";
import { logger } from "../../shared/logger.js";
import {
  cancelDuePendingOrders,
  completeDueDeliveredOrders,
  runOrderTimerJobs,
} from "../orders/order-timer.service.js";
import { Listing } from "../listings/listing.model.js";
import * as closingService from "./closing.service.js";
import { type CloseAuctionOptions, type CloseAuctionResult } from "./closing.service.js";

export {
  cancelDuePendingOrders,
  completeDueDeliveredOrders,
  runOrderTimerJobs,
};

/**
 * Minimal Clock implementation wrapping a fixed Date instance.
 */
export class FixedTimeClock implements Clock {
  public constructor(private readonly fixedTime: Date) {}

  public now(): Date {
    return new Date(this.fixedTime.getTime());
  }

  public iso(): string {
    return this.fixedTime.toISOString();
  }

  public timestamp(): number {
    return this.fixedTime.getTime();
  }
}

export interface CloseDueListingsOptions {
  /** Target time to compare endsAt against; defaults to clock.now() */
  asOf?: Date;
  /** Clock to use for time checks and closing service; defaults to active system or test clock */
  clock?: Clock;
  /** Optional override for platform fee in basis points */
  platformFeeBps?: number;
  /** Optional override for closing function (e.g. for testing isolated failures) */
  closeAuctionFn?: (listingId: string, options: CloseAuctionOptions) => Promise<CloseAuctionResult>;
}

export interface CloseDueListingOutcome {
  listingId: string;
  success: boolean;
  status?: typeof ListingStatus.SOLD | typeof ListingStatus.EXPIRED_UNSOLD;
  error?: unknown;
}

export interface CloseDueListingsSummary {
  checkedAt: Date;
  found: number;
  closed: number;
  failed: number;
  results: CloseDueListingOutcome[];
  durationMs: number;
}

export interface SchedulerOptions {
  /** Polling interval in ms. Defaults to getSchedulerIntervalMs(env.DEMO_MODE) */
  intervalMs?: number;
  /** Custom clock */
  clock?: Clock;
  /** Override platform fee bps */
  platformFeeBps?: number;
  /** Whether to run an immediate pass on startup. Default: false */
  runImmediatePass?: boolean;
  /** Optional override for closing function */
  closeAuctionFn?: (listingId: string, options: CloseAuctionOptions) => Promise<CloseAuctionResult>;
}

interface DueListingCandidate {
  _id: { toString(): string };
  endsAt: Date;
}

/**
 * Finds all ACTIVE listings whose endsAt has passed as of the specified time,
 * and closes each through the closing service.
 *
 * Errors are strictly isolated per listing so that a failure in one listing
 * never interrupts or aborts closing the other listings.
 * AUCTION_RULES §8, ARCHITECTURE §6.
 */
export async function closeDueListings(
  optionsOrAsOf?: Date | CloseDueListingsOptions,
): Promise<CloseDueListingsSummary> {
  const options: CloseDueListingsOptions =
    optionsOrAsOf instanceof Date ? { asOf: optionsOrAsOf } : (optionsOrAsOf ?? {});

  const clock: Clock =
    options.clock ?? (options.asOf ? new FixedTimeClock(options.asOf) : getClock());
  const asOf: Date = options.asOf ?? clock.now();
  const closer = options.closeAuctionFn ?? closingService.closeAuction;
  const startTime = Date.now();

  logger.debug({ asOf: asOf.toISOString() }, "Checking for due active listings to close");

  const candidates = (await Listing.find({
    status: ListingStatus.ACTIVE,
    endsAt: { $lte: asOf },
  })
    .sort({ endsAt: 1 })
    .select("_id endsAt")
    .lean()) as unknown as DueListingCandidate[];

  const results: CloseDueListingOutcome[] = [];
  let closed = 0;
  let failed = 0;

  if (candidates.length > 0) {
    logger.info(
      { count: candidates.length, asOf: asOf.toISOString() },
      "Found due active listings for closing",
    );
  }

  for (const candidate of candidates) {
    const listingId = candidate._id.toString();
    try {
      const result = await closer(listingId, {
        trigger: AuctionCloseTrigger.SCHEDULER,
        clock,
        platformFeeBps: options.platformFeeBps,
      });

      closed++;
      results.push({
        listingId,
        success: true,
        status: result.status,
      });

      logger.info(
        {
          listingId,
          status: result.status,
          isIdempotentReplay: result.isIdempotentReplay,
        },
        "Successfully closed due listing",
      );
    } catch (error: unknown) {
      failed++;
      results.push({
        listingId,
        success: false,
        error,
      });

      logger.error(
        {
          listingId,
          err: error,
        },
        "Failed to close due listing; isolating error",
      );
    }
  }

  const durationMs = Date.now() - startTime;
  if (candidates.length > 0) {
    logger.info(
      { found: candidates.length, closed, failed, durationMs },
      "Completed closing due listings pass",
    );
  }

  return {
    checkedAt: asOf,
    found: candidates.length,
    closed,
    failed,
    results,
    durationMs,
  };
}

/**
 * On startup, run one immediate pass to close anything that expired while the server was down.
 * ARCHITECTURE §6, AUCTION_RULES §8.
 */
export async function runStartupCatchUp(
  options?: CloseDueListingsOptions,
): Promise<CloseDueListingsSummary> {
  logger.info("Running startup catch-up to close expired auctions and orders while server was offline");
  const summary = await closeDueListings(options);
  await runOrderTimerJobs({
    clock: options?.clock,
    isDemoMode: env.DEMO_MODE,
  });
  logger.info(
    {
      found: summary.found,
      closed: summary.closed,
      failed: summary.failed,
      durationMs: summary.durationMs,
    },
    "Startup catch-up pass completed",
  );
  return summary;
}

/**
 * AuctionScheduler handles periodic ticks to close expired listings and run order timers.
 * Includes a guard that skips a tick if the previous tick is still running.
 */
export class AuctionScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isTickRunning = false;
  private readonly intervalMs: number;
  private readonly clock?: Clock;
  private readonly platformFeeBps?: number;
  private readonly closeAuctionFn?: (
    listingId: string,
    options: CloseAuctionOptions,
  ) => Promise<CloseAuctionResult>;

  public constructor(options: SchedulerOptions = {}) {
    this.intervalMs = options.intervalMs ?? getSchedulerIntervalMs(env.DEMO_MODE);
    this.clock = options.clock;
    this.platformFeeBps = options.platformFeeBps;
    this.closeAuctionFn = options.closeAuctionFn;
  }

  public isRunning(): boolean {
    return this.timer !== null;
  }

  public isTickInProgress(): boolean {
    return this.isTickRunning;
  }

  public getIntervalMs(): number {
    return this.intervalMs;
  }

  /**
   * Executes a single scheduler tick with concurrency guard.
   * Closes due listings and runs order lifecycle timers.
   * If a previous tick is still running, skips this tick and logs a warning.
   */
  public async tick(): Promise<CloseDueListingsSummary | null> {
    if (this.isTickRunning) {
      logger.warn("Scheduler tick skipped: previous tick is still running");
      return null;
    }

    this.isTickRunning = true;
    try {
      const summary = await closeDueListings({
        clock: this.clock,
        platformFeeBps: this.platformFeeBps,
        closeAuctionFn: this.closeAuctionFn,
      });

      // Task 6.5: Run order timers in the scheduler
      await runOrderTimerJobs({
        clock: this.clock,
        isDemoMode: env.DEMO_MODE,
      });

      return summary;
    } finally {
      this.isTickRunning = false;
    }
  }

  /**
   * Starts the periodic scheduler interval.
   */
  public start(runImmediatePass = false): void {
    if (this.timer) {
      logger.warn("Scheduler is already running; ignoring duplicate start call");
      return;
    }

    logger.info(
      { intervalMs: this.intervalMs, isDemoMode: env.DEMO_MODE },
      "Starting auction scheduler",
    );

    if (runImmediatePass) {
      void this.tick().catch((error: unknown) => {
        logger.error({ err: error }, "Unhandled error during immediate scheduler pass");
      });
    }

    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        logger.error({ err: error }, "Unhandled error during periodic scheduler tick");
      });
    }, this.intervalMs);

    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  /**
   * Stops the periodic scheduler interval.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("Auction scheduler stopped");
    }
  }
}

let activeScheduler: AuctionScheduler | null = null;
let defaultSharedScheduler: AuctionScheduler | null = null;

export function startScheduler(options: SchedulerOptions = {}): AuctionScheduler {
  if (activeScheduler && activeScheduler.isRunning()) {
    return activeScheduler;
  }
  activeScheduler = new AuctionScheduler(options);
  activeScheduler.start(options.runImmediatePass);
  return activeScheduler;
}

export function stopScheduler(): void {
  if (activeScheduler) {
    activeScheduler.stop();
    activeScheduler = null;
  }
}

export function getActiveScheduler(): AuctionScheduler | null {
  return activeScheduler;
}

export function runSchedulerTick(
  options?: CloseDueListingsOptions,
): Promise<CloseDueListingsSummary | null> {
  if (activeScheduler) {
    return activeScheduler.tick();
  }
  if (!defaultSharedScheduler) {
    defaultSharedScheduler = new AuctionScheduler(options);
  }
  return defaultSharedScheduler.tick();
}

export function resetSchedulerState(): void {
  stopScheduler();
  if (defaultSharedScheduler) {
    defaultSharedScheduler.stop();
    defaultSharedScheduler = null;
  }
}
