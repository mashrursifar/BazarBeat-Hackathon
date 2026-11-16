import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { formatLocalizedNumber, formatLocalizedPoisha } from "../../lib/format.js";
import { cn } from "../../lib/utils.js";

export interface MoneyBreakdownProps {
  pricePerKg: number;
  quantityKg: number;
  subtotal: number;
  platformFee: number;
  feeRateBps?: number;
  feeRatePercent?: number;
  farmerNet: number;
  role?: "farmer" | "buyer";
  className?: string;
}

export function MoneyBreakdown({
  pricePerKg,
  quantityKg,
  subtotal,
  platformFee,
  feeRateBps = 200,
  feeRatePercent,
  farmerNet,
  role = "farmer",
  className,
}: MoneyBreakdownProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const ratePercent =
    feeRatePercent !== undefined ? feeRatePercent : Math.round((feeRateBps / 100) * 10) / 10;
  const rateText = isBangla
    ? `${formatLocalizedNumber(ratePercent, true)}%`
    : `${ratePercent}%`;

  return (
    <div
      data-slot="money-breakdown"
      className={cn("rounded-lg border border-stone-200 bg-stone-50/50 p-4 text-sm", className)}
    >
      <dl className="space-y-2">
        <div className="flex items-center justify-between text-stone-600">
          <dt>{t("orders.money.unitPrice", "Price per kg")}</dt>
          <dd className="font-medium">
            {formatLocalizedPoisha(pricePerKg, isBangla)} / {t("orders.kg", "kg")}
          </dd>
        </div>

        <div className="flex items-center justify-between text-stone-600">
          <dt>{t("orders.money.quantity", "Quantity")}</dt>
          <dd className="font-medium">
            {formatLocalizedNumber(quantityKg, isBangla)} {t("orders.kg", "kg")}
          </dd>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-stone-700">
          <dt>{t("orders.money.subtotal", "Subtotal")}</dt>
          <dd className="font-semibold text-stone-900">
            {formatLocalizedPoisha(subtotal, isBangla)}
          </dd>
        </div>

        {role === "farmer" && (
          <div className="flex items-center justify-between text-rose-700">
            <dt>
              {t("orders.money.platformFee", "Platform fee")} ({rateText})
            </dt>
            <dd className="font-medium">
              - {formatLocalizedPoisha(platformFee, isBangla)}
            </dd>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-stone-300 pt-2 text-base font-bold text-stone-900">
          <dt>
            {role === "farmer"
              ? t("orders.money.netPayout", "Net payout")
              : t("orders.money.totalDue", "Total amount")}
          </dt>
          <dd className="text-primary">
            {formatLocalizedPoisha(role === "farmer" ? farmerNet : subtotal, isBangla)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
