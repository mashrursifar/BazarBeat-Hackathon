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
import { formatLocalizedNumber, formatLocalizedPoisha, toBanglaDigits } from "../../lib/format.js";
import { fetchFarmerDashboard } from "./api/dashboard-api.js";

function isPreset(value: string): value is DashboardRangePreset {
  return (DASHBOARD_RANGE_PRESETS as readonly string[]).includes(value);
}

export function FarmerDashboardSkeleton(): ReactElement {
  return (
    <div className="space-y-8 animate-pulse" role="status" aria-label="Loading dashboard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-stone-200" />
          <div className="h-4 w-72 rounded bg-stone-200" />
        </div>
        <div className="h-11 w-36 rounded bg-stone-200" />
      </div>
      <div className="h-10 w-full max-w-md rounded bg-stone-200" />
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-stone-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg border border-stone-200 bg-stone-100 p-4" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FarmerDashboardPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeParam = searchParams.get("range") ?? "30d";
  const activeRange: DashboardRangePreset = isPreset(rangeParam) ? rangeParam : "30d";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["farmer-dashboard", { range: activeRange }],
    queryFn: () => fetchFarmerDashboard({ range: activeRange }),
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
        <FarmerDashboardSkeleton />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("farmerDashboard.pageTitle")}
        </h1>
        <div className="mt-6">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </main>
    );
  }

  const { kpis, rightNow, endingSoon = [] } = data.data;

  // New farmer empty state check
  const isNewFarmerEmpty =
    kpis.totalSales.value === 0 &&
    kpis.activeAuctions.value === 0 &&
    (kpis.orders?.value ?? 0) === 0 &&
    endingSoon.length === 0;

  const rangeLabel = t(`farmerDashboard.range.${activeRange}`);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("farmerDashboard.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("farmerDashboard.pageSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/farmer/new-listing"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            data-testid="new-listing-header-btn"
          >
            + {t("farmerDashboard.newListing")}
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
                {t(`farmerDashboard.range.${preset}`)}
              </button>
            );
          })}
        </div>
      </div>

      {isNewFarmerEmpty ? (
        /* Friendly First-Listing Empty State for New Farmer */
        <div
          className="mt-8 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center sm:p-12"
          data-testid="farmer-dashboard-empty-state"
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">
            {t("farmerDashboard.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("farmerDashboard.emptySubtitle")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs font-medium text-emerald-800">
            {t("farmerDashboard.emptyReassurance")}
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/farmer/new-listing"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary/90"
              data-testid="create-first-listing-btn"
            >
              {t("farmerDashboard.createFirstListing")}
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
                    {t("farmerDashboard.ordersCardTitle")} (
                    {formatLocalizedNumber(
                      rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value,
                      isBangla,
                    )}
                    )
                  </p>
                  <p className="text-xs text-amber-800">
                    {t("farmerDashboard.ordersCardSubtitle")}
                  </p>
                </div>
              </div>
              <Link
                to="/farmer/orders?status=PENDING"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                data-testid="view-pending-orders-link"
              >
                {t("farmerDashboard.manageOrders")} →
              </Link>
            </div>
          )}

          {/* Group 1: "Last N Days" Performance */}
          <section className="mt-8" aria-labelledby="section-performance-title">
            <h2
              id="section-performance-title"
              className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
            >
              {t("farmerDashboard.lastNDaysGroup", { range: rangeLabel })}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Total Sales */}
              <StatCard
                label={t("farmerDashboard.totalSales")}
                value={formatLocalizedPoisha(kpis.totalSales.value, isBangla)}
                subtitle={t("farmerDashboard.totalSalesSubtitle")}
                change={<ChangeIndicator changePercent={kpis.totalSales.changePercent} />}
                data-testid="stat-total-sales"
              />

              {/* Net Earnings */}
              <StatCard
                label={t("farmerDashboard.earnings")}
                value={formatLocalizedPoisha(kpis.earnings.value, isBangla)}
                subtitle={t("farmerDashboard.earningsSubtitle")}
                change={<ChangeIndicator changePercent={kpis.earnings.changePercent} />}
                data-testid="stat-net-earnings"
              />

              {/* Orders Completed */}
              <StatCard
                label={t("farmerDashboard.orders")}
                value={formatLocalizedNumber(kpis.orders?.value ?? 0, isBangla)}
                subtitle={t("farmerDashboard.ordersSubtitle")}
                change={<ChangeIndicator changePercent={kpis.orders?.changePercent} />}
                data-testid="stat-orders"
              />

              {/* Win Rate */}
              <StatCard
                label={t("farmerDashboard.winRate")}
                value={`${
                  isBangla
                    ? toBanglaDigits(kpis.winRate.value.toFixed(1))
                    : kpis.winRate.value.toFixed(1)
                }%`}
                subtitle={t("farmerDashboard.winRateSubtitle")}
                data-testid="stat-win-rate"
              />

              {/* Premium Card: Average price vs AI market estimate */}
              <StatCard
                label={t("farmerDashboard.pricePremium")}
                value={
                  kpis.pricePremium?.value !== null && kpis.pricePremium?.value !== undefined
                    ? `${kpis.pricePremium.value > 0 ? "+" : ""}${
                        isBangla
                          ? toBanglaDigits(kpis.pricePremium.value.toFixed(1))
                          : kpis.pricePremium.value.toFixed(1)
                      }%`
                    : "—"
                }
                subtitle={t("farmerDashboard.pricePremiumSubtitle")}
                change={<ChangeIndicator changePercent={kpis.pricePremium?.changePercent} />}
                className="border-emerald-200 bg-emerald-50/30"
                data-testid="stat-price-premium"
              />

              {/* Top Crop */}
              <StatCard
                label={t("farmerDashboard.topCrop")}
                value={
                  kpis.topCrop
                    ? isBangla
                      ? kpis.topCrop.cropNameBn || kpis.topCrop.cropName
                      : kpis.topCrop.cropName
                    : t("farmerDashboard.noTopCrop")
                }
                subtitle={
                  kpis.topCrop
                    ? `${formatLocalizedPoisha(
                        kpis.topCrop.totalSales,
                        isBangla,
                      )} • ${formatLocalizedNumber(
                        kpis.topCrop.quantityKg,
                        isBangla,
                      )} kg (${formatLocalizedNumber(
                        kpis.topCrop.orderCount,
                        isBangla,
                      )} ${t("farmerDashboard.orders")})`
                    : undefined
                }
                data-testid="stat-top-crop"
              />
            </div>
          </section>

          {/* Group 2: "Right Now" Status */}
          <section className="mt-8" aria-labelledby="section-right-now-title">
            <h2
              id="section-right-now-title"
              className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
            >
              {t("farmerDashboard.rightNowGroup")}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Active Auctions */}
              <StatCard
                label={t("farmerDashboard.activeAuctions")}
                value={formatLocalizedNumber(
                  rightNow?.activeAuctions ?? kpis.activeAuctions.value,
                  isBangla,
                )}
                action={
                  <Link
                    to="/farmer/crop-bidding"
                    className="text-xs font-semibold text-primary hover:underline"
                    data-testid="active-auctions-link"
                  >
                    {t("farmerDashboard.viewAllBidding")} →
                  </Link>
                }
                data-testid="stat-active-auctions"
              />

              {/* Orders Needing Action */}
              <StatCard
                label={t("farmerDashboard.ordersNeedingAction")}
                value={formatLocalizedNumber(
                  rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value,
                  isBangla,
                )}
                action={
                  <Link
                    to="/farmer/orders?status=PENDING"
                    className="text-xs font-semibold text-primary hover:underline"
                    data-testid="pending-orders-link"
                  >
                    {t("farmerDashboard.manageOrders")} →
                  </Link>
                }
                className={
                  (rightNow?.ordersNeedingAction ?? kpis.pendingOrders.value) > 0
                    ? "border-amber-300 bg-amber-50/40"
                    : ""
                }
                data-testid="stat-orders-needing-action"
              />

              {/* Total Produce Listed */}
              <StatCard
                label={t("farmerDashboard.produceListed")}
                value={`${formatLocalizedNumber(
                  rightNow?.kgListed ?? kpis.kgListed ?? 0,
                  isBangla,
                )} kg`}
                data-testid="stat-produce-listed"
              />

              {/* Nearest Deadline */}
              <StatCard
                label={t("farmerDashboard.nearestDeadline")}
                value={
                  rightNow?.nearestDeadline || kpis.nearestDeadline ? (
                    <CountdownTimer endsAt={rightNow?.nearestDeadline ?? kpis.nearestDeadline!} />
                  ) : (
                    "—"
                  )
                }
                subtitle={
                  rightNow?.nearestDeadline || kpis.nearestDeadline
                    ? t("farmerDashboard.deadlineSoon")
                    : undefined
                }
                data-testid="stat-nearest-deadline"
              />
            </div>
          </section>

          {/* Ending Soon Auctions List */}
          <section className="mt-8" aria-labelledby="section-ending-soon-title">
            <div className="flex items-center justify-between">
              <h2
                id="section-ending-soon-title"
                className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
              >
                {t("farmerDashboard.endingSoonTitle")}
              </h2>
              <Link
                to="/farmer/crop-bidding"
                className="text-sm font-semibold text-primary hover:underline"
                data-testid="ending-soon-view-all-link"
              >
                {t("farmerDashboard.viewAllBidding")} →
              </Link>
            </div>

            {endingSoon.length === 0 ? (
              <div
                className="mt-4 rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-muted-foreground"
                data-testid="no-ending-soon-msg"
              >
                {t("farmerDashboard.noEndingSoon")}
              </div>
            ) : (
              <div
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="ending-soon-list"
              >
                {endingSoon.map((auction) => {
                  const cropDisplayName = isBangla
                    ? auction.cropNameBn || auction.cropName
                    : auction.cropName;

                  return (
                    <div
                      key={auction.id}
                      className="flex flex-col justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                      data-testid={`ending-soon-card-${auction.id}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{cropDisplayName}</h3>
                            <p className="text-xs text-muted-foreground">
                              {formatLocalizedNumber(auction.quantityKg, isBangla)} kg
                            </p>
                          </div>
                          <GradeBadge grade={auction.grade as CropGrade} />
                        </div>

                        <div className="mt-3 flex items-baseline justify-between border-t border-stone-100 pt-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t("farmerDashboard.currentPrice")}
                            </p>
                            <p className="font-bold text-foreground">
                              {formatDisplayPrice(auction.currentBidPerKg)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                              {t("farmerDashboard.bidsCount", {
                                count: auction.bidCount,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                        <CountdownTimer endsAt={auction.endsAt} />
                        <Link
                          to="/farmer/crop-bidding"
                          className="min-h-9 rounded border border-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                        >
                          {t("farmerDashboard.viewAllBidding")}
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
