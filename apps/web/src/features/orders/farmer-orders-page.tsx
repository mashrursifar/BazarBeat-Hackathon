import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FarmerOrderCard,
  OrderStatus,
  type StockReturnDecision,
} from "@bazarbeat/shared";

import { EmptyState, ErrorState } from "../../components/shared/data-states.js";
import {
  cancelOrder,
  confirmOrder,
  decideStockReturn,
  fetchOrders,
  markOrderDelivered,
} from "./api/orders-api.js";
import { CancelOrderDialog } from "./components/cancel-order-dialog.js";
import { ConfirmHandoverDialog } from "./components/confirm-handover-dialog.js";
import { FarmerOrderCardComponent } from "./components/farmer-order-card.js";

type TabKey = "needs_action" | "in_progress" | "delivered" | "completed" | "disputed" | "cancelled";

const TAB_STATUS_MAP: Record<TabKey, OrderStatus | string> = {
  needs_action: OrderStatus.PENDING,
  in_progress: OrderStatus.CONFIRMED,
  delivered: OrderStatus.DELIVERED,
  completed: OrderStatus.COMPLETED,
  disputed: OrderStatus.DISPUTED,
  cancelled: OrderStatus.CANCELLED,
};

export default function FarmerOrdersPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("needs_action");
  const [page, setPage] = useState<number>(1);

  // Dialog states
  const [confirmOrderTarget, setConfirmOrderTarget] = useState<FarmerOrderCard | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<FarmerOrderCard | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedStatus = TAB_STATUS_MAP[activeTab];

  const ordersQuery = useQuery({
    queryKey: ["farmer-orders", selectedStatus, page],
    queryFn: () =>
      fetchOrders({
        status: selectedStatus === OrderStatus.CANCELLED ? undefined : selectedStatus,
        group: selectedStatus === OrderStatus.CANCELLED ? "cancelled" : undefined,
        page,
        limit: 20,
      }),
  });

  // Action mutations
  const confirmMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: { handoverAt: string; note?: string } }) =>
      confirmOrder(orderId, payload),
    onSuccess: () => {
      setConfirmOrderTarget(null);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const deliverMutation = useMutation({
    mutationFn: (orderId: string) => markOrderDelivered(orderId),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: { reason: string; note?: string } }) =>
      cancelOrder(orderId, payload),
    onSuccess: () => {
      setCancelOrderTarget(null);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const stockReturnMutation = useMutation({
    mutationFn: ({ orderId, decision }: { orderId: string; decision: StockReturnDecision }) =>
      decideStockReturn(orderId, { decision }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["farmer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const counts = ordersQuery.data?.meta?.statusCounts ?? ordersQuery.data?.meta?.counts ?? {};

  const tabCounts: Record<TabKey, number> = {
    needs_action: counts[OrderStatus.PENDING] ?? 0,
    in_progress: counts[OrderStatus.CONFIRMED] ?? 0,
    delivered: counts[OrderStatus.DELIVERED] ?? 0,
    completed: counts[OrderStatus.COMPLETED] ?? 0,
    disputed: counts[OrderStatus.DISPUTED] ?? 0,
    cancelled: counts[OrderStatus.CANCELLED] ?? 0,
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "needs_action", label: t("orders.tabs.needsAction", "Needs action"), count: tabCounts.needs_action },
    { key: "in_progress", label: t("orders.tabs.inProgress", "In progress"), count: tabCounts.in_progress },
    { key: "delivered", label: t("orders.tabs.delivered", "Delivered"), count: tabCounts.delivered },
    { key: "completed", label: t("orders.tabs.completed", "Completed"), count: tabCounts.completed },
    { key: "disputed", label: t("orders.tabs.disputed", "In dispute"), count: tabCounts.disputed },
    { key: "cancelled", label: t("orders.tabs.cancelled", "Cancelled"), count: tabCounts.cancelled },
  ];

  const isAnyActionPending =
    confirmMutation.isPending ||
    deliverMutation.isPending ||
    cancelMutation.isPending ||
    stockReturnMutation.isPending;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {t("orders.pageTitle", "Orders")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orders.pageSubtitle", "Manage incoming auction orders, confirm pickup schedules, and track deliveries.")}
          </p>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900"
        >
          {actionError}
        </div>
      )}

      {/* 5 Tabs with counts */}
      <div className="mt-6 border-b border-stone-200">
        <nav
          role="tablist"
          className="-mb-px flex space-x-2 overflow-x-auto pb-1"
          aria-label={t("orders.tabs.label", "Order status tabs")}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`tab-${tab.key}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  data-testid={`badge-count-${tab.key}`}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isActive ? "bg-primary/10 text-primary" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {isBangla ? String(tab.count) : tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Orders Content */}
      <div className="mt-6">
        {ordersQuery.isLoading && (
          <div data-testid="orders-loading" className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-44 w-full animate-pulse rounded-xl border border-stone-200 bg-stone-100"
              />
            ))}
          </div>
        )}

        {ordersQuery.isError && (
          <ErrorState onRetry={() => void ordersQuery.refetch()} />
        )}

        {!ordersQuery.isLoading && !ordersQuery.isError && ordersQuery.data?.data.length === 0 && (
          <EmptyState
            title={t("orders.emptyTitle", "No orders in this status")}
            action={
              <p className="text-xs text-muted-foreground">
                {t("orders.emptySubtitle", "When auctions close with winning bids, incoming orders will appear here.")}
              </p>
            }
          />
        )}

        {!ordersQuery.isLoading && !ordersQuery.isError && (ordersQuery.data?.data.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ordersQuery.data?.data.map((order) => (
              <FarmerOrderCardComponent
                key={order.id}
                order={order}
                isActionPending={isAnyActionPending}
                onConfirmClick={(target) => setConfirmOrderTarget(target)}
                onMarkDelivered={(orderId) => {
                  void deliverMutation.mutateAsync(orderId);
                }}
                onCancelClick={(target) => setCancelOrderTarget(target)}
                onStockReturnDecision={(orderId, decision) => {
                  void stockReturnMutation.mutateAsync({ orderId, decision });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm Handover Dialog */}
      {confirmOrderTarget && (
        <ConfirmHandoverDialog
          isOpen={true}
          orderId={confirmOrderTarget.id}
          prefilledNote={confirmOrderTarget.fulfilment?.note ?? ""}
          isPending={confirmMutation.isPending}
          error={actionError}
          onConfirm={async (payload) => {
            await confirmMutation.mutateAsync({
              orderId: confirmOrderTarget.id,
              payload,
            });
          }}
          onClose={() => setConfirmOrderTarget(null)}
        />
      )}

      {/* Cancel Order Dialog */}
      {cancelOrderTarget && (
        <CancelOrderDialog
          isOpen={true}
          orderId={cancelOrderTarget.id}
          isPending={cancelMutation.isPending}
          error={actionError}
          onCancel={async (payload) => {
            await cancelMutation.mutateAsync({
              orderId: cancelOrderTarget.id,
              payload,
            });
          }}
          onClose={() => setCancelOrderTarget(null)}
        />
      )}
    </main>
  );
}
