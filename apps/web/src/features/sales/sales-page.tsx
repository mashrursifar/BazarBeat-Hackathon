import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BANGLADESH_DIVISIONS,
  type SaleItem,
  formatDisplayPrice,
  formatPoisha,
} from "@bazarbeat/shared";

import { DataTable, EmptyState, ErrorState, StatCard } from "../../components/shared/data-states.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { getCrops } from "../listings/api/listing-api.js";
import { fetchSales } from "./api/sales-api.js";

export default function SalesPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL filter params
  const cropParam = searchParams.get("crop") ?? "";
  const startDateParam = searchParams.get("startDate") ?? searchParams.get("from") ?? "";
  const endDateParam = searchParams.get("endDate") ?? searchParams.get("to") ?? "";
  const divisionParam = searchParams.get("buyerDivision") ?? searchParams.get("division") ?? "";
  const pageParam = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // Available catalog crops
  const cropsQuery = useQuery({
    queryKey: ["crops"],
    queryFn: getCrops,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch sales
  const salesQuery = useQuery({
    queryKey: ["sales", { crop: cropParam, startDate: startDateParam, endDate: endDateParam, buyerDivision: divisionParam, page: pageParam }],
    queryFn: () =>
      fetchSales({
        crop: cropParam || undefined,
        startDate: startDateParam || undefined,
        endDate: endDateParam || undefined,
        buyerDivision: divisionParam || undefined,
        page: pageParam,
        limit: 20,
      }),
  });

  const updateParam = (key: string, value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    // Any filter update resets to page 1
    if (key !== "page") {
      next.delete("page");
    }
    setSearchParams(next);
  };

  const handleClearFilters = (): void => {
    const next = new URLSearchParams();
    setSearchParams(next);
  };

  const hasActiveFilters = Boolean(cropParam || startDateParam || endDateParam || divisionParam);

  const dateFormatter = new Intl.DateTimeFormat(isBangla ? "bn-BD" : "en-BD", {
    dateStyle: "medium",
    timeZone: "Asia/Dhaka",
  });

  if (salesQuery.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("sales.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("sales.pageSubtitle")}</p>
        <div className="mt-8 p-12 text-center text-muted-foreground" role="status">
          {t("form.working")}
        </div>
      </main>
    );
  }

  if (salesQuery.isError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("sales.pageTitle")}</h1>
        <div className="mt-6">
          <ErrorState onRetry={() => void salesQuery.refetch()} />
        </div>
      </main>
    );
  }

  const salesData = salesQuery.data?.data ?? [];
  const meta = salesQuery.data?.meta;
  const totals = meta?.totals;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const currentPage = meta?.page ?? pageParam;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" data-testid="sales-page">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("sales.pageTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("sales.pageSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/farmer/orders"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-stone-50"
          >
            {t("sales.viewOrders")}
          </Link>
          <Link
            to="/farmer/new-listing"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90"
          >
            {t("sales.newListing")}
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4 shadow-sm" data-testid="sales-filter-bar">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Crop Filter */}
          <div>
            <label htmlFor="sales-crop-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sales.filterCrop")}
            </label>
            <select
              id="sales-crop-select"
              data-testid="sales-crop-filter"
              value={cropParam}
              onChange={(e) => updateParam("crop", e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("sales.allCrops")}</option>
              {cropsQuery.data?.map((crop) => (
                <option key={crop.id} value={crop.slug ?? crop.id}>
                  {isBangla ? crop.nameBn : crop.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Division Filter */}
          <div>
            <label htmlFor="sales-division-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sales.filterDivision")}
            </label>
            <select
              id="sales-division-select"
              data-testid="sales-division-filter"
              value={divisionParam}
              onChange={(e) => updateParam("buyerDivision", e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("sales.allDivisions")}</option>
              {BANGLADESH_DIVISIONS.map((div) => (
                <option key={div.id} value={div.nameEn}>
                  {isBangla ? div.nameBn : div.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label htmlFor="sales-start-date" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sales.startDate")}
            </label>
            <input
              id="sales-start-date"
              type="date"
              data-testid="sales-start-date"
              value={startDateParam}
              onChange={(e) => updateParam("startDate", e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date To */}
          <div>
            <label htmlFor="sales-end-date" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sales.endDate")}
            </label>
            <input
              id="sales-end-date"
              type="date"
              data-testid="sales-end-date"
              value={endDateParam}
              onChange={(e) => updateParam("endDate", e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              data-testid="sales-clear-filters"
              onClick={handleClearFilters}
              className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
            >
              ✕ {t("sales.clearFilters")}
            </button>
          </div>
        )}
      </div>

      {/* Main Content: Empty state or Table / Mobile cards */}
      {salesData.length === 0 ? (
        <div className="mt-6" data-testid="sales-empty-state">
          <EmptyState
            title={t("sales.emptyTitle")}
            action={
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters ? t("sales.emptyFilteredSubtitle") : t("sales.emptySubtitle")}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-2 rounded-md bg-stone-100 px-4 py-2 text-sm font-semibold text-foreground hover:bg-stone-200"
                  >
                    {t("sales.clearFilters")}
                  </button>
                ) : (
                  <Link
                    to="/farmer/new-listing"
                    className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    {t("sales.newListing")}
                  </Link>
                )}
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Mobile Totals Overview Card (visible on mobile) */}
          {totals && (
            <div className="block md:hidden rounded-lg border border-stone-200 bg-emerald-50/50 p-4 shadow-sm" data-testid="sales-mobile-totals">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t("sales.totalsRow")}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">{t("sales.quantity")}:</span>
                  <p className="font-semibold">{totals.totalQuantityKg} kg</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t("sales.gross")}:</span>
                  <p className="font-semibold">{formatPoisha(totals.totalSubtotal)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t("sales.fee")}:</span>
                  <p className="font-semibold text-stone-600">{formatPoisha(totals.totalPlatformFee)}</p>
                </div>
                <div>
                  <span className="text-xs text-emerald-700 font-medium">{t("sales.net")}:</span>
                  <p className="font-bold text-emerald-700">{formatPoisha(totals.totalFarmerNet)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block" data-testid="sales-desktop-table">
            <DataTable label={t("sales.tableCaption")}>
              <thead>
                <tr className="border-b bg-stone-50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="p-3">{t("sales.date")}</th>
                  <th className="p-3">{t("sales.crop")}</th>
                  <th className="p-3">{t("sales.grade")}</th>
                  <th className="p-3 text-right">{t("sales.quantity")}</th>
                  <th className="p-3 text-right">{t("sales.pricePerKg")}</th>
                  <th className="p-3 text-right">{t("sales.gross")}</th>
                  <th className="p-3 text-right">{t("sales.fee")}</th>
                  <th className="p-3 text-right">{t("sales.net")}</th>
                  <th className="p-3">{t("sales.buyer")}</th>
                  <th className="p-3 text-center">{t("sales.premium")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {salesData.map((sale: SaleItem) => {
                  const saleDate = new Date(sale.soldAt ?? sale.date ?? Date.now());
                  return (
                    <tr key={sale.id} className="hover:bg-stone-50/70" data-testid={`sale-row-${sale.id}`}>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {dateFormatter.format(saleDate)}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {isBangla ? sale.cropNameBn : sale.cropName}
                      </td>
                      <td className="p-3">
                        <GradeBadge grade={sale.grade} />
                      </td>
                      <td className="p-3 text-right font-medium text-foreground whitespace-nowrap">
                        {sale.quantityKg} kg
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-mono text-xs">
                        {formatDisplayPrice(sale.pricePerKg)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-medium text-stone-700">
                        {formatPoisha(sale.subtotal)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap text-xs text-stone-500">
                        {formatPoisha(sale.platformFee)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-bold text-emerald-600">
                        {formatPoisha(sale.farmerNet)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">{sale.buyerName}</div>
                        <div>{sale.buyerDivision ?? sale.buyerRegion ?? ""}</div>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {sale.pricePremiumPercent !== undefined ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              sale.pricePremiumPercent >= 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {sale.pricePremiumPercent >= 0 ? "+" : ""}
                            {sale.pricePremiumPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totals && (
                <tfoot className="border-t-2 border-stone-300 bg-stone-100/80 font-semibold text-foreground" data-testid="sales-totals-row">
                  <tr>
                    <td colSpan={3} className="p-3 text-sm font-bold">
                      {t("sales.totalsRow")} ({meta?.total ?? salesData.length})
                    </td>
                    <td className="p-3 text-right text-sm font-bold whitespace-nowrap">
                      {totals.totalQuantityKg} kg
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right text-sm font-bold whitespace-nowrap">
                      {formatPoisha(totals.totalSubtotal)}
                    </td>
                    <td className="p-3 text-right text-xs font-semibold whitespace-nowrap text-stone-600">
                      {formatPoisha(totals.totalPlatformFee)}
                    </td>
                    <td className="p-3 text-right text-sm font-bold whitespace-nowrap text-emerald-700">
                      {formatPoisha(totals.totalFarmerNet)}
                    </td>
                    <td colSpan={2} className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </DataTable>
          </div>

          {/* Mobile Card Layout */}
          <div className="space-y-4 md:hidden" data-testid="sales-mobile-list">
            {salesData.map((sale: SaleItem) => {
              const saleDate = new Date(sale.soldAt ?? sale.date ?? Date.now());
              return (
                <div
                  key={sale.id}
                  data-testid={`sale-card-${sale.id}`}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">
                          {isBangla ? sale.cropNameBn : sale.cropName}
                        </h3>
                        <GradeBadge grade={sale.grade} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dateFormatter.format(saleDate)}
                      </p>
                    </div>
                    {sale.pricePremiumPercent !== undefined && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          sale.pricePremiumPercent >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {sale.pricePremiumPercent >= 0 ? "+" : ""}
                        {sale.pricePremiumPercent.toFixed(1)}% AI
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-b border-stone-100 py-2">
                    <div>
                      <span className="font-semibold text-foreground">{sale.buyerName}</span>
                      {sale.buyerDivision && <span className="ml-1 text-stone-500">({sale.buyerDivision})</span>}
                    </div>
                    <div className="font-medium text-foreground">
                      {sale.quantityKg} kg @ {formatDisplayPrice(sale.pricePerKg)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">{t("sales.gross")}:</span>
                      <p className="font-medium">{formatPoisha(sale.subtotal)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("sales.fee")}:</span>
                      <p className="text-stone-600">{formatPoisha(sale.platformFee)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-700 font-semibold">{t("sales.net")}:</span>
                      <p className="font-bold text-emerald-700">{formatPoisha(sale.farmerNet)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 border-t border-stone-200 pt-4" data-testid="sales-pagination">
              <span className="text-sm text-muted-foreground">
                {t("sales.page", { page: currentPage, totalPages })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="sales-prev-page"
                  disabled={currentPage <= 1}
                  onClick={() => updateParam("page", String(currentPage - 1))}
                  className="min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm hover:bg-stone-50 disabled:opacity-50"
                >
                  {t("sales.previous")}
                </button>
                <button
                  type="button"
                  data-testid="sales-next-page"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateParam("page", String(currentPage + 1))}
                  className="min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm hover:bg-stone-50 disabled:opacity-50"
                >
                  {t("sales.next")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
