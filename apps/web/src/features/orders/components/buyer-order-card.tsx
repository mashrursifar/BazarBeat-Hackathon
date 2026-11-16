import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type BuyerOrderCard as BuyerOrderCardType,
  OrderAction,
  OrderStatus,
  PaymentStatus,
  UserRole,
  getOrderActions,
} from "@bazarbeat/shared";

import { CountdownTimer } from "../../../components/shared/countdown-timer.js";
import { CounterpartyCard } from "../../../components/shared/counterparty-card.js";
import { GradeBadge } from "../../../components/shared/grade-badge.js";
import { OrderStatusBadge } from "../../../components/shared/order-status-badge.js";
import { Button } from "../../../components/ui/button.js";
import { formatLocalizedNumber, formatLocalizedPoisha } from "../../../lib/format.js";

export interface BuyerOrderCardProps {
  order: BuyerOrderCardType;
  onPayClick?: (order: BuyerOrderCardType) => void;
  onConfirmReceipt?: (orderId: string) => Promise<void> | void;
  onCancelClick?: (order: BuyerOrderCardType) => void;
  isActionPending?: boolean;
}

export function BuyerOrderCardComponent({
  order,
  onPayClick,
  onConfirmReceipt,
  onCancelClick,
  isActionPending = false,
}: BuyerOrderCardProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const cropName = isBangla ? order.cropNameBn : order.cropName;
  const isPaid = order.payment.status === PaymentStatus.PAID;
  const isPending = order.status === OrderStatus.PENDING;
  const isDelivered = order.status === OrderStatus.DELIVERED;
  const isConfirmed = order.status === OrderStatus.CONFIRMED;

  const actions = getOrderActions(UserRole.BUYER, {
    status: order.status,
    payment: {
      status: order.payment.status,
      method: order.payment.method,
    },
  });

  const canPay = actions.includes(OrderAction.MARK_PAID);
  const canCancel = actions.includes(OrderAction.CANCEL);
  const canComplete = actions.includes(OrderAction.COMPLETE);

  const cancelDeadline = order.autoCancelDeadline ?? order.deadline;
  const completeDeadline = order.autoCompleteDeadline ?? order.deadline;

  return (
    <article
      data-slot="buyer-order-card"
      data-testid="buyer-order-card"
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
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* Payment status pill */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          {isPaid ? (
            <span
              data-testid="payment-badge-paid"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800"
            >
              ✓ {order.payment.method === "WALLET_SIM"
                ? t("orders.payment.paidWallet", "Paid (Demo Wallet)")
                : t("orders.payment.paidCod", "Paid (COD)")}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="payment-badge-unpaid"
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800"
              >
                ⏳ {t("orders.payment.unpaid", "Pay on delivery / Unpaid")}
              </span>
              <span
                data-testid="demo-payment-label"
                className="text-[11px] font-medium text-blue-700"
              >
                {t("orders.payment.demoLabel", "Demo payment. No real money.")}
              </span>
            </div>
          )}
        </div>

        {/* Auto-cancel countdown for PENDING orders */}
        {isPending && cancelDeadline && (
          <div
            data-testid="auto-cancel-countdown"
            className="mt-3 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50/80 px-3 py-2 text-xs text-amber-900"
          >
            <span className="font-medium">
              {t("orders.autoCancelTimerBuyer", "Farmer must confirm in:")}
            </span>
            <CountdownTimer endsAt={cancelDeadline} size="sm" />
          </div>
        )}

        {/* Auto-complete countdown for DELIVERED orders */}
        {isDelivered && completeDeadline && (
          <div
            data-testid="auto-complete-countdown"
            className="mt-3 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
          >
            <span className="font-medium">
              {t("orders.autoCompleteTimer", "Auto-completes in:")}
            </span>
            <CountdownTimer endsAt={completeDeadline} size="sm" />
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
            <p className="text-muted-foreground">{t("orders.totalDue", "Total amount")}</p>
            <p className="text-sm font-bold text-primary">
              {formatLocalizedPoisha(order.totalAmount ?? order.subtotal, isBangla)}
            </p>
          </div>
        </div>

        {/* Pickup / Handover details when confirmed */}
        {(isConfirmed || isDelivered || order.status === OrderStatus.COMPLETED) && order.fulfilment?.handoverAt && (
          <div
            data-testid="pickup-info-box"
            className="mt-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3 text-xs space-y-1"
          >
            <div className="flex items-center justify-between font-semibold text-stone-800">
              <span>{t("orders.handoverScheduleTitle", "Scheduled Handover")}</span>
              <span className="text-[11px] text-muted-foreground">
                {order.fulfilment.method}
              </span>
            </div>
            <p className="text-stone-700">
              <span className="font-medium">{t("orders.handoverAt", "Ready for pickup at")}:</span>{" "}
              {new Date(order.fulfilment.handoverAt).toLocaleString(isBangla ? "bn-BD" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            {order.fulfilment.note && (
              <p className="text-stone-600">
                <span className="font-medium">{t("orders.pickupInstructions", "Instructions")}:</span>{" "}
                {order.fulfilment.note}
              </p>
            )}
          </div>
        )}

        {/* Farmer Counterparty Card (masked or revealed) */}
        <div className="mt-3">
          <CounterpartyCard counterparty={order.farmer} />
        </div>
      </div>

      {/* Footer: Action buttons */}
      <div className="mt-4 border-t border-stone-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to={`/buyer/orders/${order.id}`}
            data-testid="order-detail-link"
            className="text-xs font-semibold text-primary hover:underline"
          >
            {t("orders.viewDetails", "View details →")}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {canPay && onPayClick && (
              <Button
                type="button"
                data-testid="order-action-pay"
                onClick={() => onPayClick(order)}
                disabled={isActionPending}
                className="h-9 min-h-9 w-auto bg-primary px-3 text-xs text-white hover:bg-primary/90"
              >
                {t("orders.actions.payNow", "Pay now")}
              </Button>
            )}

            {canComplete && onConfirmReceipt && (
              <Button
                type="button"
                data-testid="order-action-confirm-receipt"
                onClick={() => void onConfirmReceipt(order.id)}
                disabled={isActionPending}
                className="h-9 min-h-9 w-auto bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
              >
                {isActionPending
                  ? t("orders.actions.confirmingReceipt", "Confirming receipt…")
                  : t("orders.actions.confirmReceipt", "Confirm receipt")}
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
