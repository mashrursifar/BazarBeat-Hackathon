import { type ReactElement } from "react";
import { type EarningsMonthlySeriesItem, formatPoisha } from "@bazarbeat/shared";

interface EarningsSixMonthChartProps {
  series: EarningsMonthlySeriesItem[];
  isBangla?: boolean;
}

const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_BN = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];

export function EarningsSixMonthChart({
  series,
  isBangla = false,
}: EarningsSixMonthChartProps): ReactElement {
  const maxNet = Math.max(...series.map((item) => item.net), 1);

  return (
    <div className="w-full" data-testid="earnings-six-month-chart">
      {/* Visual Chart Bars */}
      <div className="flex h-56 items-end justify-between gap-2 sm:gap-4 pt-8 pb-2">
        {series.map((item) => {
          const heightPercent = item.net > 0 ? Math.max(12, Math.round((item.net / maxNet) * 100)) : 4;
          const monthIndex = item.monthIndex - 1;
          const monthLabel = isBangla
            ? `${MONTH_NAMES_BN[monthIndex]} '${String(item.year).slice(-2)}`
            : `${MONTH_NAMES_EN[monthIndex]} '${String(item.year).slice(-2)}`;

          return (
            <div
              key={item.month}
              className="group flex flex-1 flex-col items-center justify-end h-full min-w-0"
              data-testid={`earnings-bar-${item.month}`}
              aria-label={`${monthLabel}: Net ${formatPoisha(item.net)}, ${item.orderCount} orders, ${item.totalKg} kg`}
            >
              {/* Value on top of bar */}
              <span className="mb-1.5 truncate text-[10px] sm:text-xs font-semibold text-stone-700">
                {item.net > 0 ? formatPoisha(item.net) : "৳0"}
              </span>

              {/* Bar */}
              <div className="relative w-full max-w-[3.5rem] rounded-t-md bg-stone-100 transition-all group-hover:bg-emerald-100 flex items-end justify-center overflow-hidden h-full">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all ${
                    item.net > 0 ? "bg-emerald-600 group-hover:bg-emerald-700" : "bg-stone-300"
                  }`}
                />
              </div>

              {/* Month label below bar */}
              <div className="mt-2 text-center w-full">
                <p className="truncate text-xs font-bold text-foreground">{monthLabel}</p>
                <p className="hidden sm:block text-[10px] text-muted-foreground truncate">
                  {item.totalKg} kg
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
