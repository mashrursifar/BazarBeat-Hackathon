import {
  type ChangeEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  BANGLADESH_DISTRICTS,
  BANGLADESH_DIVISIONS,
  CropGrade,
  ENDING_WITHIN_HOURS_PRESETS,
} from "@bazarbeat/shared";

import { cn } from "../../../lib/utils.js";

export interface FilterValues {
  crop?: string;
  grade?: CropGrade;
  division?: string;
  district?: string;
  minPricePoisha?: number;
  maxPricePoisha?: number;
  minQuantityKg?: number;
  endingWithin?: number;
  watchingOnly?: boolean;
}

export interface MarketplaceFilterBarProps {
  filters: FilterValues;
  availableCrops?: Array<{ id: string; slug: string; nameEn: string; nameBn: string }>;
  onFilterChange: (newFilters: FilterValues) => void;
  onClearFilters: () => void;
  className?: string;
}

export function MarketplaceFilterBar({
  filters,
  availableCrops = [],
  onFilterChange,
  onClearFilters,
  className,
}: MarketplaceFilterBarProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Filter districts based on selected division
  const availableDistricts = useMemo(() => {
    if (!filters.division) return [];
    const div = BANGLADESH_DIVISIONS.find(
      (d) =>
        d.id.toLowerCase() === filters.division?.toLowerCase() ||
        d.nameEn.toLowerCase() === filters.division?.toLowerCase(),
    );
    if (!div) return [];
    return BANGLADESH_DISTRICTS.filter((d) => d.divisionId === div.id);
  }, [filters.division]);

  // When division changes, ensure district belongs to division
  const handleDivisionChange = (divisionValue: string): void => {
    if (!divisionValue) {
      onFilterChange({ ...filters, division: undefined, district: undefined });
      return;
    }
    const div = BANGLADESH_DIVISIONS.find(
      (d) =>
        d.id.toLowerCase() === divisionValue.toLowerCase() ||
        d.nameEn.toLowerCase() === divisionValue.toLowerCase(),
    );
    const isValidDistrict =
      filters.district &&
      BANGLADESH_DISTRICTS.some(
        (dist) =>
          (dist.id.toLowerCase() === filters.district?.toLowerCase() ||
            dist.nameEn.toLowerCase() === filters.district?.toLowerCase()) &&
          dist.divisionId === div?.id,
      );

    onFilterChange({
      ...filters,
      division: divisionValue,
      district: isValidDistrict ? filters.district : undefined,
    });
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.crop) count++;
    if (filters.grade) count++;
    if (filters.division) count++;
    if (filters.district) count++;
    if (filters.minPricePoisha !== undefined) count++;
    if (filters.maxPricePoisha !== undefined) count++;
    if (filters.minQuantityKg !== undefined) count++;
    if (filters.endingWithin !== undefined) count++;
    if (filters.watchingOnly) count++;
    return count;
  }, [filters]);

  // Lock background scroll and handle Escape key when mobile bottom sheet is open
  useEffect(() => {
    if (mobileSheetOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
          setMobileSheetOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return (): void => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileSheetOpen]);

  const renderFilterInputs = (isMobile = false): ReactElement => (
    <div
      className={cn(
        isMobile
          ? "flex flex-col gap-4 py-2"
          : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end",
      )}
    >
      {/* Crop Filter */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={isMobile ? "mobile-filter-crop" : "desktop-filter-crop"}
          className="text-xs font-semibold text-stone-600"
        >
          {t("marketplace.crop")}
        </label>
        <select
          id={isMobile ? "mobile-filter-crop" : "desktop-filter-crop"}
          data-testid="filter-crop-select"
          value={filters.crop ?? ""}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void =>
            onFilterChange({ ...filters, crop: e.target.value || undefined })
          }
          className="h-10 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
        >
          <option value="">{t("marketplace.allCrops")}</option>
          {availableCrops.map((c) => {
            const label = isBangla && c.nameBn ? c.nameBn : c.nameEn;
            return (
              <option key={c.id} value={c.slug}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      {/* Grade Filter */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={isMobile ? "mobile-filter-grade" : "desktop-filter-grade"}
          className="text-xs font-semibold text-stone-600"
        >
          {t("marketplace.grade")}
        </label>
        <select
          id={isMobile ? "mobile-filter-grade" : "desktop-filter-grade"}
          data-testid="filter-grade-select"
          value={filters.grade ?? ""}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange({
              ...filters,
              grade: (e.target.value as CropGrade) || undefined,
            })
          }
          className="h-10 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
        >
          <option value="">{t("marketplace.allGrades")}</option>
          <option value={CropGrade.A}>Grade A</option>
          <option value={CropGrade.B}>Grade B</option>
          <option value={CropGrade.C}>Grade C</option>
        </select>
      </div>

      {/* Division Filter */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={isMobile ? "mobile-filter-division" : "desktop-filter-division"}
          className="text-xs font-semibold text-stone-600"
        >
          {t("marketplace.division")}
        </label>
        <select
          id={isMobile ? "mobile-filter-division" : "desktop-filter-division"}
          data-testid="filter-division-select"
          value={filters.division ?? ""}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            handleDivisionChange(e.target.value)
          }
          className="h-10 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
        >
          <option value="">{t("marketplace.allDivisions")}</option>
          {BANGLADESH_DIVISIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {isBangla ? d.nameBn : d.nameEn}
            </option>
          ))}
        </select>
      </div>

      {/* District Filter */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={isMobile ? "mobile-filter-district" : "desktop-filter-district"}
          className="text-xs font-semibold text-stone-600"
        >
          {t("marketplace.district")}
        </label>
        <select
          id={isMobile ? "mobile-filter-district" : "desktop-filter-district"}
          data-testid="filter-district-select"
          value={filters.district ?? ""}
          disabled={!filters.division}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange({ ...filters, district: e.target.value || undefined })
          }
          className="h-10 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-stone-100 min-h-[44px]"
        >
          <option value="">
            {filters.division
              ? t("marketplace.allDistricts")
              : t("marketplace.selectDivisionFirst")}
          </option>
          {availableDistricts.map((d) => (
            <option key={d.id} value={d.id}>
              {isBangla ? d.nameBn : d.nameEn}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range Filter (in BDT ৳/kg, converted to poisha) */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={isMobile ? "mobile-filter-min-price" : "desktop-filter-min-price"}
          className="text-xs font-semibold text-stone-600"
        >
          {t("marketplace.priceRange")}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={isMobile ? "mobile-filter-min-price" : "desktop-filter-min-price"}
            aria-label={t("marketplace.minPrice")}
            type="number"
            data-testid="filter-min-price-input"
            min={0}
            placeholder={t("marketplace.minPrice")}
            value={
              filters.minPricePoisha !== undefined
                ? Math.floor(filters.minPricePoisha / 100)
                : ""
            }
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onFilterChange({
                ...filters,
                minPricePoisha: val !== undefined ? val * 100 : undefined,
              });
            }}
            className="w-full h-10 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
          />
          <span className="text-stone-400 text-xs">-</span>
          <input
            id={isMobile ? "mobile-filter-max-price" : "desktop-filter-max-price"}
            aria-label={t("marketplace.maxPrice")}
            type="number"
            data-testid="filter-max-price-input"
            min={0}
            placeholder={t("marketplace.maxPrice")}
            value={
              filters.maxPricePoisha !== undefined
                ? Math.floor(filters.maxPricePoisha / 100)
                : ""
            }
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onFilterChange({
                ...filters,
                maxPricePoisha: val !== undefined ? val * 100 : undefined,
              });
            }}
            className="w-full h-10 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
          />
        </div>
      </div>

      {/* Ending Within Filter */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={isMobile ? "mobile-filter-ending" : "desktop-filter-ending"}
          className="text-xs font-semibold text-stone-600"
        >
          {t("marketplace.endingWithin")}
        </label>
        <select
          id={isMobile ? "mobile-filter-ending" : "desktop-filter-ending"}
          data-testid="filter-ending-within-select"
          value={filters.endingWithin ?? ""}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            const val = e.target.value ? Number(e.target.value) : undefined;
            onFilterChange({ ...filters, endingWithin: val });
          }}
          className="h-10 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
        >
          <option value="">{t("marketplace.anyTime")}</option>
          {ENDING_WITHIN_HOURS_PRESETS.map((hours) => (
            <option key={hours} value={hours}>
              {t(`marketplace.hours${hours}` as const, { defaultValue: `${hours}h` })}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: Filter Trigger Button */}
      <div className="flex items-center justify-between md:hidden gap-2">
        <button
          type="button"
          data-testid="mobile-filter-button"
          onClick={() => setMobileSheetOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-2xs hover:bg-stone-50"
        >
          <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span>{t("marketplace.searchFilters")}</span>
          {activeFilterCount > 0 && (
            <span
              data-testid="mobile-filter-badge"
              className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white"
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            data-testid="filter-clear-all-mobile"
            onClick={onClearFilters}
            className="text-xs font-semibold text-stone-500 hover:text-stone-900 min-h-[44px] px-2 underline decoration-dotted"
          >
            {t("marketplace.clearFilters")}
          </button>
        )}

        <button
          type="button"
          data-testid="filter-chip-watching-mobile"
          onClick={() =>
            onFilterChange({
              ...filters,
              watchingOnly: !filters.watchingOnly,
            })
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border min-h-[44px] transition-colors select-none",
            filters.watchingOnly
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
          )}
        >
          <svg
            className={cn(
              "h-3.5 w-3.5",
              filters.watchingOnly ? "fill-red-500 stroke-red-500" : "fill-none stroke-current stroke-2",
            )}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          <span>{t("watchlist.watchingChip", "Watching")}</span>
        </button>
      </div>

      {/* Desktop: Inline Filter Bar */}
      <div className="hidden md:block rounded-xl border border-stone-200 bg-stone-50/70 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-stone-900">
              {t("marketplace.searchFilters")}
            </h2>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {t("marketplace.filterCount", { count: activeFilterCount })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="filter-chip-watching"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  watchingOnly: !filters.watchingOnly,
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors cursor-pointer select-none",
                filters.watchingOnly
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
              )}
            >
              <svg
                className={cn(
                  "h-3.5 w-3.5",
                  filters.watchingOnly ? "fill-red-500 stroke-red-500" : "fill-none stroke-current stroke-2",
                )}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
              <span>{t("watchlist.watchingChip", "Watching")}</span>
            </button>
            {activeFilterCount > 0 && (
              <button
                type="button"
                data-testid="filter-clear-all-desktop"
                onClick={onClearFilters}
                className="text-xs font-semibold text-stone-500 hover:text-stone-900 underline decoration-dotted cursor-pointer"
              >
                {t("marketplace.clearFilters")}
              </button>
            )}
          </div>
        </div>
        {renderFilterInputs(false)}
      </div>

      {/* Mobile: Bottom Sheet Modal */}
      {mobileSheetOpen && (
        <div
          data-testid="mobile-filter-sheet"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMobileSheetOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs md:hidden"
        >
          <div
            className="w-full rounded-t-2xl bg-white p-5 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-heading"
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 id="mobile-filter-heading" className="text-base font-bold text-stone-900">
                  {t("marketplace.searchFilters")}
                </h3>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="mobile-filter-close"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Close filters"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Sheet Content */}
            <div className="overflow-y-auto py-2 flex-1 scrollbar-thin">
              {renderFilterInputs(true)}
            </div>

            {/* Sheet Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
              <button
                type="button"
                data-testid="mobile-filter-clear"
                onClick={() => {
                  onClearFilters();
                }}
                className="min-h-[44px] px-3 text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                {t("marketplace.clearFilters")}
              </button>
              <button
                type="button"
                data-testid="mobile-filter-apply"
                onClick={() => setMobileSheetOpen(false)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-primary/90"
              >
                {t("marketplace.applyFilters")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
