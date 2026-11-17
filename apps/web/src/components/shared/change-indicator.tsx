import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { toBanglaDigits } from "../../lib/format.js";

export interface ChangeIndicatorProps {
  changePercent: number | null | undefined;
  label?: string;
  className?: string;
}

/**
 * Accessible KPI period-over-period change indicator.
 * Displays an arrow, numeric percentage, and descriptive label so meaning is
 * conveyed via iconography and text, NEVER by color alone (UI_UX_GUIDELINES §1, §2, §6).
 */
export function ChangeIndicator({
  changePercent,
  label,
  className = "",
}: ChangeIndicatorProps): ReactElement | null {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  if (changePercent === null || changePercent === undefined) {
    return null;
  }

  const comparisonLabel = label ?? t("farmerDashboard.vsPreviousPeriod");
  const roundedAbs = Math.abs(changePercent).toFixed(1);
  const formattedAbs = isBangla ? toBanglaDigits(roundedAbs) : roundedAbs;

  if (changePercent > 0) {
    return (
      <span
        className={`inline-flex flex-wrap items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 ${className}`}
        data-testid="change-indicator-positive"
      >
        <span aria-hidden="true" className="font-bold">
          ↑
        </span>
        <span>+{formattedAbs}%</span>
        <span className="font-normal text-muted-foreground">{comparisonLabel}</span>
      </span>
    );
  }

  if (changePercent < 0) {
    return (
      <span
        className={`inline-flex flex-wrap items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-800 ${className}`}
        data-testid="change-indicator-negative"
      >
        <span aria-hidden="true" className="font-bold">
          ↓
        </span>
        <span>-{formattedAbs}%</span>
        <span className="font-normal text-muted-foreground">{comparisonLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-700 ${className}`}
      data-testid="change-indicator-neutral"
    >
      <span aria-hidden="true">→</span>
      <span>0.0%</span>
      <span className="font-normal text-muted-foreground">{comparisonLabel}</span>
    </span>
  );
}
