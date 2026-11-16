import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { type CounterpartyDto, UserRole } from "@bazarbeat/shared";

import { cn } from "../../lib/utils.js";

export interface CounterpartyCardProps {
  counterparty: CounterpartyDto;
  title?: string;
  className?: string;
}

export function CounterpartyCard({
  counterparty,
  title,
  className,
}: CounterpartyCardProps): ReactElement {
  const { t } = useTranslation();

  const isFarmer = counterparty.role === UserRole.FARMER;
  const defaultTitle = isFarmer
    ? t("orders.counterparty.farmerInfo", "Farmer Information")
    : t("orders.counterparty.buyerInfo", "Buyer Information");

  if (counterparty.isMasked) {
    const locationParts = [counterparty.division, counterparty.district].filter(Boolean);
    const locationText = locationParts.join(", ");

    return (
      <div
        data-slot="counterparty-card"
        data-testid="counterparty-masked"
        className={cn(
          "rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-stone-800",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-stone-900">{title ?? defaultTitle}</h4>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {t("orders.counterparty.contactMaskedBadge", "Contact hidden")}
          </span>
        </div>

        <p className="mt-2 text-base font-medium text-stone-900">
          {counterparty.name}
        </p>

        {locationText && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("orders.counterparty.region", "Region")}: {locationText}
          </p>
        )}

        <div className="mt-3 flex items-start gap-2 rounded border border-amber-300 bg-white/80 p-2 text-xs text-amber-900">
          <span className="font-bold" aria-hidden="true">🔒</span>
          <p>
            {t(
              "orders.counterparty.maskedNotice",
              "Phone number and full pickup address will be revealed once you confirm this order.",
            )}
          </p>
        </div>
      </div>
    );
  }

  // Revealed State
  const location = counterparty.location;
  const locationParts = location
    ? [location.upazila, location.district, location.division].filter(Boolean)
    : [];
  const fullAddress = locationParts.join(", ");

  return (
    <div
      data-slot="counterparty-card"
      data-testid="counterparty-revealed"
      className={cn(
        "rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 text-sm text-stone-800",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-stone-900">{title ?? defaultTitle}</h4>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
          {t("orders.counterparty.contactRevealedBadge", "Contact verified")}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-base font-semibold text-stone-900">{counterparty.name}</p>

        {counterparty.organizationName && (
          <p className="text-xs font-medium text-stone-600">
            {counterparty.organizationName}
          </p>
        )}

        {counterparty.phone && (
          <div className="pt-1">
            <a
              href={`tel:${counterparty.phone}`}
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <span aria-hidden="true">📞</span>
              <span>{counterparty.phone}</span>
            </a>
          </div>
        )}

        {fullAddress && (
          <p className="pt-1 text-xs text-muted-foreground">
            <span className="font-medium text-stone-700">
              {t("orders.counterparty.location", "Location")}:
            </span>{" "}
            {fullAddress}
          </p>
        )}
      </div>
    </div>
  );
}
