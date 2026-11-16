import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { StockReturnDecision } from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { cn } from "../../..//lib/utils.js";

export interface StockReturnPromptProps {
  orderId?: string;
  stockReturn?: {
    decision: StockReturnDecision | string;
    decidedAt: string;
    note?: string;
  };
  isPending: boolean;
  onDecision: (decision: StockReturnDecision) => Promise<void> | void;
  className?: string;
}

export function StockReturnPrompt({
  stockReturn,
  isPending,
  onDecision,
  className,
}: StockReturnPromptProps): ReactElement {
  const { t } = useTranslation();

  // If already decided, show status banner
  if (stockReturn) {
    const isReturned = stockReturn.decision === StockReturnDecision.RETURNED;
    return (
      <div
        data-slot="stock-return-decided"
        data-testid="stock-return-decided"
        className={cn(
          "rounded-lg border p-3 text-xs",
          isReturned
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-stone-200 bg-stone-50 text-stone-700",
          className,
        )}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          <span aria-hidden="true">{isReturned ? "✓" : "✗"}</span>
          <span>
            {isReturned
              ? t("orders.stockReturn.returnedBadge", "Stock returned to your available inventory")
              : t("orders.stockReturn.discardedBadge", "Stock marked as discarded / sold locally")}
          </span>
        </div>
        {stockReturn.note && (
          <p className="mt-1 text-stone-600">{stockReturn.note}</p>
        )}
      </div>
    );
  }

  // Active prompt for cancelled order
  return (
    <div
      data-slot="stock-return-prompt"
      data-testid="stock-return-prompt"
      className={cn(
        "rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg" aria-hidden="true">📦</span>
        <div>
          <h4 className="font-bold text-amber-950">
            {t("orders.stockReturn.promptTitle", "Add this stock back to your inventory?")}
          </h4>
          <p className="mt-0.5 text-xs text-amber-800">
            {t(
              "orders.stockReturn.promptDescription",
              "Since this order was cancelled, select 'Yes' to return the quantity back to your available inventory so you can relist it, or 'No' if produce is damaged or sold elsewhere.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          data-testid="stock-return-yes"
          onClick={() => void onDecision(StockReturnDecision.RETURNED)}
          disabled={isPending}
          className="h-10 min-h-10 w-auto bg-emerald-700 px-5 text-xs font-bold text-white hover:bg-emerald-800"
        >
          {isPending ? t("orders.stockReturn.saving", "Saving…") : t("orders.stockReturn.yes", "Yes, add back")}
        </Button>
        <Button
          type="button"
          data-testid="stock-return-no"
          onClick={() => void onDecision(StockReturnDecision.DISCARDED)}
          disabled={isPending}
          className="h-10 min-h-10 w-auto bg-stone-200 px-4 text-xs font-semibold text-stone-800 hover:bg-stone-300"
        >
          {isPending ? t("orders.stockReturn.saving", "Saving…") : t("orders.stockReturn.no", "No, do not add")}
        </Button>
      </div>
    </div>
  );
}
