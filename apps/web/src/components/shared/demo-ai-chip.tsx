import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../lib/utils.js";

export interface DemoAiChipProps {
  className?: string;
  size?: "sm" | "md";
  provider?: string;
  degraded?: boolean;
}

export function DemoAiChip({
  className,
  size = "md",
  provider,
  degraded = false,
}: DemoAiChipProps): ReactElement {
  const { t } = useTranslation();

  const isGeminiLive = provider?.toLowerCase() === "gemini" && !degraded;
  const chipLabel = isGeminiLive
    ? t("marketplace.geminiAiChip", "Gemini")
    : t("marketplace.demoAiChip", "Demo AI model");
  const chipTooltip = isGeminiLive
    ? t(
        "marketplace.geminiAiTooltip",
        "Produce quality evaluated by Google Gemini multimodal AI model.",
      )
    : t("marketplace.demoAiTooltip");

  return (
    <div
      data-testid="demo-ai-chip"
      role="status"
      title={chipTooltip}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium shadow-xs select-none",
        isGeminiLive
          ? "border border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
          : "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs sm:text-sm",
        className,
      )}
    >
      <svg
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isGeminiLive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-emerald-600 dark:text-emerald-400",
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
      <span className="font-semibold tracking-tight">{chipLabel}</span>
    </div>
  );
}
