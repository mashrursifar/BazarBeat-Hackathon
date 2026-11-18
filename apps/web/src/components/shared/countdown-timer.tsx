import { type ReactElement, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListingStatus } from "@bazarbeat/shared";

import { useCountdown } from "../../features/realtime/use-countdown.js";
import { toBanglaDigits } from "../../lib/format.js";
import { cn } from "../../lib/utils.js";

export interface CountdownTimerProps {
  endsAt: string | Date | number | null | undefined;
  serverTime?: string | Date | number;
  status?: ListingStatus | string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    container: "px-2 py-0.5 text-xs gap-1 rounded",
    icon: "w-3.5 h-3.5",
    time: "font-mono font-medium tracking-tight",
  },
  md: {
    container: "px-2.5 py-1 text-sm gap-1.5 rounded-md",
    icon: "w-4 h-4",
    time: "font-mono font-semibold tracking-tight",
  },
  lg: {
    container: "px-3.5 py-1.5 text-base sm:text-lg gap-2 rounded-lg",
    icon: "w-5 h-5",
    time: "font-mono font-bold tracking-tight",
  },
};

type CountdownThreshold = "normal" | "warning" | "urgent" | "extended" | "finalizing" | "ended";

/**
 * Shared CountdownTimer component adhering to UI_UX_GUIDELINES §5 and §6,
 * and Gap 11 (screen reader countdown policy: announce only at thresholds, never every second).
 *
 * States:
 * - Normal: >= 10 minutes (calm neutral/stone)
 * - Amber: < 10 minutes (warm amber warning)
 * - Red: < 2 minutes (urgent red with subtle pulse, motion-reduce safe)
 * - Extended: Brief flash when anti-sniping pushes endsAt back
 * - Finalizing…: At zero when status is ACTIVE until server confirms outcome
 */
export function CountdownTimer({
  endsAt,
  serverTime,
  status = ListingStatus.ACTIVE,
  size = "md",
  showIcon = true,
  showLabel = false,
  className,
}: CountdownTimerProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const {
    digital,
    isUrgent,
    isWarning,
    isNormal,
    isExpired,
    isFinalizing,
    isExtended,
  } = useCountdown({ endsAt, serverTime, status });

  const currentThreshold: CountdownThreshold = isExtended
    ? "extended"
    : isFinalizing
      ? "finalizing"
      : isExpired
        ? "ended"
        : isUrgent
          ? "urgent"
          : isWarning
            ? "warning"
            : "normal";

  const prevThresholdRef = useRef<CountdownThreshold>(currentThreshold);
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    if (prevThresholdRef.current !== currentThreshold) {
      if (currentThreshold === "warning") {
        setAnnouncement(t("countdown.thresholdWarning", "Auction ending in less than 10 minutes"));
      } else if (currentThreshold === "urgent") {
        setAnnouncement(t("countdown.thresholdUrgent", "Auction ending in less than 2 minutes"));
      } else if (currentThreshold === "extended") {
        setAnnouncement(t("countdown.extended", "Extended (+2m)"));
      } else if (currentThreshold === "finalizing") {
        setAnnouncement(t("countdown.finalizing", "Finalizing…"));
      } else if (currentThreshold === "ended") {
        setAnnouncement(t("countdown.ended", "Auction ended"));
      }
      prevThresholdRef.current = currentThreshold;
    }
  }, [currentThreshold, t]);

  const styles = SIZE_STYLES[size];
  const displayDigits = isBangla ? toBanglaDigits(digital) : digital;

  // Determine container color theme according to state hierarchy
  let stateContainerClasses = "bg-stone-100 text-stone-700 border-stone-200";

  if (isExtended) {
    // Brief anti-sniping extension flash (reduced-motion safe)
    stateContainerClasses =
      "bg-amber-100 text-amber-900 border-amber-400 font-bold shadow-sm animate-pulse motion-reduce:animate-none";
  } else if (isFinalizing) {
    // Reached zero but waiting for server closing confirmation
    stateContainerClasses =
      "bg-stone-100 text-stone-700 border-stone-300 font-medium animate-pulse motion-reduce:animate-none";
  } else if (isExpired) {
    // Confirmed closed
    stateContainerClasses = "bg-stone-100 text-stone-500 border-stone-200";
  } else if (isUrgent) {
    // Under 2 minutes: red urgent state (reduced-motion safe)
    stateContainerClasses =
      "bg-red-50 text-red-700 border-red-200 animate-pulse motion-reduce:animate-none font-semibold";
  } else if (isWarning) {
    // Under 10 minutes: amber warning state
    stateContainerClasses =
      "bg-amber-50 text-amber-800 border-amber-200 font-semibold";
  } else if (isNormal) {
    stateContainerClasses = "bg-stone-100 text-stone-800 border-stone-200";
  }

  return (
    <div
      role="timer"
      aria-live="off"
      data-testid="countdown-timer"
      data-urgent={isUrgent ? "true" : undefined}
      data-warning={isWarning ? "true" : undefined}
      data-normal={isNormal ? "true" : undefined}
      data-extended={isExtended ? "true" : undefined}
      data-finalizing={isFinalizing ? "true" : undefined}
      className={cn(
        "inline-flex items-center border select-none transition-colors duration-200 motion-reduce:transition-none",
        styles.container,
        stateContainerClasses,
        className,
      )}
    >
      {/* Gap 11: Screen reader polite threshold announcer (does NOT spam every second) */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="countdown-announcer">
        {announcement}
      </span>

      {showIcon && (
        <svg
          className={cn("shrink-0", styles.icon)}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )}

      {isExtended ? (
        <span data-testid="countdown-extended-flash" className="tracking-normal font-bold">
          {t("countdown.extended")}
        </span>
      ) : isFinalizing ? (
        <span data-testid="countdown-finalizing-label" className="tracking-normal">
          {t("countdown.finalizing")}
        </span>
      ) : isExpired ? (
        <span data-testid="countdown-ended-label" className="tracking-normal">
          {t("countdown.ended")}
        </span>
      ) : (
        <div className="inline-flex items-center gap-1">
          {showLabel && (
            <span className="text-xs text-muted-foreground font-normal">
              {isUrgent ? t("countdown.urgent") : t("listings.timeLeft")}
            </span>
          )}
          <span
            data-testid="countdown-digits"
            className={cn(styles.time, isUrgent && "text-red-700")}
          >
            {displayDigits}
          </span>
        </div>
      )}
    </div>
  );
}
