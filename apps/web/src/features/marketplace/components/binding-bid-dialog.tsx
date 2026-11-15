import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { formatPoisha } from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { formatLocalizedNumber } from "../../../lib/format.js";

export interface BindingBidDialogProps {
  isOpen: boolean;
  isPending: boolean;
  pricePerKgInPoisha: number;
  quantityKg: number;
  totalCostInPoisha: number;
  onConfirm: () => void;
  onClose: () => void;
  error?: string | null;
}

export function BindingBidDialog({
  isOpen,
  isPending,
  pricePerKgInPoisha,
  quantityKg,
  totalCostInPoisha,
  onConfirm,
  onClose,
  error,
}: BindingBidDialogProps): ReactElement | null {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="binding-dialog-title"
        data-testid="binding-bid-dialog"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-lg">
            ⚖️
          </div>
          <div>
            <h2
              id="binding-dialog-title"
              data-testid="binding-dialog-title"
              className="text-lg font-bold text-stone-900"
            >
              {t("bidPanel.dialog.title")}
            </h2>
          </div>
        </div>

        {/* Legal Binding Disclaimer */}
        <div
          data-testid="binding-disclaimer"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs sm:text-sm text-amber-900 leading-relaxed font-medium"
        >
          {t("bidPanel.dialog.disclaimer")}
        </div>

        {/* Bid Breakdown Summary */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 space-y-2 text-sm">
          <div className="flex justify-between items-center text-stone-600">
            <span>{t("bidPanel.dialog.pricePerKg")}</span>
            <span
              data-testid="confirm-price-per-kg"
              className="font-mono font-bold text-stone-900 text-base"
            >
              {formatPoisha(pricePerKgInPoisha)}
              <span className="text-xs font-normal text-stone-500">/kg</span>
            </span>
          </div>

          <div className="flex justify-between items-center text-stone-600">
            <span>{t("bidPanel.dialog.quantity")}</span>
            <span
              data-testid="confirm-quantity"
              className="font-semibold text-stone-800"
            >
              {formatLocalizedNumber(quantityKg, isBangla)} kg
            </span>
          </div>

          <div className="border-t border-stone-200 pt-2 flex justify-between items-center">
            <span className="font-semibold text-stone-800">
              {t("bidPanel.dialog.totalCost")}
            </span>
            <span
              data-testid="confirm-total-cost"
              className="font-mono font-extrabold text-primary text-lg"
            >
              {formatPoisha(totalCostInPoisha)}
            </span>
          </div>
        </div>

        {/* Error message if submission failed */}
        {error && (
          <div
            role="alert"
            data-testid="dialog-error-banner"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-700 font-medium"
          >
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            data-testid="cancel-bid-btn"
            disabled={isPending}
            onClick={onClose}
            className="w-full sm:w-auto bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200"
          >
            {t("bidPanel.dialog.cancel")}
          </Button>

          <Button
            type="button"
            data-testid="confirm-bid-btn"
            disabled={isPending}
            onClick={onConfirm}
            className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90"
          >
            {isPending ? t("bidPanel.dialog.submitting") : t("bidPanel.dialog.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
