import { type ReactElement, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocalizedNumber } from "../../lib/format.js";
import { cn } from "../../lib/utils.js";

export interface LiveBidIndicatorProps {
  bidCount: number;
  isLive?: boolean;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  showStatusText?: boolean;
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    container: "text-xs gap-1.5",
    dot: "w-2 h-2",
    ping: "w-2 h-2",
  },
  md: {
    container: "text-sm gap-2",
    dot: "w-2.5 h-2.5",
    ping: "w-2.5 h-2.5",
  },
  lg: {
    container: "text-base gap-2.5",
    dot: "w-3 h-3",
    ping: "w-3 h-3",
  },
};

/**
 * Shared LiveBidIndicator component adhering to UI_UX_GUIDELINES §4b, §5, §6.
 *
 * Displays:
 * - Pulsing live activity beacon when stream is connected (isLive)
 * - Bid count formatted with i18n pluralization and Bangla numerals
 * - Polite aria-live announcements for screen readers
 * - Subtle flash animation on incoming bid updates without layout jumps
 */
export function LiveBidIndicator({
  bidCount,
  isLive = true,
  size = "md",
  showCount = true,
  showStatusText = false,
  className,
}: LiveBidIndicatorProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const prevCountRef = useRef(bidCount);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    if (bidCount > prevCountRef.current) {
      setJustUpdated(true);
      const timer = setTimeout(() => {
        setJustUpdated(false);
      }, 1500);
      prevCountRef.current = bidCount;
      return (): void => clearTimeout(timer);
    }
    prevCountRef.current = bidCount;
  }, [bidCount]);

  const styles = SIZE_STYLES[size];

  // Pluralized / localized label
  let countLabel: string;
  if (bidCount === 0) {
    countLabel = t("realtime.bidsCount_zero");
  } else if (bidCount === 1) {
    countLabel = t("realtime.bidsCount_one");
  } else {
    const formattedCount = formatLocalizedNumber(bidCount, isBangla);
    countLabel = t("realtime.bidsCount_other", { count: formattedCount });
  }

  const liveStatusText = isLive ? t("realtime.live") : t("realtime.offline");

  return (
    <div
      data-testid="live-bid-indicator"
      data-live={isLive ? "true" : "false"}
      data-updated={justUpdated ? "true" : undefined}
      className={cn(
        "inline-flex items-center font-medium select-none text-stone-700 transition-colors",
        styles.container,
        className,
      )}
    >
      {/* Visual Live Beacon */}
      <span className="relative flex shrink-0 items-center justify-center">
        {isLive && (
          <span
            data-testid="live-pulse-ring"
            className={cn(
              "absolute inline-flex rounded-full bg-emerald-400 opacity-75 animate-ping",
              styles.ping,
            )}
          />
        )}
        <span
          data-testid="live-dot"
          className={cn(
            "relative inline-flex rounded-full transition-colors",
            styles.dot,
            isLive ? "bg-emerald-600" : "bg-stone-400",
          )}
        />
      </span>

      {/* Optional Status Text (e.g. "Live") */}
      {showStatusText && (
        <span
          data-testid="live-status-text"
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isLive ? "text-emerald-700" : "text-stone-500",
          )}
        >
          {liveStatusText}
        </span>
      )}

      {/* Bid Count Display */}
      {showCount && (
        <span
          data-testid="live-bid-count"
          className={cn(
            "transition-all duration-300",
            justUpdated && "font-bold text-emerald-800 scale-105",
          )}
        >
          {countLabel}
        </span>
      )}

      {/* Screen-reader aria-live polite region per UI_UX_GUIDELINES §6 */}
      <span className="sr-only" aria-live="polite">
        {`${liveStatusText}. ${countLabel}`}
      </span>
    </div>
  );
}
