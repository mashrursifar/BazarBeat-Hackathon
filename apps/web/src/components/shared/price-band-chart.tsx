import { type ReactElement, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "../ui/chart.js";
import {
  formatBucketDate,
  formatCompactPoisha,
  formatLocalizedPoisha,
} from "../../lib/format.js";

export interface PriceBandChartPoint {
  date: string;
  avgPricePerKg: number; // in integer poisha
  minPricePerKg: number; // in integer poisha
  maxPricePerKg: number; // in integer poisha
  source?: string;
}

export interface PriceBandChartProps {
  title: string;
  subtitle?: string;
  data: PriceBandChartPoint[];
  emptyMessage?: string;
  isBangla?: boolean;
  color?: string; // primary line color
  bandColor?: string; // band fill color
  className?: string;
  "data-testid"?: string;
}

export function PriceBandChart({
  title,
  subtitle,
  data = [],
  emptyMessage,
  isBangla = false,
  color = "hsl(145 58% 28%)",
  bandColor = "hsl(145 58% 28% / 0.18)",
  className = "",
  "data-testid": testId = "price-band-chart",
}: PriceBandChartProps): ReactElement {
  const { t } = useTranslation();
  const gradientId = useId().replace(/:/g, "");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const isEmpty =
    data.length === 0 ||
    data.every((d) => d.avgPricePerKg === 0 && d.minPricePerKg === 0 && d.maxPricePerKg === 0);

  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatBucketDate(d.date.slice(0, 10), isBangla),
    band: [d.minPricePerKg, d.maxPricePerKg],
  }));

  const chartConfig: ChartConfig = {
    avgPrice: {
      label: t("charts.avgPrice", "Average Price"),
      color,
    },
    band: {
      label: t("charts.priceRange", "Min–Max Band"),
      color: bandColor,
    },
  };

  // Find min and max for Y-axis domain
  const allMins = data.map((d) => d.minPricePerKg).filter((p) => p > 0);
  const allMaxs = data.map((d) => d.maxPricePerKg).filter((p) => p > 0);
  const dataMin = allMins.length > 0 ? Math.min(...allMins) : 0;
  const dataMax = allMaxs.length > 0 ? Math.max(...allMaxs) : 10000;
  const yMin = Math.max(0, Math.floor((dataMin * 0.9) / 500) * 500);
  const yMax = Math.ceil((dataMax * 1.1) / 500) * 500;

  const accessibleSummaryText = isEmpty
    ? (emptyMessage ?? t("charts.emptyPriceHistory", "No price history available for the selected period."))
    : `${title}: ${data.length} data points, latest avg ${formatLocalizedPoisha(
        data[data.length - 1]?.avgPricePerKg ?? 0,
        isBangla,
      )}/kg.`;

  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white p-4 sm:p-6 shadow-sm w-full max-w-full overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Header with Title, Subtitle, and View Mode Toggle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground sm:text-lg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        {/* View Switcher: Chart vs Accessible Data Table */}
        <div
          role="tablist"
          aria-label={t("charts.toggleView", "Toggle chart view")}
          className="inline-flex self-start sm:self-auto rounded-lg border border-stone-200 bg-stone-100 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "chart"}
            onClick={() => setViewMode("chart")}
            data-testid={`${testId}-tab-chart`}
            className={`min-h-8 rounded-md px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewMode === "chart"
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("charts.chartView", "Chart")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "table"}
            onClick={() => setViewMode("table")}
            data-testid={`${testId}-tab-table`}
            className={`min-h-8 rounded-md px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewMode === "table"
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("charts.tableView", "Table")}
          </button>
        </div>
      </div>

      {/* Screen Reader Accessible Summary */}
      <p className="sr-only" aria-live="polite">
        {accessibleSummaryText}
      </p>

      {/* Content Area */}
      {isEmpty ? (
        <div
          className="flex h-56 w-full items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50/50 p-6 text-center text-sm text-muted-foreground"
          data-testid={`${testId}-empty`}
        >
          {emptyMessage ?? t("charts.emptyPriceHistory", "No price history available for the selected period.")}
        </div>
      ) : viewMode === "chart" ? (
        <div className="mt-4 w-full">
          {/* Legend indicators */}
          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="font-medium text-foreground">{t("charts.avgPrice", "Average Price (৳/kg)")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-5 rounded-sm border border-emerald-300"
                style={{ backgroundColor: bandColor }}
              />
              <span className="font-medium text-foreground">{t("charts.priceRange", "Min–Max Range")}</span>
            </div>
          </div>

          <ChartContainer config={chartConfig} className="h-64 sm:h-72 w-full aspect-auto">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[yMin, yMax]}
                  tickFormatter={(val: number) => formatCompactPoisha(val, isBangla)}
                  tickMargin={6}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0]?.payload as (typeof chartData)[number] | undefined;
                    if (!point) return null;

                    return (
                      <div className="rounded-lg border border-stone-200 bg-white p-2.5 shadow-md text-xs">
                        <div className="font-bold text-foreground mb-1.5">{point.dateLabel || point.date}</div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                              {t("charts.avgPrice", "Average Price")}:
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatLocalizedPoisha(point.avgPricePerKg, isBangla)} / kg
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                              {t("charts.priceRange", "Min–Max")}:
                            </span>
                            <span className="font-medium text-stone-600">
                              {formatLocalizedPoisha(point.minPricePerKg, isBangla)} –{" "}
                              {formatLocalizedPoisha(point.maxPricePerKg, isBangla)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="transparent"
                  fill={bandColor}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="avgPricePerKg"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: color }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      ) : (
        <div
          className="mt-4 max-h-72 w-full overflow-y-auto overflow-x-auto rounded-lg border border-stone-200"
          data-testid={`${testId}-table`}
        >
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="sticky top-0 bg-stone-100 text-stone-700">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("charts.date", "Date")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">
                  {t("charts.avgPrice", "Average (৳/kg)")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">
                  {t("charts.minPrice", "Min (৳/kg)")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">
                  {t("charts.maxPrice", "Max (৳/kg)")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {data.map((row, idx) => (
                <tr key={`${row.date}-${idx}`} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {formatBucketDate(row.date.slice(0, 10), isBangla) || row.date}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-primary">
                    {formatLocalizedPoisha(row.avgPricePerKg, isBangla)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatLocalizedPoisha(row.minPricePerKg, isBangla)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatLocalizedPoisha(row.maxPricePerKg, isBangla)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
