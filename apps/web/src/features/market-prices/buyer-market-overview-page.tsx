import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  BANGLADESH_DIVISIONS,
  type CropResponse,
  type MarketHistoryData,
  type NationalSummaryDivisionItem,
  calculatePercentChange,
} from "@bazarbeat/shared";

import { getCrops } from "../listings/api/listing-api.js";
import { fetchMarketHistory, fetchNationalSummary } from "./api/market-prices-api.js";
import { PriceBandChart } from "../../components/shared/price-band-chart.js";
import { ErrorState } from "../../components/shared/data-states.js";
import { formatLocalizedNumber, formatLocalizedPoisha, toBanglaDigits } from "../../lib/format.js";

interface CellMetrics {
  divisionId: string;
  divisionName: string;
  cropId: string;
  cropSlug: string;
  cropName: string;
  avgPricePerKg: number;
  minPricePerKg: number;
  maxPricePerKg: number;
  activeListingsCount: number;
  completedSalesCount: number;
  totalQuantityKg: number;
  nationalMeanPrice: number;
  diffPercent: number | null;
}

export function BuyerMarketOverviewPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const [crops, setCrops] = useState<CropResponse[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(true);

  const [divisionsData, setDivisionsData] = useState<NationalSummaryDivisionItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Crop selector for National Price History chart
  const [selectedCropId, setSelectedCropId] = useState<string>("");
  const [nationalHistory, setNationalHistory] = useState<MarketHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Active hover/tap cell for popover/tooltip
  const [activeCell, setActiveCell] = useState<CellMetrics | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Fetch crops catalog
  useEffect(() => {
    let active = true;
    async function loadCrops(): Promise<void> {
      try {
        const loadedCrops = await getCrops();
        if (!active) return;
        setCrops(loadedCrops);
        if (loadedCrops.length > 0 && !selectedCropId) {
          const firstCrop = loadedCrops[0];
          if (firstCrop) {
            setSelectedCropId(firstCrop.id);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (active) setLoadingCrops(false);
      }
    }
    loadCrops();
    return (): void => {
      active = false;
    };
  }, [selectedCropId]);

  // 2. Fetch national summary across all 8 divisions
  useEffect(() => {
    let active = true;
    setLoadingSummary(true);
    setSummaryError(null);

    async function loadSummary(): Promise<void> {
      try {
        const res = await fetchNationalSummary();
        if (!active) return;
        setDivisionsData(res.data.divisions);
      } catch (err: unknown) {
        if (!active) return;
        setSummaryError(err instanceof Error ? err.message : "Failed to load national market overview");
      } finally {
        if (active) setLoadingSummary(false);
      }
    }

    loadSummary();
    return (): void => {
      active = false;
    };
  }, [refreshKey]);

  // 3. Fetch national price history for the selected crop
  useEffect(() => {
    if (!selectedCropId) return;
    let active = true;
    setLoadingHistory(true);

    async function loadHistory(): Promise<void> {
      try {
        const res = await fetchMarketHistory({
          cropId: selectedCropId,
          division: undefined, // National mean
          range: "30d",
        });
        if (!active) return;
        setNationalHistory(res.data);
      } catch {
        if (!active) return;
        setNationalHistory(null);
      } finally {
        if (active) setLoadingHistory(false);
      }
    }

    loadHistory();
    return (): void => {
      active = false;
    };
  }, [selectedCropId]);

  // Calculate national mean per crop from division cells with active listings
  const nationalMeansByCropId = new Map<string, number>();
  for (const crop of crops) {
    let totalQty = 0;
    let totalValue = 0;
    let fallbackSum = 0;
    let fallbackCount = 0;

    for (const div of divisionsData) {
      const match = div.crops.find((c) => c.cropId === crop.id || c.cropSlug === crop.slug);
      if (match) {
        if (match.activeListingsCount > 0) {
          const qty = match.totalQuantityKg && match.totalQuantityKg > 0 ? match.totalQuantityKg : 1;
          totalQty += qty;
          totalValue += qty * match.avgPricePerKg;
        } else {
          fallbackSum += match.avgPricePerKg;
          fallbackCount += 1;
        }
      }
    }

    if (totalQty > 0) {
      nationalMeansByCropId.set(crop.id, Math.round(totalValue / totalQty));
    } else if (fallbackCount > 0) {
      nationalMeansByCropId.set(crop.id, Math.round(fallbackSum / fallbackCount));
    } else {
      nationalMeansByCropId.set(crop.id, 0);
    }
  }

  // Selected crop for history chart
  const selectedCrop = crops.find((c) => c.id === selectedCropId) ?? crops[0];
  const selectedCropName = isBangla
    ? selectedCrop?.nameBn || selectedCrop?.nameEn
    : selectedCrop?.nameEn || "";

  // Helper to format heat scale style and indicator
  function getHeatScale(diffPercent: number | null): {
    bgClass: string;
    textClass: string;
    borderClass: string;
    label: string;
    badgeClass: string;
    icon: string;
  } {
    if (diffPercent === null) {
      return {
        bgClass: "bg-white",
        textClass: "text-muted-foreground",
        borderClass: "border-stone-200",
        label: t("marketOverview.noListings"),
        badgeClass: "bg-stone-100 text-stone-600",
        icon: "—",
      };
    }
    if (diffPercent <= -5) {
      return {
        bgClass: "bg-emerald-50/70 hover:bg-emerald-100/70",
        textClass: "text-emerald-950 font-bold",
        borderClass: "border-emerald-200",
        label: t("marketOverview.legendBelow"),
        badgeClass: "bg-emerald-100 text-emerald-800",
        icon: "↓",
      };
    }
    if (diffPercent >= 5) {
      return {
        bgClass: "bg-amber-50/70 hover:bg-amber-100/70",
        textClass: "text-amber-950 font-bold",
        borderClass: "border-amber-200",
        label: t("marketOverview.legendAbove"),
        badgeClass: "bg-amber-100 text-amber-800",
        icon: "↑",
      };
    }
    return {
      bgClass: "bg-stone-50/70 hover:bg-stone-100/70",
      textClass: "text-stone-900 font-semibold",
      borderClass: "border-stone-200",
      label: t("marketOverview.legendNear"),
      badgeClass: "bg-stone-100 text-stone-700",
      icon: "≈",
    };
  }

  return (
    <main
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      data-testid="buyer-market-overview-page"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("marketOverview.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("marketOverview.subtitle")}
        </p>
      </div>

      {/* Loading / Error States */}
      {loadingSummary && divisionsData.length === 0 && (
        <div
          className="mt-8 flex h-64 items-center justify-center rounded-xl border border-stone-200 bg-white"
          data-testid="market-overview-loading"
        >
          <p className="text-sm font-medium text-muted-foreground">{t("marketOverview.loading")}</p>
        </div>
      )}

      {summaryError && divisionsData.length === 0 && (
        <div className="mt-8">
          <ErrorState onRetry={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}

      {divisionsData.length > 0 && (
        <div className="mt-6 space-y-8">
          {/* Heat Table Section */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {t("marketOverview.heatTableTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("marketOverview.heatTableSubtitle")}
                </p>
              </div>

              {/* Mobile Scroll Hint */}
              <span className="text-xs font-medium text-muted-foreground sm:hidden">
                {t("marketOverview.mobileScrollHint")}
              </span>
            </div>

            {/* Legend: Not Color Alone (Badges + Text + Percentages) */}
            <div
              className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/70 p-3 text-xs"
              data-testid="heat-table-legend"
              aria-label={t("marketOverview.legendTitle")}
            >
              <span className="font-semibold text-foreground mr-1">
                {t("marketOverview.legendTitle")}:
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                <span aria-hidden="true">↓</span>
                <span>{t("marketOverview.legendBelow")}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-stone-200 px-2 py-0.5 font-medium text-stone-800">
                <span aria-hidden="true">≈</span>
                <span>{t("marketOverview.legendNear")}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                <span aria-hidden="true">↑</span>
                <span>{t("marketOverview.legendAbove")}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground ml-2">
                <span className="font-bold">—</span>
                <span>= {t("marketPrices.noActiveListings")}</span>
              </span>
            </div>

            {/* Scrollable Container with Sticky First Column for 360px Mobile */}
            <div
              className="mt-4 w-full overflow-x-auto rounded-lg border border-stone-200 shadow-xs"
              data-testid="heat-table-container"
            >
              <table className="w-full min-w-[700px] border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-100/90 text-stone-700">
                    {/* Sticky first column: Crop Header */}
                    <th
                      scope="col"
                      className="sticky left-0 z-20 bg-stone-100 px-3 py-3 font-bold shadow-[1px_0_0_0_#e7e5e4] text-foreground min-w-[120px]"
                    >
                      {t("marketOverview.cropColumn")}
                    </th>

                    {/* Division Columns (all 8 divisions) */}
                    {BANGLADESH_DIVISIONS.map((division) => (
                      <th
                        key={division.id}
                        scope="col"
                        className="px-3 py-3 text-center font-semibold text-stone-700 min-w-[90px]"
                      >
                        {isBangla ? division.nameBn : division.nameEn}
                      </th>
                    ))}

                    {/* National Mean Column */}
                    <th
                      scope="col"
                      className="bg-stone-200/70 px-3 py-3 text-center font-bold text-stone-900 min-w-[100px]"
                    >
                      {t("marketOverview.nationalMeanColumn")}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-200">
                  {crops.map((crop) => {
                    const nationalMean = nationalMeansByCropId.get(crop.id) ?? 0;
                    const cropName = isBangla ? crop.nameBn || crop.nameEn : crop.nameEn;

                    return (
                      <tr key={crop.id} className="hover:bg-stone-50/40">
                        {/* Sticky Crop Column */}
                        <td className="sticky left-0 z-10 bg-white px-3 py-3 font-semibold text-foreground shadow-[1px_0_0_0_#e7e5e4] whitespace-nowrap">
                          {cropName}
                        </td>

                        {/* 8 Division Cells */}
                        {BANGLADESH_DIVISIONS.map((division) => {
                          const divRecord = divisionsData.find((d) => d.division === division.id);
                          const cropRecord = divRecord?.crops.find(
                            (c) => c.cropId === crop.id || c.cropSlug === crop.slug,
                          );

                          const hasActiveListings = (cropRecord?.activeListingsCount ?? 0) > 0;
                          const cellPrice = cropRecord?.avgPricePerKg ?? 0;
                          const diffPercent =
                            hasActiveListings && nationalMean > 0
                              ? calculatePercentChange(cellPrice, nationalMean)
                              : null;

                          const heat = getHeatScale(diffPercent);

                          const cellMetrics: CellMetrics = {
                            divisionId: division.id,
                            divisionName: isBangla ? division.nameBn : division.nameEn,
                            cropId: crop.id,
                            cropSlug: crop.slug,
                            cropName,
                            avgPricePerKg: cellPrice,
                            minPricePerKg: cropRecord?.minPricePerKg ?? cellPrice,
                            maxPricePerKg: cropRecord?.maxPricePerKg ?? cellPrice,
                            activeListingsCount: cropRecord?.activeListingsCount ?? 0,
                            completedSalesCount: cropRecord?.completedSalesCount ?? 0,
                            totalQuantityKg: cropRecord?.totalQuantityKg ?? 0,
                            nationalMeanPrice: nationalMean,
                            diffPercent,
                          };

                          return (
                            <td
                              key={division.id}
                              className={`px-2 py-2 text-center transition ${heat.bgClass}`}
                              data-testid={`heat-cell-${crop.slug}-${division.id}`}
                              onMouseEnter={() => setActiveCell(cellMetrics)}
                              onClick={() => setActiveCell(cellMetrics)}
                            >
                              {hasActiveListings ? (
                                <Link
                                  to={`/buyer/marketplace?crop=${crop.slug}&division=${division.id}`}
                                  className="group flex flex-col items-center justify-center rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                                  data-testid={`heat-cell-link-${crop.slug}-${division.id}`}
                                  title={`${cropName} in ${division.nameEn}: ${formatLocalizedPoisha(
                                    cellPrice,
                                    isBangla,
                                  )}/kg (${cellMetrics.activeListingsCount} listings)`}
                                >
                                  {/* Numeric Value shown in every cell */}
                                  <span className={`text-xs sm:text-sm ${heat.textClass}`}>
                                    {formatLocalizedPoisha(cellPrice, isBangla)}
                                  </span>

                                  {/* Accessible heat indicator tag */}
                                  <span
                                    className={`mt-0.5 inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold ${heat.badgeClass}`}
                                  >
                                    <span>{heat.icon}</span>
                                    {diffPercent !== null && (
                                      <span>
                                        {diffPercent > 0 ? "+" : ""}
                                        {isBangla
                                          ? toBanglaDigits(diffPercent.toFixed(0))
                                          : diffPercent.toFixed(0)}
                                        %
                                      </span>
                                    )}
                                  </span>
                                </Link>
                              ) : (
                                <span
                                  className="inline-block py-2 text-xs font-semibold text-muted-foreground"
                                  data-testid={`empty-cell-${crop.slug}-${division.id}`}
                                >
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* National Mean Cell */}
                        <td className="bg-stone-100/70 px-3 py-3 text-center font-bold text-foreground">
                          {nationalMean > 0 ? (
                            <span>{formatLocalizedPoisha(nationalMean, isBangla)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tap / Hover Detail Card */}
            {activeCell && (
              <div
                className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                data-testid="cell-hover-card"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground sm:text-base">
                      {activeCell.cropName} • {activeCell.divisionName}
                    </span>
                    {activeCell.activeListingsCount > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        {t("marketOverview.activeListings", { count: activeCell.activeListingsCount })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
                        {t("marketPrices.noActiveListings")}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">
                        {formatLocalizedPoisha(activeCell.avgPricePerKg, isBangla)} / kg
                      </strong>{" "}
                      (Range: {formatLocalizedPoisha(activeCell.minPricePerKg, isBangla)} –{" "}
                      {formatLocalizedPoisha(activeCell.maxPricePerKg, isBangla)})
                    </span>
                    {activeCell.totalQuantityKg > 0 && (
                      <span>
                        • {t("marketOverview.totalVolume", {
                          kg: formatLocalizedNumber(activeCell.totalQuantityKg, isBangla),
                        })}
                      </span>
                    )}
                    {activeCell.diffPercent !== null && (
                      <span>
                        • vs National:{" "}
                        <strong className={activeCell.diffPercent < 0 ? "text-emerald-700" : "text-amber-800"}>
                          {activeCell.diffPercent > 0 ? "+" : ""}
                          {isBangla
                            ? toBanglaDigits(activeCell.diffPercent.toFixed(1))
                            : activeCell.diffPercent.toFixed(1)}
                          %
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {activeCell.activeListingsCount > 0 && (
                  <Link
                    to={`/buyer/marketplace?crop=${activeCell.cropSlug}&division=${activeCell.divisionId}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary self-start sm:self-auto whitespace-nowrap"
                    data-testid="cell-hover-marketplace-link"
                  >
                    {t("marketOverview.openMarketplace")}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* National Price History Chart with Crop Selector */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6 shadow-sm" data-testid="national-history-section">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  {t("marketOverview.nationalTrendTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  {t("marketOverview.nationalTrendSubtitle", { crop: selectedCropName })}
                </p>
              </div>

              {/* Crop Selector Dropdown */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label
                  htmlFor="national-chart-crop-select"
                  className="text-xs font-semibold text-muted-foreground whitespace-nowrap"
                >
                  {t("marketOverview.selectCrop")}:
                </label>
                <select
                  id="national-chart-crop-select"
                  value={selectedCropId}
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  disabled={loadingCrops}
                  className="min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="national-chart-crop-selector"
                >
                  {crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {isBangla ? crop.nameBn || crop.nameEn : crop.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* National Price Band Chart */}
            <div className="mt-6">
              {loadingHistory && !nationalHistory ? (
                <div className="flex h-56 w-full items-center justify-center rounded-lg border border-stone-200 bg-stone-50/50 text-xs text-muted-foreground">
                  {t("marketPrices.loading")}
                </div>
              ) : nationalHistory ? (
                <PriceBandChart
                  title={`${selectedCropName} - ${t("marketOverview.nationalTrendTitle")}`}
                  subtitle={`${t("marketPrices.allDivisionsNational")} • 30d`}
                  data={nationalHistory.series}
                  emptyMessage={t("marketPrices.emptyHistory")}
                  isBangla={isBangla}
                  data-testid="national-price-band-chart"
                />
              ) : (
                <div className="flex h-56 w-full items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50/50 text-xs text-muted-foreground">
                  {t("marketPrices.emptyHistory")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default BuyerMarketOverviewPage;
