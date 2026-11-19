import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { usePublicConfig } from "../features/listings/api/use-listing-wizard-api.js";

export function DemoModeBadge(): ReactElement | null {
  const { data: config } = usePublicConfig();
  const { t } = useTranslation();

  if (!config?.demoMode) {
    return null;
  }

  return (
    <span
      data-testid="demo-mode-badge"
      className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300"
    >
      {t("demoModeBadge", "Demo mode: timers are shortened")}
    </span>
  );
}
