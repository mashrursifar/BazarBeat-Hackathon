import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils.js";

export function PhotoTipsCard({ className }: { className?: string }): ReactElement {
  const { t } = useTranslation();

  const tips = [
    {
      id: "light",
      title: t("photoTips.lightTitle", "Natural daylight"),
      desc: t("photoTips.lightDesc", "Take photos in daylight. Avoid dark areas and harsh flashes."),
      icon: (
        <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      id: "background",
      title: t("photoTips.backgroundTitle", "Plain background"),
      desc: t("photoTips.backgroundDesc", "Place crop on a clean floor, mat, or sack."),
      icon: (
        <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "multi",
      title: t("photoTips.multiTitle", "Show 3+ pieces"),
      desc: t("photoTips.multiDesc", "Show several pieces together, then 1 close-up photo."),
      icon: (
        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      id: "clear",
      title: t("photoTips.clearTitle", "Clear and unobstructed"),
      desc: t("photoTips.clearDesc", "No hands covering the crop. Do not apply beauty or color filters."),
      icon: (
        <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      data-testid="photo-tips-card"
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 shadow-sm text-stone-800",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-800 text-xs font-bold">
          💡
        </span>
        <h3 className="font-bold text-sm sm:text-base text-amber-950">
          {t("photoTips.cardTitle", "Tips for best AI quality grading")}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {tips.map((tip) => (
          <div
            key={tip.id}
            className="flex items-start gap-2.5 rounded-lg bg-white/80 p-2.5 border border-amber-100 shadow-2xs"
          >
            <div className="shrink-0 mt-0.5">{tip.icon}</div>
            <div>
              <p className="text-xs font-bold text-stone-900">{tip.title}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                {tip.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
