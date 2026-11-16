import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { OrderStatus } from "@bazarbeat/shared";

import { cn } from "../../lib/utils.js";
import { OrderStatusBadge } from "./order-status-badge.js";

export interface OrderTimelineEntry {
  status: OrderStatus | string;
  at: string;
  note?: string;
  byUserId?: string;
}

export interface OrderTimelineProps {
  entries?: OrderTimelineEntry[];
  className?: string;
}

export function OrderTimeline({ entries, className }: OrderTimelineProps): ReactElement {
  const { t, i18n } = useTranslation();

  if (!entries || entries.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {t("orders.timeline.empty", "No activity recorded yet.")}
      </div>
    );
  }

  // Sort ascending by timestamp for natural top-to-bottom timeline
  const sorted = [...entries].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat(i18n.language === "bn" ? "bn-BD" : "en-US", {
        timeZone: "Asia/Dhaka",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div
      data-slot="order-timeline"
      data-testid="order-timeline"
      className={cn("relative space-y-4", className)}
    >
      <div
        className="absolute bottom-2 left-3.5 top-2 w-0.5 bg-stone-200"
        aria-hidden="true"
      />
      {sorted.map((entry, index) => {
        const isLatest = index === sorted.length - 1;
        return (
          <div key={`${entry.status}-${entry.at}-${index}`} className="relative flex items-start gap-3">
            <span
              className={cn(
                "relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-white text-xs",
                isLatest
                  ? "border-primary font-bold text-primary ring-4 ring-primary/10"
                  : "border-stone-300 text-stone-500",
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={entry.status} />
                <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                  {formatTime(entry.at)}
                </time>
              </div>
              {entry.note && (
                <p className="mt-1.5 break-words rounded bg-stone-50 p-2 text-xs text-stone-700">
                  {entry.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
