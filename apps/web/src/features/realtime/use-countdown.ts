import { useEffect, useRef, useState } from "react";
import { AUCTION_TIMING, ListingStatus } from "@bazarbeat/shared";

import { formatDuration } from "../../lib/format.js";
import { getServerNow, syncServerTime, useServerClockOffset } from "../../lib/server-clock.js";

export const COUNTDOWN_THRESHOLDS = {
  /** Under 2 minutes is urgent (red state) per UI_UX_GUIDELINES §5 */
  URGENT_MS: AUCTION_TIMING.ANTI_SNIPING_TRIGGER_WINDOW_MS, // 2 minutes (120,000ms)
  /** Under 10 minutes is warning (amber state) per UI_UX_GUIDELINES §5 */
  WARNING_MS: 10 * 60 * 1000, // 10 minutes (600,000ms)
  /** Duration in ms for the brief "Extended" flash badge */
  EXTENSION_FLASH_MS: 3000,
} as const;

export interface UseCountdownOptions {
  endsAt: string | Date | number | null | undefined;
  serverTime?: string | Date | number;
  status?: ListingStatus | string;
  tickIntervalMs?: number;
  extensionFlashDurationMs?: number;
  onExpire?: () => void;
}

export interface UseCountdownReturn {
  timeLeftMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  digital: string;
  formattedTime: string;
  isExpired: boolean;
  isUrgent: boolean;
  isWarning: boolean;
  isNormal: boolean;
  isFinalizing: boolean;
  isExtended: boolean;
}

function parseTargetTime(input: string | Date | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "string") {
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Number.isFinite(input.getTime()) ? input.getTime() : null;
}

/**
 * Custom hook tracking auction countdown against authoritative server clock offset.
 *
 * Rules (AUCTION_RULES §1, §6, §12; UI_UX_GUIDELINES §5):
 * 1. Base time uses getServerNow() = Date.now() + serverOffsetMs.
 * 2. Visual states:
 *    - Normal: >= 10 minutes
 *    - Amber: < 10 minutes
 *    - Red: < 2 minutes
 *    - Extended: Brief flash when endsAt is extended by anti-sniping
 *    - Finalizing…: When timeLeft reaches 0 and status is ACTIVE until server confirms
 * 3. Non-authoritative: The client NEVER changes the listing status or declares a winner.
 */
export function useCountdown(options: UseCountdownOptions): UseCountdownReturn {
  const {
    endsAt,
    serverTime,
    status = ListingStatus.ACTIVE,
    tickIntervalMs = 1000,
    extensionFlashDurationMs = COUNTDOWN_THRESHOLDS.EXTENSION_FLASH_MS,
    onExpire,
  } = options;

  // Sync serverTime if provided in props
  if (serverTime != null) {
    syncServerTime(serverTime);
  }

  // Subscribe to reactive server offset changes
  useServerClockOffset();

  const targetTimeMs = parseTargetTime(endsAt);
  const prevTargetTimeRef = useRef<number | null>(targetTimeMs);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onExpireCalledRef = useRef(false);

  const [isExtended, setIsExtended] = useState(false);

  // Calculate current remaining ms
  const computeTimeLeft = (): number => {
    if (targetTimeMs == null) return 0;
    return Math.max(0, targetTimeMs - getServerNow());
  };

  const [timeLeftMs, setTimeLeftMs] = useState<number>(computeTimeLeft);

  // Detect anti-sniping extension (targetTimeMs increased)
  useEffect(() => {
    if (targetTimeMs != null && prevTargetTimeRef.current != null) {
      if (targetTimeMs > prevTargetTimeRef.current) {
        setIsExtended(true);
        if (flashTimerRef.current) {
          clearTimeout(flashTimerRef.current);
        }
        flashTimerRef.current = setTimeout(() => {
          setIsExtended(false);
          flashTimerRef.current = null;
        }, extensionFlashDurationMs);
      }
    }
    prevTargetTimeRef.current = targetTimeMs;
    setTimeLeftMs(computeTimeLeft());
  }, [targetTimeMs, extensionFlashDurationMs]);

  // Clean up flash timer on unmount
  useEffect(() => {
    return (): void => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  // Timer interval tick
  useEffect(() => {
    if (targetTimeMs == null) {
      setTimeLeftMs(0);
      return;
    }

    // Immediate tick update
    const current = computeTimeLeft();
    setTimeLeftMs(current);

    if (current <= 0 && !onExpireCalledRef.current) {
      onExpireCalledRef.current = true;
      onExpire?.();
    } else if (current > 0) {
      onExpireCalledRef.current = false;
    }

    const interval = setInterval(() => {
      const remaining = computeTimeLeft();
      setTimeLeftMs(remaining);

      if (remaining <= 0 && !onExpireCalledRef.current) {
        onExpireCalledRef.current = true;
        onExpire?.();
      }
    }, tickIntervalMs);

    return (): void => {
      clearInterval(interval);
    };
  }, [targetTimeMs, tickIntervalMs, onExpire]);

  const duration = formatDuration(timeLeftMs);

  const isExpired = timeLeftMs <= 0;
  const isUrgent = timeLeftMs > 0 && timeLeftMs < COUNTDOWN_THRESHOLDS.URGENT_MS;
  const isWarning =
    timeLeftMs >= COUNTDOWN_THRESHOLDS.URGENT_MS &&
    timeLeftMs < COUNTDOWN_THRESHOLDS.WARNING_MS;
  const isNormal = timeLeftMs >= COUNTDOWN_THRESHOLDS.WARNING_MS;

  // Finalizing state: reaches zero while status is still active waiting for server close event
  const isFinalizing = isExpired && status === ListingStatus.ACTIVE;

  return {
    timeLeftMs,
    days: duration.days,
    hours: duration.hours,
    minutes: duration.minutes,
    seconds: duration.seconds,
    digital: duration.digital,
    formattedTime: duration.digital,
    isExpired,
    isUrgent,
    isWarning,
    isNormal,
    isFinalizing,
    isExtended,
  };
}
