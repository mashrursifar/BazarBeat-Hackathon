import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { OrderStatus } from "@bazarbeat/shared";

import { cn } from "../../lib/utils.js";

export interface OrderStatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  [OrderStatus.PENDING]: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-300",
  },
  [OrderStatus.CONFIRMED]: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    border: "border-sky-300",
  },
  [OrderStatus.DELIVERED]: {
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-300",
  },
  [OrderStatus.COMPLETED]: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-300",
  },
  [OrderStatus.CANCELLED]: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-300",
  },
  [OrderStatus.DISPUTED]: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-300",
  },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps): ReactElement {
  const { t } = useTranslation();
  const style = STATUS_STYLES[status] ?? {
    bg: "bg-stone-50",
    text: "text-stone-800",
    border: "border-stone-300",
  };

  const label = t(`orders.status.${status}`, status);

  return (
    <span
      data-slot="order-status-badge"
      data-testid="order-status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        style.bg,
        style.text,
        style.border,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
