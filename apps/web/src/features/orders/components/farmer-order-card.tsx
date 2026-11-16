import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type FarmerOrderCard as FarmerOrderCardType,
  OrderAction,
  OrderStatus,
  type StockReturnDecision,
  UserRole,
  getOrderActions,
} from "@bazarbeat/shared";

import { CountdownTimer } from "../../../components/shared/countdown-timer.js";
import { CounterpartyCard } from "../../../components/shared/counterparty-card.js";
import { GradeBadge } from "../../../components/shared/grade-badge.js";
import { OrderStatusBadge } from "../../../components/shared/order-status-badge.js";
import { Button } from "../../../components/ui/button.js";
import { formatLocalizedNumber, formatLocalizedPoisha } from "../../../lib/format.js";
import { StockReturnPrompt } from "./stock-return-prompt.js";

export interface FarmerOrderCardProps {
  order: FarmerOrderCardType;
  onConfirmClick?: (order: FarmerOrderCardType) => void;
  onMarkDelivered?: (orderId: string) => Promise<void> | void;
  onCancelClick?: (order: FarmerOrderCardType) => void;
  onStockReturnDecision?: (orderId: string, decision: StockReturnDecision) => Promise<void> | void;
  isActionPending?: boolean;
}

export function FarmerOrderCardComponent({
  order,
  onConfirmClick,
  onMarkDelivered,
  onCancelClick,
  onStockReturnDecision,
  isActionPending = false,
}: FarmerOrderCardProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const cropName = isBangla ? order.cropNameBn : order.cropName;
  const actions = getOrderActions(UserRole.FARMER, {
    status: order.status,
    payment: {
      status: order.payment.status,
      method: order.payment.method,
    },
  });

  const canConfirm = actions.includes(OrderAction.CONFIRM);
  const canMarkDelivered = actions.includes(OrderAction.MARK_DELIVERED);
  const canCancel = actions.includes(OrderAction.CANCEL);
  const isCancelled = order.status === OrderStatus.CANCELLED;

  const cancelDeadline = order.autoCancelDeadline ?? order.deadline;

  return (
    <article
      data-slot="farmer-order-card"
      data-order-id={order.id}
      data-status={order.status}
      className="flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
    >
      <div>
        {/* Header: Crop info, grade, and status */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {order.imageUrl && (
              <img
                src={order.imageUrl}
                alt={cropName}
                className="h-12 w-12 rounded-lg object-cover ring-1 ring-stone-200"
                loading="lazy"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900">{cropName}</h3>
                <GradeBadge grade={order.grade} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("orders.orderId", "Order")}: #{order.id.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Auto-cancel countdown for PENDING orders */}
        {order.status === OrderStatus.PENDING && cancelDeadline && (
          <div
            data-testid="auto-cancel-countdown"
            className="mt-3 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50/80 px-3 py-2 text-xs text-amber-900"
          >
            <span className="font-medium">
              {t("orders.autoCancelTimer", "Auto-cancels if not confirmed in:")}
            </span>
            <CountdownTimer endsAt={cancelDeadline} size="sm" />
          </div>
        )}

        {/* Quantity and Money Summary */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-stone-50 p-3 text-xs sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("orders.quantity", "Quantity")}</p>
            <p className="font-semibold text-stone-900">
              {formatLocalizedNumber(order.quantityKg, isBangla)} {t("orders.kg", "kg")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("orders.unitPrice", "Price/kg")}</p>
            <p className="font-semibold text-stone-900">
              {formatLocalizedPoisha(order.pricePerKg, isBangla)}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-muted-foreground">{t("orders.netEarnings", "Net payout")}</p>
            <p className="text-sm font-bold text-primary">
              {formatLocalizedPoisha(order.farmerNet, isBangla)}
            </p>
          </div>
        </div>

        {/* Buyer Counterparty Card (masked or revealed) */}
        <div className="mt-3">
          <CounterpartyCard counterparty={order.buyer} />
        </div>

        {/* Stock return prompt for cancelled orders */}
        {isCancelled && onStockReturnDecision && (
          <div className="mt-3">
            <StockReturnPrompt
              orderId={order.id}
              stockReturn={order.stockReturn}
              isPending={isActionPending}
              onDecision={(decision) => onStockReturnDecision(order.id, decision)}
            />
          </div>
        )}
      </div>

      {/* Footer: Action buttons */}
      <div className="mt-4 border-t border-stone-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to={`/farmer/orders/${order.id}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {t("orders.viewDetails", "View details →")}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {canConfirm && onConfirmClick && (
              <Button
                type="button"
                data-testid="order-action-confirm"
                onClick={() => onConfirmClick(order)}
                disabled={isActionPending}
                className="h-9 min-h-9 w-auto bg-primary px-3 text-xs text-white"
              >
                {isActionPending
                  ? t("orders.actions.confirming", "Please wait…")
                  : t("orders.actions.confirm", "Confirm order")}
              </Button>
            )}

            {canMarkDelivered && onMarkDelivered && (
              <Button
                type="button"
                data-testid="order-action-deliver"
                onClick={() => void onMarkDelivered(order.id)}
                disabled={isActionPending}
                className="h-9 min-h-9 w-auto bg-indigo-600 px-3 text-xs text-white hover:bg-indigo-700"
              >
                {isActionPending
                  ? t("orders.actions.delivering", "Please wait…")
                  : t("orders.actions.markDelivered", "Mark delivered")}
              </Button>
            )}

            {canCancel && onCancelClick && (
              <Button
                type="button"
                data-testid="order-action-cancel"
                onClick={() => onCancelClick(order)}
                disabled={isActionPending}
                className="h-9 min-h-9 w-auto border border-rose-300 bg-white px-3 text-xs text-rose-700 hover:bg-rose-50"
              >
                {t("orders.actions.cancel", "Cancel")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
