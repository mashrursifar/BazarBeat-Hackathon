import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  type CropGrade,
  DASHBOARD_RANGE_PRESETS,
  type DashboardRangePreset,
  formatDisplayPrice,
} from "@bazarbeat/shared";

import { ErrorState, StatCard } from "../../components/shared/data-states.js";
import { ChangeIndicator } from "../../components/shared/change-indicator.js";
import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { OrderStatusBadge } from "../../components/shared/order-status-badge.js";
import { formatLocalizedNumber, formatLocalizedPoisha, toBanglaDigits } from "../../lib/format.js";
import { fetchBuyerDashboard } from "./api/dashboard-api.js";

function isPreset(value: string): value is DashboardRangePreset {
  return (DASHBOARD_RANGE_PRESETS as readonly string[]).includes(value);
}

export function BuyerDashboardSkeleton(): ReactElement {
  return (
    <div className="space-y-8 animate-pulse" role="status" aria-label="Loading dashboard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-stone-200" />
          <div className="h-4 w-72 rounded bg-stone-200" />
        </div>
        <div className="h-11 w-44 rounded bg-stone-200" />
      </div>
      <div className="h-10 w-full max-w-md rounded bg-stone-200" />
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-stone-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg border border-stone-200 bg-stone-100 p-4" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BuyerDashboardPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeParam = searchParams.get("range") ?? "30d";
  const activeRange: DashboardRangePreset = isPreset(rangeParam) ? rangeParam : "30d";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["buyer-dashboard", { range: activeRange }],
    queryFn: () => fetchBuyerDashboard({ range: activeRange }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const handleRangeChange = (preset: DashboardRangePreset): void => {
    const next = new URLSearchParams(searchParams);
    next.set("range", preset);
    setSearchParams(next);
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BuyerDashboardSkeleton />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("buyerDashboard.pageTitle")}
        </h1>
        <div className="mt-6">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </main>
    );
  }

  const {
    kpis,
    rightNow,
    activeBidsList = [],
    nearestEndingBids = [],
    recentOrders = [],
  } = data.data;

  const bidsToDisplay =
    activeBidsList.length > 0
      ? activeBidsList
      : nearestEndingBids;

  // New buyer empty state check
  const isNewBuyerEmpty =
    kpis.totalSpend.value === 0 &&
    (rightNow?.activeBids ?? kpis.activeBids.value) === 0 &&
    (kpis.orders?.value ?? 0) === 0 &&
    bidsToDisplay.length === 0 &&
    recentOrders.length === 0;

  const rangeLabel = t(`buyerDashboard.range.${activeRange}`);
  const deadline = rightNow?.nearestDeadline ?? kpis.nearestDeadline;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("buyerDashboard.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("buyerDashboard.pageSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/buyer/marketplace"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            data-testid="explore-marketplace-header-btn"
          >
            {t("buyerDashboard.exploreMarketplace")}
          </Link>
        </div>
      </div>

      {/* Range Tabs Control synced to URL */}
      <div className="mt-6">
        <div
          role="tablist"
          aria-label="Dashboard time range selector"
          className="inline-flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1"
        >
          {DASHBOARD_RANGE_PRESETS.map((preset) => {
            const isActive = activeRange === preset;
            return (
              <button
                key={preset}
                role="tab"
                aria-selected={isActive}
                data-testid={`range-tab-${preset}`}
                onClick={() => handleRangeChange(preset)}
                className={`min-h-10 rounded-md px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-white font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-white/50 hover:text-foreground"
                }`}
              >
                {t(`buyerDashboard.range.${preset}`)}
              </button>
            );
          })}
        </div>
      </div>

      {isNewBuyerEmpty ? (
        /* Friendly First-Purchase Empty State for New Buyer */
        <div
          className="mt-8 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center sm:p-12"
          data-testid="buyer-dashboard-empty-state"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">
            {t("buyerDashboard.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("buyerDashboard.emptySubtitle")}
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/buyer/marketplace"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary/90"
              data-testid="explore-first-marketplace-btn"
            >
              {t("buyerDashboard.exploreCrops")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Action Required Callout Banner (if pending orders exist) */}
          {(rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value) > 0 && (
            <div
              className="mt-6 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              data-testid="orders-needing-action-banner"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl" aria-hidden="true">
                  ⚠️
                </span>
                <div>
                  <p className="font-semibold text-amber-900">
                    {t("buyerDashboard.ordersCardTitle")} (
                    {formatLocalizedNumber(
                      rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value,
                      isBangla,
                    )}
                    )
                  </p>
                  <p className="text-xs text-amber-800">
                    {t("buyerDashboard.ordersCardSubtitle")}
                  </p>
                </div>
              </div>
              <Link
                to="/buyer/orders?status=PENDING"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                data-testid="view-pending-orders-link"
              >
                {t("buyerDashboard.manageOrders")} →
              </Link>
            </div>
          )}

          {/* Group 1: "Last N Days" Performance */}
          <section className="mt-8" aria-labelledby="section-performance-title">
            <h2
              id="section-performance-title"
              className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
            >
              {t("buyerDashboard.lastNDaysGroup", { range: rangeLabel })}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Booked Spend */}
              <StatCard
                label={t("buyerDashboard.bookedSpend")}
                value={formatLocalizedPoisha(kpis.totalSpend.value, isBangla)}
                subtitle={t("buyerDashboard.bookedSpendSubtitle")}
                change={<ChangeIndicator changePercent={kpis.totalSpend.changePercent} />}
                data-testid="stat-booked-spend"
              />

              {/* Produce Purchased */}
              <StatCard
                label={t("buyerDashboard.kgPurchased")}
                value={`${formatLocalizedNumber(kpis.kgPurchased?.value ?? 0, isBangla)} kg`}
                subtitle={t("buyerDashboard.kgPurchasedSubtitle")}
                change={<ChangeIndicator changePercent={kpis.kgPurchased?.changePercent} />}
                data-testid="stat-kg-purchased"
              />

              {/* Win Rate */}
              <StatCard
                label={t("buyerDashboard.winRate")}
                value={`${
                  isBangla
                    ? toBanglaDigits(kpis.winRate.value.toFixed(1))
                    : kpis.winRate.value.toFixed(1)
                }%`}
                subtitle={t("buyerDashboard.winRateSubtitle")}
                data-testid="stat-win-rate"
              />

              {/* Savings vs Market */}
              <StatCard
                label={t("buyerDashboard.savingsVsMarket")}
                value={
                  kpis.avgPriceVsMarket?.value !== null &&
                  kpis.avgPriceVsMarket?.value !== undefined
                    ? `${kpis.avgPriceVsMarket.value > 0 ? "+" : ""}${
                        isBangla
                          ? toBanglaDigits(kpis.avgPriceVsMarket.value.toFixed(1))
                          : kpis.avgPriceVsMarket.value.toFixed(1)
                      }%`
                    : "—"
                }
                subtitle={t("buyerDashboard.savingsVsMarketSubtitle")}
                change={<ChangeIndicator changePercent={kpis.avgPriceVsMarket?.changePercent} />}
                className="border-emerald-200 bg-emerald-50/30"
                data-testid="stat-savings-market"
              />
            </div>
          </section>

          {/* Group 2: "Right Now" Status */}
          <section className="mt-8" aria-labelledby="section-right-now-title">
            <h2
              id="section-right-now-title"
              className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
            >
              {t("buyerDashboard.rightNowGroup")}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Active Bids */}
              <StatCard
                label={t("buyerDashboard.activeBids")}
                value={formatLocalizedNumber(
                  rightNow?.activeBids ?? kpis.activeBids.value,
                  isBangla,
                )}
                subtitle={
                  rightNow
                    ? t("buyerDashboard.winningAndOutbid", {
                        winning: formatLocalizedNumber(rightNow.winningBids, isBangla),
                        outbid: formatLocalizedNumber(rightNow.outbidBids, isBangla),
                      })
                    : undefined
                }
                action={
                  <Link
                    to="/buyer/my-bids"
                    className="text-xs font-semibold text-primary hover:underline"
                    data-testid="active-bids-link"
                  >
                    {t("buyerDashboard.viewMyBids")} →
                  </Link>
                }
                data-testid="stat-active-bids"
              />

              {/* Orders Needing Action */}
              <StatCard
                label={t("buyerDashboard.ordersNeedingAction")}
                value={formatLocalizedNumber(
                  rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value,
                  isBangla,
                )}
                action={
                  <Link
                    to="/buyer/orders?status=PENDING"
                    className="text-xs font-semibold text-primary hover:underline"
                    data-testid="pending-orders-link"
                  >
                    {t("buyerDashboard.manageOrders")} →
                  </Link>
                }
                className={
                  (rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value) > 0
                    ? "border-amber-300 bg-amber-50/40"
                    : ""
                }
                data-testid="stat-orders-needing-action"
              />

              {/* Nearest Deadline */}
              <StatCard
                label={t("buyerDashboard.nearestDeadline")}
                value={deadline ? <CountdownTimer endsAt={deadline} /> : "—"}
                subtitle={deadline ? t("buyerDashboard.deadlineSoon") : undefined}
                data-testid="stat-nearest-deadline"
              />
            </div>
          </section>

          {/* Bids Ending Soon List */}
          <section className="mt-8" aria-labelledby="section-bids-ending-soon-title">
            <div className="flex items-center justify-between">
              <h2
                id="section-bids-ending-soon-title"
                className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
              >
                {t("buyerDashboard.bidsEndingSoonTitle")}
              </h2>
              <Link
                to="/buyer/my-bids"
                className="text-sm font-semibold text-primary hover:underline"
                data-testid="view-all-my-bids-link"
              >
                {t("buyerDashboard.viewMyBids")} →
              </Link>
            </div>

            {bidsToDisplay.length === 0 ? (
              <div
                className="mt-4 rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-muted-foreground"
                data-testid="no-active-bids-msg"
              >
                {t("buyerDashboard.noActiveBids")}
              </div>
            ) : (
              <div
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="active-bids-list"
              >
                {bidsToDisplay.map((bid) => {
                  const cropDisplayName = isBangla ? bid.cropNameBn || bid.cropName : bid.cropName;
                  const isWinning = bid.status === "WINNING";

                  return (
                    <div
                      key={bid.listingId}
                      className="flex flex-col justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                      data-testid={`active-bid-card-${bid.listingId}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{cropDisplayName}</h3>
                            <div className="mt-1 flex items-center gap-2">
                              <GradeBadge grade={bid.grade as CropGrade} />
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isWinning
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                                data-testid={isWinning ? "bid-status-winning" : "bid-status-outbid"}
                              >
                                {isWinning
                                  ? t("buyerDashboard.statusWinning")
                                  : t("buyerDashboard.statusOutbid")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("buyerDashboard.myBid")}
                            </p>
                            <p className="font-bold text-foreground">
                              {formatDisplayPrice(bid.myBidPerKg)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("buyerDashboard.highestBid")}
                            </p>
                            <p className="font-bold text-foreground">
                              {formatDisplayPrice(bid.currentBidPerKg)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">
                          <span>{t("buyerDashboard.bidsCount", { count: bid.bidCount })}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                        <CountdownTimer endsAt={bid.endsAt} />
                        <Link
                          to={`/buyer/listings/${bid.listingId}`}
                          className="min-h-9 rounded border border-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                          data-testid={`view-listing-link-${bid.listingId}`}
                        >
                          {t("buyerDashboard.exploreMarketplace")}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Orders Section */}
          <section className="mt-8" aria-labelledby="section-recent-orders-title">
            <div className="flex items-center justify-between">
              <h2
                id="section-recent-orders-title"
                className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
              >
                {t("buyerDashboard.recentOrdersTitle")}
              </h2>
              <Link
                to="/buyer/orders"
                className="text-sm font-semibold text-primary hover:underline"
                data-testid="view-all-orders-link"
              >
                {t("buyerDashboard.viewAllOrders")} →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div
                className="mt-4 rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-muted-foreground"
                data-testid="no-recent-orders-msg"
              >
                {t("buyerDashboard.noRecentOrders")}
              </div>
            ) : (
              <div
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="recent-orders-list"
              >
                {recentOrders.map((order) => {
                  const cropDisplayName = isBangla
                    ? order.cropNameBn || order.cropName
                    : order.cropName;

                  return (
                    <div
                      key={order.id}
                      className="flex flex-col justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                      data-testid={`recent-order-card-${order.id}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{cropDisplayName}</h3>
                            <p className="text-xs text-muted-foreground">
                              {formatLocalizedNumber(order.quantityKg, isBangla)} kg
                            </p>
                          </div>
                          <OrderStatusBadge status={order.status} />
                        </div>

                        <div className="mt-3 flex items-baseline justify-between border-t border-stone-100 pt-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("orders.totalAmount", "Total")}
                            </p>
                            <p className="font-bold text-foreground">
                              {formatLocalizedPoisha(order.subtotal, isBangla)}
                            </p>
                          </div>
                          <div className="text-right">
                            <GradeBadge grade={order.grade as CropGrade} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end border-t border-stone-100 pt-3">
                        <Link
                          to={`/buyer/orders/${order.id}`}
                          className="min-h-9 rounded border border-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                          data-testid={`view-order-detail-link-${order.id}`}
                        >
                          {t("buyerDashboard.manageOrders")}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
