/**
 * Timing constants for auction operations, anti-sniping extensions, and scheduling.
 * Sources: AUCTION_RULES §6, AUCTION_RULES §11, ARCHITECTURE §5, ARCHITECTURE §6.
 */
export const AUCTION_TIMING = {
  /**
   * AUCTION_RULES §6: Anti-sniping trigger threshold before endsAt.
   * If a bid is accepted when remaining time is under 2 minutes, endsAt extends.
   */
  ANTI_SNIPING_TRIGGER_WINDOW_MS: 2 * 60 * 1000, // 120,000 ms (2 minutes)

  /**
   * AUCTION_RULES §6: Duration added to endsAt when anti-sniping triggers (endsAt becomes now + 2 minutes).
   */
  ANTI_SNIPING_EXTENSION_DURATION_MS: 2 * 60 * 1000, // 120,000 ms (2 minutes)

  /**
   * AUCTION_RULES §6: Maximum number of anti-sniping extensions allowed (at most 10 extra minutes).
   */
  ANTI_SNIPING_MAX_EXTENSIONS: 5,

  /**
   * AUCTION_RULES §6: Demo mode trigger window scaled down proportionally (15 seconds).
   */
  DEMO_ANTI_SNIPING_TRIGGER_WINDOW_MS: 15 * 1000, // 15,000 ms (15 seconds)

  /**
   * AUCTION_RULES §6: Demo mode extension duration scaled down proportionally (15 seconds).
   */
  DEMO_ANTI_SNIPING_EXTENSION_DURATION_MS: 15 * 1000, // 15,000 ms (15 seconds)

  /**
   * ARCHITECTURE §6: Background scheduler tick interval for closing expired active auctions.
   */
  SCHEDULER_INTERVAL_MS: 10 * 1000, // 10,000 ms (10 seconds)

  /**
   * ARCHITECTURE §6: Demo mode background scheduler tick interval.
   */
  DEMO_SCHEDULER_INTERVAL_MS: 2 * 1000, // 2,000 ms (2 seconds)

  /**
   * ARCHITECTURE §5: Client-side polling fallback when Server-Sent Events disconnect.
   */
  CLIENT_POLLING_FALLBACK_MS: 5 * 1000, // 5,000 ms (5 seconds)

  /**
   * AUCTION_RULES §11: Order auto-cancellation window for unconfirmed orders (12 hours).
   */
  ORDER_AUTO_CANCEL_HOURS: 12,
  ORDER_AUTO_CANCEL_MS: 12 * 60 * 60 * 1000, // 43,200,000 ms (12 hours)
  DEMO_ORDER_AUTO_CANCEL_MS: 60 * 1000, // 60,000 ms (1 minute)

  /**
   * Auto-completion window for delivered orders (24 hours).
   */
  ORDER_AUTO_COMPLETE_HOURS: 24,
  ORDER_AUTO_COMPLETE_MS: 24 * 60 * 60 * 1000, // 86,400,000 ms (24 hours)
  DEMO_ORDER_AUTO_COMPLETE_MS: 2 * 60 * 1000, // 120,000 ms (2 minutes)

  /**
   * ARCHITECTURE §5: Heartbeat interval sent to keep SSE connections alive.
   */
  SSE_HEARTBEAT_INTERVAL_MS: 20 * 1000, // 20,000 ms (20 seconds)

  /**
   * Maximum number of concurrent open SSE streams allowed per authenticated user.
   */
  MAX_CONCURRENT_STREAMS_PER_USER: 5,
} as const;

/**
 * Order timing constants and presets.
 * Sources: AUCTION_RULES §11, API_SPEC (Orders).
 */
export const ORDER_TIMING = {
  AUTO_CANCEL_HOURS: 12,
  AUTO_CANCEL_MS: 12 * 60 * 60 * 1000,
  DEMO_AUTO_CANCEL_MS: 60 * 1000,

  AUTO_COMPLETE_HOURS: 24,
  AUTO_COMPLETE_MS: 24 * 60 * 60 * 1000,
  DEMO_AUTO_COMPLETE_MS: 2 * 60 * 1000,

  DISPUTE_WINDOW_HOURS: 24,
  DISPUTE_WINDOW_MS: 24 * 60 * 60 * 1000,
  DEMO_DISPUTE_WINDOW_MS: 2 * 60 * 1000,
} as const;

/**
 * Order handover rules and boundaries.
 * Rules: Handover time from now up to 72 hours ahead; note up to 200 characters.
 */
export const ORDER_HANDOVER = {
  MIN_HOURS_AHEAD: 0,
  MAX_HOURS_AHEAD: 72,
  MAX_HOURS_AHEAD_MS: 72 * 60 * 60 * 1000,
  MAX_NOTE_LENGTH: 200,
} as const;

export function getOrderAutoCancelMs(isDemoMode: boolean): number {
  return isDemoMode
    ? ORDER_TIMING.DEMO_AUTO_CANCEL_MS
    : ORDER_TIMING.AUTO_CANCEL_MS;
}

export function getOrderAutoCompleteMs(isDemoMode: boolean): number {
  return isDemoMode
    ? ORDER_TIMING.DEMO_AUTO_COMPLETE_MS
    : ORDER_TIMING.AUTO_COMPLETE_MS;
}

export function getOrderDisputeWindowMs(isDemoMode: boolean): number {
  return isDemoMode
    ? ORDER_TIMING.DEMO_DISPUTE_WINDOW_MS
    : ORDER_TIMING.DISPUTE_WINDOW_MS;
}

export function getAntiSnipingTriggerWindowMs(isDemoMode: boolean): number {
  return isDemoMode
    ? AUCTION_TIMING.DEMO_ANTI_SNIPING_TRIGGER_WINDOW_MS
    : AUCTION_TIMING.ANTI_SNIPING_TRIGGER_WINDOW_MS;
}

export function getAntiSnipingExtensionDurationMs(isDemoMode: boolean): number {
  return isDemoMode
    ? AUCTION_TIMING.DEMO_ANTI_SNIPING_EXTENSION_DURATION_MS
    : AUCTION_TIMING.ANTI_SNIPING_EXTENSION_DURATION_MS;
}

export function getSchedulerIntervalMs(isDemoMode: boolean): number {
  return isDemoMode
    ? AUCTION_TIMING.DEMO_SCHEDULER_INTERVAL_MS
    : AUCTION_TIMING.SCHEDULER_INTERVAL_MS;
}

export function getSseHeartbeatIntervalMs(): number {
  return AUCTION_TIMING.SSE_HEARTBEAT_INTERVAL_MS;
}

export function getMaxConcurrentStreamsPerUser(): number {
  return AUCTION_TIMING.MAX_CONCURRENT_STREAMS_PER_USER;
}

