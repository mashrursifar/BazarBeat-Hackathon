import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type BuyerOrderDetail,
  OrderAction,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
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
  completeOrder,
  disputeOrder,
  fetchOrderDetail,
  markOrderPaid,
} from "./api/orders-api.js";
import { CancelOrderDialog } from "./components/cancel-order-dialog.js";
import { PayOrderDialog } from "./components/pay-order-dialog.js";
import { ReportProblemDialog } from "./components/report-problem-dialog.js";

export default function BuyerOrderDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const queryClient = useQueryClient();

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["buyer-order-detail", id],
    queryFn: () => fetchOrderDetail<BuyerOrderDetail>(id!),
    enabled: Boolean(id),
  });

  const payMutation = useMutation({
    mutationFn: (method: PaymentMethod) => markOrderPaid(id!, { method }),
    onSuccess: () => {
      setIsPayOpen(false);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeOrder(id!),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const disputeMutation = useMutation({
    mutationFn: (payload: { reason: string; note?: string }) =>
      disputeOrder(id!, payload),
    onSuccess: () => {
      setIsDisputeOpen(false);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (payload: { reason: string; note?: string }) =>
      cancelOrder<BuyerOrderDetail>(id!, payload),
    onSuccess: () => {
      setIsCancelOpen(false);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-order-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  if (orderQuery.isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="mt-6 h-96 animate-pulse rounded-xl bg-stone-100" />
      </main>
    );
  }

  if (orderQuery.isError || !orderQuery.data?.data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <ErrorState onRetry={() => void orderQuery.refetch()} />
        <div className="mt-4 text-center">
          <Link to="/buyer/orders" className="text-sm font-semibold text-primary hover:underline">
            ← {t("orders.backToOrders", "Back to Orders")}
          </Link>
        </div>
      </main>
    );
  }

  const order = orderQuery.data.data;
  const cropName = isBangla ? order.cropNameBn : order.cropName;
  const isPaid = order.payment.status === PaymentStatus.PAID;
  const isPending = order.status === OrderStatus.PENDING;
  const isConfirmed = order.status === OrderStatus.CONFIRMED;
  const isDelivered = order.status === OrderStatus.DELIVERED;

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
  const canDispute = actions.includes(OrderAction.DISPUTE);

  const cancelDeadline = order.autoCancelDeadline ?? order.deadline;
  const completeDeadline = order.autoCompleteDeadline ?? order.deadline;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Top Bar with Back Link */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/buyer/orders"
          data-testid="back-to-orders-link"
          className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1"
        >
          ← {t("orders.backToOrders", "Back to Orders")}
        </Link>
        <span className="text-xs text-muted-foreground font-mono">
          #{order.id.slice(-8).toUpperCase()}
        </span>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
        >
          {actionError}
        </div>
      )}

      {/* Header Card */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {order.imageUrl && (
              <img
                src={order.imageUrl}
                alt={cropName}
                className="h-16 w-16 rounded-xl object-cover ring-1 ring-stone-200"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">{cropName}</h1>
                <GradeBadge grade={order.grade} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("orders.orderId", "Order")}: #{order.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* Auto-cancel countdown for PENDING */}
        {isPending && cancelDeadline && (
          <div
            data-testid="auto-cancel-countdown"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-900"
          >
            <span className="font-medium">
              {t(
                "orders.autoCancelTimerDetail",
                "Confirmation deadline (order auto-cancels if unconfirmed by farmer):",
              )}
            </span>
            <CountdownTimer endsAt={cancelDeadline} size="sm" />
          </div>
        )}

        {/* Auto-complete countdown for DELIVERED */}
        {isDelivered && completeDeadline && (
          <div
            data-testid="auto-complete-countdown"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900"
          >
            <span className="font-medium">
              {t(
                "orders.autoCompleteTimerDetail",
                "Auto-completes and releases payment in:",
              )}
            </span>
            <CountdownTimer endsAt={completeDeadline} size="sm" />
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
                "orders.dispute.inDisputeBuyerNotice",
                "You have reported a problem with this delivery. The order is paused and will not auto-complete pending resolution.",
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
      </div>

      {/* Main Grid: Left details + Right financial/actions */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols on large screen) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pickup and Handover Details */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900">
              {t("orders.handoverScheduleTitle", "Scheduled Handover & Pickup")}
            </h2>

            {isConfirmed || isDelivered || order.status === OrderStatus.COMPLETED ? (
              <div className="mt-3 space-y-2 text-xs text-stone-700" data-testid="pickup-info-revealed">
                {order.fulfilment?.handoverAt && (
                  <div>
                    <span className="font-medium text-stone-500">
                      {t("orders.handoverAt", "Ready for pickup at")}:
                    </span>{" "}
                    <span className="font-semibold text-stone-900">
                      {new Date(order.fulfilment.handoverAt).toLocaleString(
                        isBangla ? "bn-BD" : "en-US",
                        { dateStyle: "full", timeStyle: "short" },
                      )}
                    </span>
                  </div>
                )}
                {order.fulfilment?.method && (
                  <div>
                    <span className="font-medium text-stone-500">
                      {t("orders.fulfilmentMethod", "Method")}:
                    </span>{" "}
                    <span className="font-semibold">{order.fulfilment.method}</span>
                  </div>
                )}
                {order.fulfilment?.note && (
                  <div className="rounded-lg bg-stone-50 p-3 border border-stone-200">
                    <p className="font-medium text-stone-500">
                      {t("orders.pickupInstructions", "Farmer's Instructions")}:
                    </p>
                    <p className="mt-1 font-normal text-stone-800">{order.fulfilment.note}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-stone-500" data-testid="pickup-info-pending">
                {t(
                  "orders.pendingPickupNotice",
                  "The farmer will schedule the handover time and pickup instructions upon confirming the order.",
                )}
              </p>
            )}
          </div>

          {/* Farmer Counterparty Information */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900 mb-3">
              {t("orders.counterparty.farmerInfo", "Farmer Information")}
            </h2>
            <CounterpartyCard counterparty={order.farmer} />
          </div>

          {/* Order Activity Timeline */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900 mb-3">
              {t("orders.activityTimeline", "Order Timeline")}
            </h2>
            <OrderTimeline entries={order.timeline} />
          </div>
        </div>

        {/* Right Column: Financial & Actions */}
        <div className="space-y-6">
          {/* Financial Breakdown */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900 mb-3">
              {t("orders.financialSummary", "Payment Breakdown")}
            </h2>
            <MoneyBreakdown
              role="buyer"
              pricePerKg={order.pricePerKg}
              quantityKg={order.quantityKg}
              subtotal={order.subtotal}
              platformFee={0}
              farmerNet={0}
            />
          </div>

          {/* Payment Status & Simulated Wallet Card */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900">
              {t("orders.payment.title", "Payment Details")}
            </h2>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{t("orders.payment.statusLabel", "Status")}:</span>
                {isPaid ? (
                  <span
                    data-testid="payment-badge-paid"
                    className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800"
                  >
                    ✓ {order.payment.method === "WALLET_SIM"
                      ? t("orders.payment.paidWallet", "Paid (Demo Wallet)")
                      : t("orders.payment.paidCod", "Paid (COD)")}
                  </span>
                ) : (
                  <span
                    data-testid="payment-badge-unpaid"
                    className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800"
                  >
                    ⏳ {t("orders.payment.unpaid", "Pay on delivery / Unpaid")}
                  </span>
                )}
              </div>

              {/* Demo payment notice - REQUIRED LABEL */}
              <div
                data-testid="demo-payment-note"
                className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900"
              >
                <p className="font-bold">
                  {t("orders.payment.demoLabel", "Demo payment. No real money.")}
                </p>
                <p className="mt-0.5 text-[11px] text-blue-800">
                  {t(
                    "orders.payment.demoHelp",
                    "You can simulate instant payment using test balance or pay on delivery.",
                  )}
                </p>
              </div>

              {canPay && (
                <div className="pt-3">
                  <Button
                    type="button"
                    data-testid="detail-action-pay"
                    onClick={() => setIsPayOpen(true)}
                    disabled={payMutation.isPending}
                    className="w-full bg-primary text-white hover:bg-primary/90 text-xs"
                  >
                    {t("orders.actions.payNow", "Pay now")}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Available Actions Card */}
          {(canComplete || canCancel || canDispute) && (
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-stone-900">
                {t("orders.availableActions", "Actions")}
              </h2>

              {canComplete && (
                <Button
                  type="button"
                  data-testid="detail-action-confirm-receipt"
                  onClick={() => void completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                >
                  {completeMutation.isPending
                    ? t("orders.actions.confirmingReceipt", "Confirming receipt…")
                    : t("orders.actions.confirmReceipt", "Confirm receipt")}
                </Button>
              )}

              {canDispute && (
                <Button
                  type="button"
                  data-testid="detail-action-report-problem"
                  onClick={() => setIsDisputeOpen(true)}
                  disabled={disputeMutation.isPending}
                  className="w-full border border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100 text-xs font-semibold"
                >
                  {t("orders.actions.reportProblem", "Report a problem")}
                </Button>
              )}

              {canCancel && (
                <Button
                  type="button"
                  data-testid="detail-action-cancel"
                  onClick={() => setIsCancelOpen(true)}
                  disabled={cancelMutation.isPending}
                  className="w-full border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 text-xs"
                >
                  {t("orders.actions.cancel", "Cancel order")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pay Order Dialog */}
      <PayOrderDialog
        isOpen={isPayOpen}
        order={order}
        isPending={payMutation.isPending}
        error={payMutation.isError ? payMutation.error.message : null}
        onPay={async (method) => {
          await payMutation.mutateAsync(method);
        }}
        onClose={() => setIsPayOpen(false)}
      />

      {/* Report Problem Dialog */}
      <ReportProblemDialog
        isOpen={isDisputeOpen}
        orderId={order.id}
        isPending={disputeMutation.isPending}
        error={disputeMutation.error?.message}
        onSubmit={async (payload) => {
          await disputeMutation.mutateAsync(payload);
        }}
        onClose={() => setIsDisputeOpen(false)}
      />

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        isOpen={isCancelOpen}
        orderId={order.id}
        role={UserRole.BUYER}
        isPending={cancelMutation.isPending}
        error={cancelMutation.error?.message}
        onCancel={async (payload) => {
          await cancelMutation.mutateAsync(payload);
        }}
        onClose={() => setIsCancelOpen(false)}
      />
    </main>
  );
}
