import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDisplayPrice, formatPoisha } from "@bazarbeat/shared";

import { DataTable, EmptyState, ErrorState } from "../../components/shared/data-states.js";
import { fetchEarnings } from "./api/earnings-api.js";
import { EarningsSixMonthChart } from "./components/earnings-six-month-chart.js";

export default function EarningsPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const earningsQuery = useQuery({
    queryKey: ["earnings"],
    queryFn: fetchEarnings,
  });

  if (earningsQuery.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("earnings.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("earnings.pageSubtitle")}</p>
        <div className="mt-8 p-12 text-center text-muted-foreground" role="status">
          {t("form.working")}
        </div>
      </main>
    );
  }

  if (earningsQuery.isError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("earnings.pageTitle")}</h1>
        <div className="mt-6">
          <ErrorState onRetry={() => void earningsQuery.refetch()} />
        </div>
      </main>
    );
  }

  const earningsData = earningsQuery.data;
  const summary = earningsData?.summary;
  const byCrop = earningsData?.byCrop ?? [];
  const monthlySeries = earningsData?.last6MonthsSeries ?? earningsData?.monthlySeries ?? [];
  const feeRate = earningsData?.feeRate ?? {
    bps: summary?.feeRateBps ?? 200,
    percent: summary?.feeRatePercent ?? 2.0,
  };

  const settledNet = summary?.settledNet ?? summary?.totalEarnings ?? 0;
  const expectedNet = summary?.expectedNet ?? summary?.activeNet ?? 0;
  const disputedNet = summary?.disputedNet ?? 0;
  const disputedCount = summary?.disputedOrdersCount ?? 0;
  const gross = summary?.gross ?? summary?.totalSubtotal ?? 0;
  const fees = summary?.fees ?? summary?.totalPlatformFees ?? 0;
  const avgPremium = summary?.averagePricePremiumPercent ?? summary?.averagePremiumPercent ?? 0;
  const completedCount = summary?.completedOrdersCount ?? 0;

  const isCompletelyEmpty =
    completedCount === 0 && settledNet === 0 && expectedNet === 0 && disputedNet === 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" data-testid="earnings-page">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("earnings.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("earnings.pageSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/farmer/sales"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-stone-50"
          >
            {t("nav.sales")}
          </Link>
          <Link
            to="/farmer/new-listing"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90"
          >
            {t("earnings.newListing")}
          </Link>
        </div>
      </div>

      {isCompletelyEmpty ? (
        <div className="mt-8" data-testid="earnings-empty-state">
          <EmptyState
            title={t("earnings.emptyTitle")}
            action={
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">{t("earnings.emptySubtitle")}</p>
                <Link
                  to="/farmer/new-listing"
                  className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  {t("earnings.newListing")}
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Highlighted "Average premium over AI market estimate" Pitch Card */}
          <div
            className="relative overflow-hidden rounded-xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-6 shadow-sm"
            data-testid="pitch-premium-card"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {t("earnings.pitchBadge")}
                  </span>
                  <span className="text-xs font-medium text-emerald-800">
                    BazarBeat Auction Advantage
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-bold text-foreground sm:text-xl">
                  {t("earnings.pitchCardTitle")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                  {t("earnings.pitchCardSubtitle")}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end">
                <span
                  className="text-4xl sm:text-5xl font-extrabold tracking-tight text-emerald-600"
                  data-testid="pitch-premium-value"
                >
                  {avgPremium >= 0 ? "+" : ""}
                  {avgPremium.toFixed(1)}%
                </span>
                <span className="text-xs font-medium text-muted-foreground mt-1">
                  vs. Local Market Baseline
                </span>
              </div>
            </div>
          </div>

          {/* 5 KPI Cards (including In dispute shown separately) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="earnings-kpi-cards">
            {/* Card 1: Settled Net (Simulated) */}
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm"
              data-testid="kpi-settled-net"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {t("earnings.settledNet")}
                </span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Simulated
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">
                {formatPoisha(settledNet)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("earnings.settledNetSubtitle")}
              </p>
            </div>

            {/* Card 2: Expected Net */}
            <div
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              data-testid="kpi-expected-net"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("earnings.expectedNet")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground">
                {formatPoisha(expectedNet)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("earnings.expectedNetSubtitle")}
              </p>
            </div>

            {/* Card 3: In Dispute (Shown separately) */}
            <div
              className={`rounded-lg border p-5 shadow-sm ${
                disputedNet > 0
                  ? "border-orange-300 bg-orange-50/60"
                  : "border-stone-200 bg-white"
              }`}
              data-testid="kpi-in-dispute"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-900">
                  {t("earnings.disputedNet", "In Dispute")}
                </span>
                {disputedCount > 0 && (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
                    {disputedCount} {isBangla ? "টি" : "orders"}
                  </span>
                )}
              </div>
              <p
                className={`mt-2 text-2xl sm:text-3xl font-extrabold ${
                  disputedNet > 0 ? "text-orange-700" : "text-stone-700"
                }`}
                data-testid="kpi-in-dispute-value"
              >
                {formatPoisha(disputedNet)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("earnings.disputedNetSubtitle", "Held pending dispute resolution")}
              </p>
            </div>

            {/* Card 4: Gross Sales */}
            <div
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              data-testid="kpi-gross-sales"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("earnings.gross")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground">
                {formatPoisha(gross)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("earnings.grossSubtitle")}
              </p>
            </div>

            {/* Card 5: Platform Fees */}
            <div
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              data-testid="kpi-platform-fees"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("earnings.fees")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-stone-700">
                {formatPoisha(fees)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("earnings.feesSubtitle")}
              </p>
            </div>
          </div>

          {/* Clear Fee-rate Note */}
          <div
            className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-xs text-muted-foreground shadow-sm"
            data-testid="fee-rate-note"
          >
            <span className="text-base">ℹ️</span>
            <span>
              {t("earnings.feeRateNote", {
                percent: feeRate.percent.toFixed(1),
                bps: feeRate.bps,
              })}
            </span>
          </div>

          {/* 6-Month Chart */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm" data-testid="earnings-chart-section">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  {t("earnings.sixMonthTrend")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("earnings.sixMonthSubtitle")}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <EarningsSixMonthChart series={monthlySeries} isBangla={isBangla} />
            </div>
          </div>

          {/* Per-Crop Breakdown */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm" data-testid="earnings-by-crop-section">
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              {t("earnings.byCropTitle")}
            </h2>

            {/* Desktop Table */}
            <div className="mt-4 hidden md:block">
              <DataTable label={t("earnings.byCropTitle")}>
                <thead>
                  <tr className="border-b bg-stone-50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3">{t("earnings.crop")}</th>
                    <th className="p-3 text-right">{t("earnings.totalKg")}</th>
                    <th className="p-3 text-right">{t("earnings.totalEarnings")}</th>
                    <th className="p-3 text-right">{t("earnings.avgPrice")}</th>
                    <th className="p-3 text-center">{t("earnings.orderCount")}</th>
                    <th className="p-3 text-center">{t("earnings.avgPremium")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {byCrop.map((crop) => (
                    <tr key={crop.cropId} className="hover:bg-stone-50/70" data-testid={`crop-row-${crop.cropId}`}>
                      <td className="p-3 font-semibold text-foreground">
                        {isBangla ? crop.cropNameBn : crop.cropName}
                      </td>
                      <td className="p-3 text-right font-medium whitespace-nowrap">
                        {crop.totalKg} kg
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatPoisha(crop.totalEarnings)}
                      </td>
                      <td className="p-3 text-right font-mono text-xs whitespace-nowrap">
                        {formatDisplayPrice(crop.averagePricePerKg)}
                      </td>
                      <td className="p-3 text-center font-medium">
                        {crop.orderCount}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {crop.averagePricePremiumPercent !== undefined ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              crop.averagePricePremiumPercent >= 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {crop.averagePricePremiumPercent >= 0 ? "+" : ""}
                            {crop.averagePricePremiumPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("earnings.na")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            {/* Mobile Cards for per-crop breakdown */}
            <div className="mt-4 space-y-3 md:hidden">
              {byCrop.map((crop) => (
                <div
                  key={crop.cropId}
                  data-testid={`crop-card-${crop.cropId}`}
                  className="rounded-lg border border-stone-200 bg-stone-50/40 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground">
                      {isBangla ? crop.cropNameBn : crop.cropName}
                    </h3>
                    {crop.averagePricePremiumPercent !== undefined && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        {crop.averagePricePremiumPercent >= 0 ? "+" : ""}
                        {crop.averagePricePremiumPercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">{t("earnings.totalKg")}:</span>
                      <p className="font-semibold">{crop.totalKg} kg</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("earnings.totalEarnings")}:</span>
                      <p className="font-bold text-emerald-700">{formatPoisha(crop.totalEarnings)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("earnings.avgPrice")}:</span>
                      <p className="font-medium">{formatDisplayPrice(crop.averagePricePerKg)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("earnings.orderCount")}:</span>
                      <p className="font-medium">{crop.orderCount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
