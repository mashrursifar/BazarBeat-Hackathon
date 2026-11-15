import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { type AiPriceSnapshot, formatPoisha } from "@bazarbeat/shared";

import { cn } from "../../../lib/utils.js";

export interface AiMarketRangeVisualProps {
  snapshot: AiPriceSnapshot;
  currentPricePerKg: number;
  floorPricePerKg: number;
  hasBids: boolean;
  className?: string;
}

export function AiMarketRangeVisual({
  snapshot,
  currentPricePerKg,
  floorPricePerKg,
  hasBids,
  className,
}: AiMarketRangeVisualProps): ReactElement {
  const { t } = useTranslation();

  const { lowPerKg, expectedPerKg, highPerKg, trend } = snapshot;

  // Determine relative position of current price against AI range
  let positionCategory: "below" | "within" | "above" = "within";
  if (currentPricePerKg < lowPerKg) {
    positionCategory = "below";
  } else if (currentPricePerKg > highPerKg) {
    positionCategory = "above";
  }

  // Calculate percentage positions across the visual gauge
  // Span includes a margin below and above so markers don't clip at edges
  const minBound = Math.min(lowPerKg * 0.88, currentPricePerKg * 0.95);
  const maxBound = Math.max(highPerKg * 1.12, currentPricePerKg * 1.05);
  const totalSpan = maxBound - minBound;

  const getPercent = (value: number): number => {
    if (totalSpan <= 0) return 50;
    const clamped = Math.max(minBound, Math.min(maxBound, value));
    return ((clamped - minBound) / totalSpan) * 100;
  };

  const lowPercent = getPercent(lowPerKg);
  const expectedPercent = getPercent(expectedPerKg);
  const highPercent = getPercent(highPerKg);
  const currentPercent = getPercent(currentPricePerKg);

  const trendIcon =
    trend === "UP" ? "↗" : trend === "DOWN" ? "↘" : "→";

  return (
    <div
      data-testid="ai-market-range-visual"
      className={cn(
        "rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4",
        className,
      )}
    >
      {/* Header and Trend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            AI
          </span>
          <h3 className="text-sm font-bold text-stone-900 sm:text-base">
            {t("listingDetail.marketRangeTitle")}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="market-trend-badge"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold select-none",
              trend === "UP" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
              trend === "DOWN" && "bg-amber-50 text-amber-800 border border-amber-200",
              trend === "FLAT" && "bg-stone-100 text-stone-700 border border-stone-200",
            )}
          >
            <span>{trendIcon}</span>
            <span>
              {trend === "UP" && t("listingDetail.trendRising")}
              {trend === "DOWN" && t("listingDetail.trendFalling")}
              {trend === "FLAT" && t("listingDetail.trendStable")}
            </span>
          </span>

          <span
            data-testid="market-position-badge"
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold select-none",
              positionCategory === "below" && "bg-blue-50 text-blue-800 border border-blue-200",
              positionCategory === "within" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
              positionCategory === "above" && "bg-amber-50 text-amber-800 border border-amber-200",
            )}
          >
            {positionCategory === "below" && t("listingDetail.positionBelow")}
            {positionCategory === "within" && t("listingDetail.positionWithin")}
            {positionCategory === "above" && t("listingDetail.positionAbove")}
          </span>
        </div>
      </div>

      {/* Visual Track / Gauge */}
      <div className="relative pt-6 pb-4">
        {/* Track Background */}
        <div className="relative h-3 w-full rounded-full bg-stone-100 overflow-hidden">
          {/* Market Guidance Highlight Band (Low to High) */}
          <div
            data-testid="ai-range-band"
            className="absolute top-0 bottom-0 bg-emerald-200/70 dark:bg-emerald-800/40"
            style={{
              left: `${lowPercent}%`,
              width: `${Math.max(2, highPercent - lowPercent)}%`,
            }}
          />
        </div>

        {/* Expected Marker Line */}
        <div
          data-testid="expected-marker"
          className="absolute top-4 bottom-2 w-0.5 bg-emerald-600 z-10 -translate-x-1/2"
          style={{ left: `${expectedPercent}%` }}
          title={`AI Expected: ${formatPoisha(expectedPerKg)}/kg`}
        />

        {/* Current Price Pin Marker */}
        <div
          data-testid="current-price-marker"
          className="absolute top-1 z-20 flex flex-col items-center -translate-x-1/2 transition-all duration-300"
          style={{ left: `${currentPercent}%` }}
          title={
            hasBids
              ? `${t("listingDetail.marketRangeCurrent")}: ${formatPoisha(currentPricePerKg)}/kg`
              : `${t("listingDetail.marketRangeFloor")}: ${formatPoisha(floorPricePerKg)}/kg`
          }
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-white">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
          <span className="mt-1 whitespace-nowrap rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {formatPoisha(currentPricePerKg)}
          </span>
        </div>
      </div>

      {/* Numerical Benchmark Points */}
      <div className="grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-center text-xs">
        <div>
          <span className="block text-stone-500 font-medium">{t("listingDetail.marketRangeLow")}</span>
          <strong className="block text-stone-800 font-mono font-bold mt-0.5">
            {formatPoisha(lowPerKg)}/kg
          </strong>
        </div>
        <div>
          <span className="block text-emerald-700 font-semibold">{t("listingDetail.marketRangeExpected")}</span>
          <strong className="block text-emerald-900 font-mono font-extrabold mt-0.5">
            {formatPoisha(expectedPerKg)}/kg
          </strong>
        </div>
        <div>
          <span className="block text-stone-500 font-medium">{t("listingDetail.marketRangeHigh")}</span>
          <strong className="block text-stone-800 font-mono font-bold mt-0.5">
            {formatPoisha(highPerKg)}/kg
          </strong>
        </div>
      </div>
    </div>
  );
}
