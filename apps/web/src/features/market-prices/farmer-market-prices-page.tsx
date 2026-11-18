import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  BANGLADESH_DIVISIONS,
  type CropGrade,
  type CropResponse,
  DASHBOARD_RANGE_PRESETS,
  type DashboardRangePreset,
  type MarketGradeGuide,
  type MarketHistoryData,
  type MarketPriceTrend,
  calculatePercentChange,
} from "@bazarbeat/shared";

import { useOptionalAuth } from "../auth/auth-context.js";
import { getCrops } from "../listings/api/listing-api.js";
import { fetchMarketHistory } from "./api/market-prices-api.js";
import { PriceBandChart } from "../../components/shared/price-band-chart.js";
import { ChangeIndicator } from "../../components/shared/change-indicator.js";
import { ErrorState, StatCard } from "../../components/shared/data-states.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { formatLocalizedPoisha, toBanglaDigits } from "../../lib/format.js";

export function FarmerMarketPricesPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const auth = useOptionalAuth();
  const user = auth?.user;
  const [searchParams, setSearchParams] = useSearchParams();

  // Crops catalog
  const [crops, setCrops] = useState<CropResponse[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(true);

  // User selections
  const userDivision = user?.division?.toLowerCase()?.trim() || "";
  const initialDivision = searchParams.get("division") ?? userDivision;
  const initialCropId = searchParams.get("cropId") ?? "";
  const initialRange = (searchParams.get("range") as DashboardRangePreset) || "30d";

  const [selectedCropId, setSelectedCropId] = useState<string>(initialCropId);
  const [selectedDivision, setSelectedDivision] = useState<string>(initialDivision);
  const [selectedRange, setSelectedRange] = useState<DashboardRangePreset>(
    DASHBOARD_RANGE_PRESETS.includes(initialRange) ? initialRange : "30d",
  );

  // Market telemetry data
  const [marketHistory, setMarketHistory] = useState<MarketHistoryData | null>(null);
  const [nationalHistory, setNationalHistory] = useState<MarketHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Load active crops
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
            const matchedCrop = initialCropId
              ? loadedCrops.find((c) => c.id === initialCropId || c.slug === initialCropId)
              : firstCrop;
            setSelectedCropId(matchedCrop ? matchedCrop.id : firstCrop.id);
          }
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load crops");
      } finally {
        if (active) setLoadingCrops(false);
      }
    }
    loadCrops();
    return (): void => {
      active = false;
    };
  }, [initialCropId, selectedCropId]);

  // Sync state to URL params
  useEffect(() => {
    if (!selectedCropId) return;
    const params = new URLSearchParams();
    params.set("cropId", selectedCropId);
    if (selectedDivision) params.set("division", selectedDivision);
    if (selectedRange && selectedRange !== "30d") params.set("range", selectedRange);
    setSearchParams(params, { replace: true });
  }, [selectedCropId, selectedDivision, selectedRange, setSearchParams]);

  // 2. Load market history and national comparison
  useEffect(() => {
    if (!selectedCropId) return;
    let active = true;
    setLoading(true);
    setError(null);

    async function loadMarketData(): Promise<void> {
      try {
        // Fetch selected division history
        const historyPromise = fetchMarketHistory({
          cropId: selectedCropId,
          division: selectedDivision || undefined,
          range: selectedRange,
        });

        // If a division is selected, also fetch national mean for comparison
        const nationalPromise = selectedDivision
          ? fetchMarketHistory({
              cropId: selectedCropId,
              division: undefined,
              range: selectedRange,
            })
          : Promise.resolve(null);

        const [historyRes, nationalRes] = await Promise.all([
          historyPromise,
          nationalPromise,
        ]);

        if (!active) return;
        setMarketHistory(historyRes.data);
        setNationalHistory(nationalRes ? nationalRes.data : null);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load market prices");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMarketData();
    return (): void => {
      active = false;
    };
  }, [selectedCropId, selectedDivision, selectedRange, refreshKey]);

  const selectedCrop = crops.find((c) => c.id === selectedCropId) ?? crops[0];
  const selectedCropName = isBangla
    ? selectedCrop?.nameBn || selectedCrop?.nameEn
    : selectedCrop?.nameEn || "";

  // Division comparison metrics
  const divisionPrice = marketHistory?.currentAvgPricePerKg ?? 0;
  const nationalPrice = selectedDivision
    ? nationalHistory?.currentAvgPricePerKg ?? 0
    : marketHistory?.currentAvgPricePerKg ?? 0;

  const priceDiffPoisha = selectedDivision && nationalPrice > 0 ? divisionPrice - nationalPrice : 0;
  const priceDiffPercent =
    selectedDivision && nationalPrice > 0
      ? calculatePercentChange(divisionPrice, nationalPrice)
      : null;

  // Trend mapping
  function renderTrendBadge(trend?: MarketPriceTrend): ReactElement {
    if (trend === "UP") {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
          data-testid="trend-badge-up"
        >
          <span aria-hidden="true" className="font-bold">
            ↑
          </span>
          <span>{t("marketPrices.trendUp")}</span>
        </span>
      );
    }
    if (trend === "DOWN") {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800"
          data-testid="trend-badge-down"
        >
          <span aria-hidden="true" className="font-bold">
            ↓
          </span>
          <span>{t("marketPrices.trendDown")}</span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-700"
        data-testid="trend-badge-flat"
      >
        <span aria-hidden="true" className="font-bold">
          →
        </span>
        <span>{t("marketPrices.trendFlat")}</span>
      </span>
    );
  }

  // Grade Guide Helper
  function renderGradeGuide(guide?: MarketGradeGuide): ReactElement | null {
    if (!guide) return null;
    const grades: (keyof MarketGradeGuide)[] = ["A", "B", "C"];

    return (
      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-4 sm:p-6 shadow-sm" data-testid="grade-guide-section">
        <div className="mb-4">
          <h2 className="text-base font-bold text-foreground sm:text-lg">
            {t("marketPrices.gradeGuideTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {t("marketPrices.gradeGuideSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {grades.map((gradeKey) => {
            const item = guide[gradeKey];
            if (!item) return null;

            return (
              <div
                key={gradeKey}
                className="flex flex-col justify-between rounded-lg border border-stone-200 bg-stone-50/60 p-4 transition hover:border-primary/40"
                data-testid={`grade-card-${gradeKey}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <GradeBadge grade={gradeKey as CropGrade} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.provider ? `${item.provider}` : "AI Benchmark"}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-xs text-muted-foreground">{t("marketPrices.expectedPrice")}</span>
                    <div className="text-xl font-bold text-primary sm:text-2xl">
                      {formatLocalizedPoisha(item.expectedPerKg, isBangla)}
                      <span className="text-xs font-normal text-muted-foreground"> / kg</span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-stone-600">
                    <span className="text-muted-foreground">{t("marketPrices.gradeRange")}: </span>
                    <span className="font-semibold">
                      {formatLocalizedPoisha(item.lowPerKg, isBangla)} – {formatLocalizedPoisha(item.highPerKg, isBangla)}
                    </span>
                  </div>

                  {item.suggestedFloorPerKg && (
                    <div className="mt-1 text-xs text-stone-600">
                      <span className="text-muted-foreground">{t("marketPrices.suggestedFloor")}: </span>
                      <span className="font-semibold text-emerald-800">
                        {formatLocalizedPoisha(item.suggestedFloorPerKg, isBangla)} / kg
                      </span>
                    </div>
                  )}
                </div>

                {item.description && (
                  <p className="mt-3 border-t border-stone-200/80 pt-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      data-testid="farmer-market-prices-page"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("marketPrices.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("marketPrices.subtitle")}
          </p>
        </div>

        {/* Call-to-action: Create listing for selected crop */}
        {selectedCrop && (
          <Link
            to={`/farmer/new-listing?crop=${selectedCrop.slug}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary self-start sm:self-auto"
            data-testid="create-listing-cta"
          >
            {t("marketPrices.createListingCta", { crop: selectedCropName })} →
          </Link>
        )}
      </div>

      {/* Selectors Bar: Crop, Division, Range Presets */}
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Crop Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="market-crop-select" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {t("marketPrices.cropSelectorLabel")}:
            </label>
            <select
              id="market-crop-select"
              value={selectedCropId}
              onChange={(e) => setSelectedCropId(e.target.value)}
              disabled={loadingCrops}
              className="min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="crop-selector"
            >
              {crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {isBangla ? crop.nameBn || crop.nameEn : crop.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Division Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="market-division-select" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {t("marketPrices.divisionSelectorLabel")}:
            </label>
            <select
              id="market-division-select"
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="division-selector"
            >
              <option value="">{t("marketPrices.allDivisionsNational")}</option>
              {BANGLADESH_DIVISIONS.map((div) => (
                <option key={div.id} value={div.id}>
                  {isBangla ? div.nameBn : div.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Range Selector */}
        <div
          role="group"
          aria-label={t("farmerDashboard.periodRange")}
          className="inline-flex flex-wrap rounded-lg border border-stone-200 bg-stone-100 p-0.5"
          data-testid="range-selector"
        >
          {DASHBOARD_RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSelectedRange(preset)}
              aria-pressed={selectedRange === preset}
              data-testid={`range-preset-${preset}`}
              className={`min-h-8 rounded-md px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selectedRange === preset
                  ? "bg-white text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`farmerDashboard.range.${preset}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && !marketHistory && (
        <div className="mt-8 flex h-64 items-center justify-center rounded-xl border border-stone-200 bg-white" data-testid="market-prices-loading">
          <p className="text-sm font-medium text-muted-foreground">{t("marketPrices.loading")}</p>
        </div>
      )}

      {error && !marketHistory && (
        <div className="mt-8">
          <ErrorState onRetry={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}

      {/* Main Content Area */}
      {marketHistory && (
        <div className="mt-6 space-y-6">
          {/* Header Cards from summary / market prices endpoint */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="market-header-cards">
            {/* 1. Latest Average Price */}
            <StatCard
              label={t("marketPrices.latestAverage")}
              value={`${formatLocalizedPoisha(marketHistory.currentAvgPricePerKg, isBangla)} / kg`}
              subtitle={
                selectedDivision
                  ? `${t("marketPrices.divisionAverage")} (${
                      isBangla
                        ? BANGLADESH_DIVISIONS.find((d) => d.id === selectedDivision)?.nameBn
                        : BANGLADESH_DIVISIONS.find((d) => d.id === selectedDivision)?.nameEn
                    })`
                  : t("marketPrices.nationalAverage")
              }
              data-testid="stat-latest-avg"
            />

            {/* 2. 7-Day Change */}
            <StatCard
              label={t("marketPrices.sevenDayChange")}
              value={
                marketHistory.changePercent !== null && marketHistory.changePercent !== undefined
                  ? `${marketHistory.changePercent > 0 ? "+" : ""}${
                      isBangla
                        ? toBanglaDigits(marketHistory.changePercent.toFixed(1))
                        : marketHistory.changePercent.toFixed(1)
                    }%`
                  : "0.0%"
              }
              subtitle={t("farmerDashboard.vsPreviousPeriod")}
              change={
                <ChangeIndicator
                  changePercent={marketHistory.changePercent}
                  label={t("farmerDashboard.vsPreviousPeriod")}
                />
              }
              data-testid="stat-change-7d"
            />

            {/* 3. Market Trend */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm" data-testid="stat-trend">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("marketPrices.trend")}
              </span>
              <div className="mt-2 flex items-center gap-2">
                {renderTrendBadge(marketHistory.trend)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedCropName} • {selectedDivision ? selectedDivision.toUpperCase() : "NATIONAL"}
              </p>
            </div>

            {/* 4. Min - Max Range */}
            <StatCard
              label={t("marketPrices.periodRange")}
              value={`${formatLocalizedPoisha(
                marketHistory.minPricePerKg,
                isBangla,
              )} – ${formatLocalizedPoisha(marketHistory.maxPricePerKg, isBangla)}`}
              subtitle={t("marketPrices.minMaxBand")}
              data-testid="stat-min-max-range"
            />
          </div>

          {/* Division vs National Comparison Card */}
          {selectedDivision && nationalHistory && (
            <div
              className={`rounded-xl border p-4 sm:p-5 shadow-sm ${
                priceDiffPoisha > 0
                  ? "border-emerald-200 bg-emerald-50/40 text-emerald-950"
                  : priceDiffPoisha < 0
                  ? "border-amber-200 bg-amber-50/40 text-amber-950"
                  : "border-stone-200 bg-stone-50 text-stone-900"
              }`}
              data-testid="division-vs-national-card"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold sm:text-base">
                    {t("marketPrices.divisionVsNational")}
                  </h2>
                  <p className="text-xs opacity-80">
                    {t("marketPrices.divisionVsNationalSubtitle")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold sm:text-xl">
                    {priceDiffPoisha > 0 ? "+" : ""}
                    {formatLocalizedPoisha(priceDiffPoisha, isBangla)} / kg
                    {priceDiffPercent !== null && (
                      <span className="ml-1 text-xs font-normal">
                        ({priceDiffPercent > 0 ? "+" : ""}
                        {isBangla
                          ? toBanglaDigits(priceDiffPercent.toFixed(1))
                          : priceDiffPercent.toFixed(1)}
                        %)
                      </span>
                    )}
                  </div>
                  <div className="text-xs opacity-90">
                    {priceDiffPoisha > 0
                      ? t("marketPrices.higherThanNational")
                      : priceDiffPoisha < 0
                      ? t("marketPrices.lowerThanNational")
                      : t("marketPrices.sameAsNational")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Price History Chart with Min to Max Band */}
          <PriceBandChart
            title={`${selectedCropName} ${t("marketPrices.title")}`}
            subtitle={
              selectedDivision
                ? `${
                    isBangla
                      ? BANGLADESH_DIVISIONS.find((d) => d.id === selectedDivision)?.nameBn
                      : BANGLADESH_DIVISIONS.find((d) => d.id === selectedDivision)?.nameEn
                  } • ${t(`farmerDashboard.range.${selectedRange}`)}`
                : `${t("marketPrices.allDivisionsNational")} • ${t(`farmerDashboard.range.${selectedRange}`)}`
            }
            data={marketHistory.series}
            emptyMessage={t("marketPrices.emptyHistory")}
            isBangla={isBangla}
            data-testid="farmer-price-band-chart"
          />

          {/* Grade Guide Section (what A, B, C are expected to fetch) */}
          {renderGradeGuide(marketHistory.gradeGuide)}
        </div>
      )}
    </main>
  );
}

export default FarmerMarketPricesPage;
