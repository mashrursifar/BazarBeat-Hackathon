import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type BuyerOrderCard,
  OrderStatus,
  type PaymentMethod,
  UserRole,
} from "@bazarbeat/shared";

import { EmptyState, ErrorState } from "../../components/shared/data-states.js";
import { Button } from "../../components/ui/button.js";
import {
  cancelOrder,
  completeOrder,
  fetchOrders,
  markOrderPaid,
} from "./api/orders-api.js";
import { BuyerOrderCardComponent } from "./components/buyer-order-card.js";
import { CancelOrderDialog } from "./components/cancel-order-dialog.js";
import { PayOrderDialog } from "./components/pay-order-dialog.js";

type TabKey = "needs_action" | "in_progress" | "delivered" | "completed" | "cancelled";

const TAB_STATUS_MAP: Record<TabKey, OrderStatus | string> = {
  needs_action: OrderStatus.PENDING,
  in_progress: OrderStatus.CONFIRMED,
  delivered: OrderStatus.DELIVERED,
  completed: OrderStatus.COMPLETED,
  cancelled: OrderStatus.CANCELLED,
};

export default function BuyerOrdersPage(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("needs_action");
  const [page, setPage] = useState<number>(1);

  // Dialog targets
  const [payOrderTarget, setPayOrderTarget] = useState<BuyerOrderCard | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<BuyerOrderCard | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedStatus = TAB_STATUS_MAP[activeTab];

  const ordersQuery = useQuery({
    queryKey: ["buyer-orders", selectedStatus, page],
    queryFn: () =>
      fetchOrders<BuyerOrderCard>({
        status: selectedStatus === OrderStatus.CANCELLED ? undefined : selectedStatus,
        group: selectedStatus === OrderStatus.CANCELLED ? "cancelled" : undefined,
        page,
        limit: 20,
      }),
  });

  // Action mutations
  const payMutation = useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: PaymentMethod }) =>
      markOrderPaid(orderId, { method }),
    onSuccess: () => {
      setPayOrderTarget(null);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const completeMutation = useMutation({
    mutationFn: (orderId: string) => completeOrder(orderId),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: { reason: string; note?: string } }) =>
      cancelOrder<BuyerOrderCard>(orderId, payload),
    onSuccess: () => {
      setCancelOrderTarget(null);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (err: Error) => {
      setActionError(t(`errors.${err.message}`, err.message));
    },
  });

  const orders = ordersQuery.data?.data ?? [];
  const meta = ordersQuery.data?.meta;
  const statusCounts = meta?.statusCounts ?? meta?.counts ?? {};

  const handlePay = (order: BuyerOrderCard): void => {
    setActionError(null);
    setPayOrderTarget(order);
  };

  const handleCancel = (order: BuyerOrderCard): void => {
    setActionError(null);
    setCancelOrderTarget(order);
  };

  const handleConfirmReceipt = async (orderId: string): Promise<void> => {
    setActionError(null);
    await completeMutation.mutateAsync(orderId);
  };

  const handleTabChange = (tab: TabKey): void => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {t("orders.buyerPageTitle", "My Purchases & Orders")}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {t(
              "orders.buyerPageSubtitle",
              "Track your won auction orders, manage demo payments, and confirm receipt after delivery.",
            )}
          </p>
        </div>
        <Link
          to="/buyer/marketplace"
          className="inline-flex items-center justify-center rounded-lg border border-primary bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition"
        >
          {t("orders.browseMarketplace", "Browse Marketplace →")}
        </Link>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
        >
          {actionError}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 border-b border-stone-200">
        <nav
          className="-mb-px flex space-x-2 overflow-x-auto pb-1"
          aria-label={t("orders.tabs.label", "Order status tabs")}
        >
          {(
            [
              ["needs_action", "needsAction", statusCounts[OrderStatus.PENDING] ?? 0],
              ["in_progress", "inProgress", statusCounts[OrderStatus.CONFIRMED] ?? 0],
              ["delivered", "delivered", statusCounts[OrderStatus.DELIVERED] ?? 0],
              ["completed", "completed", statusCounts[OrderStatus.COMPLETED] ?? 0],
              ["cancelled", "cancelled", statusCounts[OrderStatus.CANCELLED] ?? 0],
            ] as const
          ).map(([key, labelKey, count]) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                data-testid={`tab-${key}`}
                onClick={() => handleTabChange(key)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs sm:text-sm font-semibold transition ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900"
                }`}
              >
                {t(`orders.tabs.${labelKey}`, labelKey)}
                {count > 0 && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {ordersQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="orders-loading">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl border border-stone-200 bg-stone-50"
              />
            ))}
          </div>
        ) : ordersQuery.isError ? (
          <ErrorState onRetry={() => void ordersQuery.refetch()} />
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center sm:p-12">
            <EmptyState
              title={t("orders.emptyTitle", "No orders in this status")}
              action={
                <Link to="/buyer/marketplace">
                  <Button className="bg-primary text-white hover:bg-primary/90 text-xs">
                    {t("orders.exploreAuctions", "Explore Marketplace")}
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {orders.map((order) => (
                <BuyerOrderCardComponent
                  key={order.id}
                  order={order}
                  onPayClick={handlePay}
                  onConfirmReceipt={handleConfirmReceipt}
                  onCancelClick={handleCancel}
                  isActionPending={
                    payMutation.isPending ||
                    completeMutation.isPending ||
                    cancelMutation.isPending
                  }
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-stone-200 pt-4 text-xs">
                <span className="text-muted-foreground">
                  {t("common.page", "Page")} {meta.page} {t("common.of", "of")} {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-8 border border-stone-300 bg-white px-3 text-xs text-stone-700 hover:bg-stone-50"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("common.previous", "Previous")}
                  </Button>
                  <Button
                    type="button"
                    className="h-8 border border-stone-300 bg-white px-3 text-xs text-stone-700 hover:bg-stone-50"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("common.next", "Next")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pay Order Dialog */}
      {payOrderTarget && (
        <PayOrderDialog
          isOpen={Boolean(payOrderTarget)}
          order={payOrderTarget}
          isPending={payMutation.isPending}
          error={payMutation.isError ? payMutation.error.message : null}
          onPay={async (method) => {
            await payMutation.mutateAsync({ orderId: payOrderTarget.id, method });
          }}
          onClose={() => setPayOrderTarget(null)}
        />
      )}

      {/* Cancel Order Dialog */}
      {cancelOrderTarget && (
        <CancelOrderDialog
          isOpen={Boolean(cancelOrderTarget)}
          orderId={cancelOrderTarget.id}
          role={UserRole.BUYER}
          isPending={cancelMutation.isPending}
          error={cancelMutation.isError ? cancelMutation.error.message : null}
          onCancel={async (payload) => {
            await cancelMutation.mutateAsync({ orderId: cancelOrderTarget.id, payload });
          }}
          onClose={() => setCancelOrderTarget(null)}
        />
      )}
    </main>
  );
}
