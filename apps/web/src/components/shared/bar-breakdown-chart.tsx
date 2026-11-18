import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "../ui/chart.js";
import {
  formatCompactPoisha,
  formatLocalizedNumber,
  formatLocalizedPoisha,
} from "../../lib/format.js";

export interface BarBreakdownItem {
  cropId: string;
  cropSlug?: string;
  cropName: string;
  cropNameBn?: string;
  value: number; // in integer poisha (gross sales, net earnings, or spend)
  quantityKg: number;
  orderCount: number;
}

export interface BarBreakdownChartProps {
  title: string;
  subtitle?: string;
  data: BarBreakdownItem[];
  valueLabel?: string;
  emptyMessage?: string;
  isBangla?: boolean;
  color?: string; // CSS color string (defaults to warm amber or primary)
  className?: string;
  "data-testid"?: string;
}

export function BarBreakdownChart({
  title,
  subtitle,
  data = [],
  valueLabel,
  emptyMessage,
  isBangla = false,
  color = "hsl(38 92% 50%)",
  className = "",
  "data-testid": testId = "bar-breakdown-chart",
}: BarBreakdownChartProps): ReactElement {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const resolvedValueLabel = valueLabel ?? t("charts.value");
  const isEmpty = data.length === 0 || data.every((d) => d.value === 0 && d.quantityKg === 0);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const totalKg = data.reduce((sum, item) => sum + item.quantityKg, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.orderCount, 0);

  const chartConfig: ChartConfig = {
    value: {
      label: resolvedValueLabel,
      color,
    },
  };

  const formattedTotalValue = formatLocalizedPoisha(totalValue, isBangla);
  const formattedTotalKg = formatLocalizedNumber(totalKg, isBangla);
  const formattedTotalOrders = formatLocalizedNumber(totalOrders, isBangla);

  // Formatted data with resolved display names for charting
  const chartData = data.map((item) => ({
    ...item,
    displayName: isBangla ? item.cropNameBn || item.cropName : item.cropName,
  }));

  // Accessible summary: list each crop with value, volume, and orders
  const accessibleSummaryText = isEmpty
    ? (emptyMessage ?? t("charts.emptyCropBreakdown"))
    : data
        .map((item) => {
          const cropName = isBangla ? item.cropNameBn || item.cropName : item.cropName;
          const val = formatLocalizedPoisha(item.value, isBangla);
          const kg = formatLocalizedNumber(item.quantityKg, isBangla);
          const ord = formatLocalizedNumber(item.orderCount, isBangla);
          return `${cropName}: ${val} (${kg} kg, ${ord} ${t("charts.orders")})`;
        })
        .join(" • ");

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
          aria-label={t("charts.toggleView")}
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
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("charts.viewChart")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "table"}
            onClick={() => setViewMode("table")}
            data-testid={`${testId}-tab-table`}
            className={`min-h-8 rounded-md px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              viewMode === "table"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("charts.viewTable")}
          </button>
        </div>
      </div>

      {/* Accessible Text Summary (visible for screen readers and under header) */}
      <div
        className="mt-3 rounded-md bg-stone-50 border border-stone-200/80 px-3 py-2 text-xs text-stone-700"
        data-testid={`${testId}-text-summary`}
        aria-live="polite"
      >
        <span className="font-semibold text-foreground">{t("charts.accessibleSummary")}:</span>{" "}
        {accessibleSummaryText}
      </div>

      {/* Main Content Area */}
      <div className="mt-4">
        {isEmpty ? (
          /* Friendly Empty State */
          <div
            className="flex h-56 sm:h-64 flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50/50 p-6 text-center"
            data-testid={`${testId}-empty-state`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-stone-600">
              {emptyMessage ?? t("charts.emptyCropBreakdown")}
            </p>
          </div>
        ) : viewMode === "chart" ? (
          /* Recharts Interactive Bar Chart */
          <div className="h-64 sm:h-72 w-full max-w-full overflow-hidden">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis
                  dataKey="displayName"
                  tickLine={false}
                  axisLine={{ stroke: "#e7e5e4" }}
                  tickMargin={8}
                  tick={{ fontSize: 10, fill: "#78716c" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 10, fill: "#78716c" }}
                  tickFormatter={(val: number) => formatCompactPoisha(val, isBangla)}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0];
                    const point = (item?.payload ?? null) as (BarBreakdownItem & { displayName: string }) | null;
                    if (!point) return null;

                    const formattedValue = formatLocalizedPoisha(point.value, isBangla);
                    const formattedKg = formatLocalizedNumber(point.quantityKg, isBangla);
                    const formattedOrders = formatLocalizedNumber(point.orderCount, isBangla);

                    return (
                      <div className="min-w-[10rem] rounded-lg border border-stone-200 bg-white p-3 text-xs shadow-lg">
                        <p className="font-bold text-foreground border-b border-stone-100 pb-1.5">
                          {point.displayName}
                        </p>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{resolvedValueLabel}:</span>
                            <span className="font-bold text-foreground">{formattedValue}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t("charts.quantity")}:</span>
                            <span className="font-medium text-stone-700">{formattedKg} kg</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{t("charts.orders")}:</span>
                            <span className="font-medium text-stone-700">{formattedOrders}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          /* Accessible Data Table View */
          <div
            className="overflow-x-auto rounded-lg border border-stone-200 max-w-full"
            data-testid={`${testId}-table`}
          >
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 font-semibold text-stone-900">
                <tr>
                  <th scope="col" className="px-3.5 py-2.5">
                    {t("charts.crop")}
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">
                    {resolvedValueLabel}
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">
                    {t("charts.quantity")}
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">
                    {t("charts.orders")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {data.map((item) => (
                  <tr key={item.cropId} className="hover:bg-stone-50/80">
                    <td className="px-3.5 py-2 font-medium text-foreground">
                      {isBangla ? item.cropNameBn || item.cropName : item.cropName}
                    </td>
                    <td className="px-3.5 py-2 text-right font-bold text-foreground">
                      {formatLocalizedPoisha(item.value, isBangla)}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      {formatLocalizedNumber(item.quantityKg, isBangla)} kg
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      {formatLocalizedNumber(item.orderCount, isBangla)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-stone-200 bg-stone-50/80 font-bold text-stone-900">
                <tr>
                  <td className="px-3.5 py-2">{t("charts.total")}</td>
                  <td className="px-3.5 py-2 text-right text-foreground">
                    {formattedTotalValue}
                  </td>
                  <td className="px-3.5 py-2 text-right">{formattedTotalKg} kg</td>
                  <td className="px-3.5 py-2 text-right">{formattedTotalOrders}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}