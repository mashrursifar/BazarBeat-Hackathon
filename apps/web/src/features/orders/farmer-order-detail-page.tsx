import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  OrderAction,
  OrderStatus,
  type StockReturnDecision,
  UserRole,
  getOrderActions,
} from "@bazarbeat/shared";

import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { CounterpartyCard } from "../../components/shared/counterparty-card.js";
import { ErrorState } from "../../components/shared/data-states.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { MoneyBreakdown } from "../../components/shared/money-breakdown.js";
import { OrderStatusBadge } from "../../components/shared/order-status-badge.js";
import { OrderTimeline } from "../../components/shared/order-timeline.js";
import { Button } from "../../components/ui/button.js";
import {
  cancelOrder,
  confirmOrder,
  decideStockReturn,
  fetchOrderDetail,
  markOrderDelivered,
} from "./api/orders-api.js";
import { CancelOrderDialog } from "./components/cancel-order-dialog.js";
import { ConfirmHandoverDialog } from "./components/confirm-handover-dialog.js";
import { StockReturnPrompt } from "./components/stock-return-prompt.js";

export default function FarmerOrderDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const queryClient = useQueryClient();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["farmer-order-detail", id],
    queryFn: () => fetchOrderDetail(id!),
    enabled: Boolean(id),
  });

  const confirmMutation = useMutation({
    mutationFn: (payload: { handoverAt: string; note?: string }) => confirmOrder(id!, payload),
    onSuccess: () => {
      setIsConfirmOpen(false);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const deliverMutation = useMutation({
    mutationFn: () => markOrderDelivered(id!),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (payload: { reason: string; note?: string }) => cancelOrder(id!, payload),
    onSuccess: () => {
      setIsCancelOpen(false);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const stockReturnMutation = useMutation({
    mutationFn: (decision: StockReturnDecision) => decideStockReturn(id!, { decision }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  if (orderQuery.isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div data-testid="order-detail-loading" className="h-96 animate-pulse rounded-xl bg-stone-100" />
      </main>
    );
  }

  if (orderQuery.isError || !orderQuery.data?.data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <ErrorState onRetry={() => void orderQuery.refetch()} />
      </main>
    );
  }

  const order = orderQuery.data.data;
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

  const isPendingAction =
    confirmMutation.isPending ||
    deliverMutation.isPending ||
    cancelMutation.isPending ||
    stockReturnMutation.isPending;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Back button */}
      <Link
        to="/farmer/orders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <span>←</span>
        <span>{t("orders.backToOrders", "Back to Orders")}</span>
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900">{cropName}</h1>
            <GradeBadge grade={order.grade} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("orders.orderId", "Order ID")}: #{order.id}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm px-3 py-1" />
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900"
        >
          {actionError}
        </div>
      )}

      {/* Visible disputed state banner for DISPUTED */}
      {order.status === OrderStatus.DISPUTED && (
        <div
          data-testid="order-disputed-banner"
          className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-4 text-xs sm:text-sm text-orange-950"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-orange-900">
              {t("orders.dispute.inDisputeTitle", "Order In Dispute")}
            </span>
          </div>
          <p className="mt-1 text-xs text-orange-800">
            {t(
              "orders.dispute.inDisputeFarmerNotice",
              "The buyer has reported an issue with this order. Payout is on hold pending resolution.",
            )}
          </p>
          {order.dispute && (
            <div className="mt-2 rounded bg-white/80 p-2.5 text-xs text-stone-800 space-y-1">
              <div>
                <span className="font-medium text-stone-600">
                  {t("orders.dispute.reasonLabel", "Reason")}:{" "}
                </span>
                <span className="font-semibold">
                  {t(`orders.dispute.reasons.${order.dispute.reason}`, order.dispute.reason)}
                </span>
              </div>
              {order.dispute.note && (
                <div>
                  <span className="font-medium text-stone-600">
                    {t("orders.dispute.noteLabel", "Note")}:{" "}
                  </span>
                  <span>{order.dispute.note}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Auto-cancel countdown for PENDING */}
      {order.status === OrderStatus.PENDING && cancelDeadline && (
        <div
          data-testid="auto-cancel-countdown"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <span className="font-semibold">
            {t("orders.autoCancelTimerDetail", "Confirmation deadline (order auto-cancels if unconfirmed):")}
          </span>
          <CountdownTimer endsAt={cancelDeadline} />
        </div>
      )}

      {/* Handover information if confirmed */}
      {order.fulfilment?.handoverAt && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-950">
          <h4 className="font-bold">{t("orders.handoverScheduleTitle", "Scheduled Handover")}</h4>
          <p className="mt-1 text-xs">
            {t("orders.handoverAt", "Ready for pickup at")}:{" "}
            <time className="font-semibold">
              {new Date(order.fulfilment.handoverAt).toLocaleString(isBangla ? "bn-BD" : "en-US", {
                timeZone: "Asia/Dhaka",
              })}
            </time>
          </p>
          {order.fulfilment.note && (
            <p className="mt-1 text-xs text-stone-700">
              <span className="font-semibold">{t("orders.pickupInstructions", "Instructions")}:</span>{" "}
              {order.fulfilment.note}
            </p>
          )}
        </div>
      )}

      {/* 2-Column Details Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left Column: Financials & Counterparty */}
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-bold text-stone-900">
              {t("orders.financialSummary", "Financial Breakdown")}
            </h3>
            <MoneyBreakdown
              pricePerKg={order.pricePerKg}
              quantityKg={order.quantityKg}
              subtotal={order.subtotal}
              platformFee={order.platformFee}
              farmerNet={order.farmerNet}
              role="farmer"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-stone-900">
              {t("orders.counterpartyTitle", "Buyer Details")}
            </h3>
            <CounterpartyCard counterparty={order.buyer} />
          </div>

          {/* Stock return decision for cancelled orders */}
          {isCancelled && (
            <div>
              <StockReturnPrompt
                orderId={order.id}
                stockReturn={order.stockReturn}
                isPending={isPendingAction}
                onDecision={(decision) => {
                  void stockReturnMutation.mutateAsync(decision);
                }}
              />
            </div>
          )}
        </div>

        {/* Right Column: Timeline & Action Controls */}
        <div className="space-y-6">
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-stone-900">
              {t("orders.activityTimeline", "Order Timeline")}
            </h3>
            <OrderTimeline entries={order.timeline ?? order.statusHistory} />
          </div>

          {/* Action buttons */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("orders.availableActions", "Actions")}
            </h4>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {canConfirm && (
                <Button
                  type="button"
                  data-testid="order-action-confirm"
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={isPendingAction}
                  className="bg-primary text-white"
                >
                  {isPendingAction
                    ? t("orders.actions.confirming", "Please wait…")
                    : t("orders.actions.confirm", "Confirm order")}
                </Button>
              )}

              {canMarkDelivered && (
                <Button
                  type="button"
                  data-testid="order-action-deliver"
                  onClick={() => void deliverMutation.mutateAsync()}
                  disabled={isPendingAction}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {isPendingAction
                    ? t("orders.actions.delivering", "Please wait…")
                    : t("orders.actions.markDelivered", "Mark delivered")}
                </Button>
              )}

              {canCancel && (
                <Button
                  type="button"
                  data-testid="order-action-cancel"
                  onClick={() => setIsCancelOpen(true)}
                  disabled={isPendingAction}
                  className="border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                >
                  {t("orders.actions.cancel", "Cancel order")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Handover Dialog */}
      {isConfirmOpen && (
        <ConfirmHandoverDialog
          isOpen={true}
          orderId={order.id}
          prefilledNote={order.fulfilment?.note ?? ""}
          isPending={confirmMutation.isPending}
          error={actionError}
          onConfirm={async (payload) => {
            await confirmMutation.mutateAsync(payload);
          }}
          onClose={() => setIsConfirmOpen(false)}
        />
      )}

      {/* Cancel Order Dialog */}
      {isCancelOpen && (
        <CancelOrderDialog
          isOpen={true}
          orderId={order.id}
          isPending={cancelMutation.isPending}
          error={actionError}
          onCancel={async (payload) => {
            await cancelMutation.mutateAsync(payload);
          }}
          onClose={() => setIsCancelOpen(false)}
        />
      )}
    </main>
  );
}
