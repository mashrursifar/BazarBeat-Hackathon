import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  type CompareListing,
  ListingStatus,
  calculateSubtotal,
  formatPoisha,
} from "@bazarbeat/shared";

import { CompareTrayProvider, useCompareTray } from "./context/compare-tray-context.js";
import { getCompareListings } from "./api/marketplace-api.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { PriceTag } from "../../components/shared/price-tag.js";
import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { ErrorState } from "../../components/shared/data-states.js";
import { cn } from "../../lib/utils.js";

function ComparePageContent(): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    items: trayItems,
    selectedIds: traySelectedIds,
    removeItem,
    clearTray,
  } = useCompareTray();

  // Parse any IDs passed via URL query params
  const urlIds = useMemo(() => {
    const raw = searchParams.get("ids");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);

  // Derive effective IDs: prioritize tray, fallback to URL search params
  const effectiveIds = useMemo(() => {
    if (traySelectedIds.length > 0) return traySelectedIds;
    return urlIds;
  }, [traySelectedIds, urlIds]);

  // Handle removing a listing from tray and URL
  const handleRemove = (id: string): void => {
    removeItem(id);
    const currentUrlIds =
      searchParams.get("ids")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    const remaining = currentUrlIds.filter((item) => item !== id);
    if (remaining.length > 0) {
      setSearchParams({ ids: remaining.join(",") }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Poll GET /listings/compare every 10 seconds when at least 2 IDs are selected
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["compare-listings", effectiveIds],
    queryFn: () => getCompareListings(effectiveIds),
    enabled: effectiveIds.length >= 2,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });

  // Empty state: tray has no items and URL has no IDs
  if (effectiveIds.length === 0) {
    return (
      <main
        data-testid="compare-empty-state"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-600">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold text-stone-900">
            {t("compare.emptyTitle", "Your compare tray is empty")}
          </h1>
          <p className="mt-2 text-sm text-stone-600 max-w-md mx-auto">
            {t(
              "compare.emptySubtitle",
              "Add produce listings from the marketplace to compare them side by side.",
            )}
          </p>
          <div className="mt-6">
            <Link
              to="/buyer/marketplace"
              data-testid="compare-empty-marketplace-link"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors"
            >
              {t("compare.goToMarketplace", "Explore Marketplace")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Handle single listing scenario (less than 2 items to compare)
  if (effectiveIds.length === 1) {
    const singleListing = trayItems.find((item) => item.id === effectiveIds[0]);
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div
          role="status"
          data-testid="compare-min-items-notice"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-sm font-bold">
              {t("compare.minItemsTitle", "Select at least 2 listings to compare")}
            </h2>
            <p className="text-xs text-amber-800 mt-0.5">
              {t("compare.minItemsNotice", { count: 1 })}
            </p>
          </div>
          <Link
            to="/buyer/marketplace"
            data-testid="compare-add-more-link"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shrink-0"
          >
            {t("compare.goToMarketplace", "Explore Marketplace")}
          </Link>
        </div>

        {singleListing && (
          <div className="max-w-sm rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="aspect-video w-full overflow-hidden rounded-md bg-stone-100">
              <img
                src={
                  singleListing.thumbnailUrl ??
                  singleListing.images?.[0]?.url ??
                  "/placeholder-crop.png"
                }
                alt={singleListing.crop.nameEn}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">
                {isBangla && singleListing.crop.nameBn
                  ? singleListing.crop.nameBn
                  : singleListing.crop.nameEn}
              </h3>
              <GradeBadge grade={singleListing.grade} size="sm" />
            </div>
            <p className="mt-1 text-sm text-stone-600">
              {singleListing.quantityKg.toLocaleString()} kg ·{" "}
              {formatPoisha(singleListing.displayPricePerKg)}/kg
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                to={`/buyer/listings/${singleListing.id}`}
                data-testid={`compare-bid-now-${singleListing.id}`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
              >
                {t("compare.bidNow", "Bid now")}
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(singleListing.id)}
                data-testid={`compare-remove-${singleListing.id}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-red-600"
              >
                {t("compare.remove", "Remove")}
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // Handle errors
  if (isError) {
    const isMixedCrops =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "COMPARE_MIXED_CROPS";

    if (isMixedCrops) {
      return (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div
            role="alert"
            data-testid="compare-mixed-crops-error"
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 shadow-xs"
          >
            <h2 className="text-base font-bold text-red-950">
              {t("compare.mixedCropsError", "All listings in compare must belong to the same crop.")}
            </h2>
            <p className="mt-2 text-sm text-red-800">
              {t(
                "marketplace.compareCropMismatch",
                "Compare is limited to listings of the same crop.",
              )}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                data-testid="compare-clear-tray-btn"
                onClick={clearTray}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                {t("marketplace.compareTray.clearAll", "Clear all")}
              </button>
              <Link
                to="/buyer/marketplace"
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-50"
              >
                {t("compare.goToMarketplace", "Explore Marketplace")}
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ErrorState onRetry={() => void refetch()} />
      </main>
    );
  }

  // Loading state
  if (isLoading && !data) {
    return (
      <main
        role="status"
        aria-label={t("auth.loading")}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-stone-200" />
          <div className="h-4 w-72 rounded bg-stone-200" />
          <div className="mt-6 h-96 w-full rounded-lg bg-stone-200" />
        </div>
      </main>
    );
  }

  const listings: CompareListing[] = data?.data?.listings ?? [];
  const highlights = data?.data?.highlights;
  const missingIds: string[] = data?.data?.missingIds ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
            {t("compare.title", "Compare Produce")}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {t(
              "compare.subtitle",
              "Compare quality, prices, and auction end times side by side.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isFetching && (
            <span
              role="status"
              aria-label="Updating"
              className="text-xs text-stone-500 font-medium animate-pulse"
            >
              {t("realtime.live", "Live")} •
            </span>
          )}
          <Link
            to="/buyer/marketplace"
            className="text-xs font-semibold text-primary hover:underline min-h-[44px] inline-flex items-center"
          >
            ← {t("compare.goToMarketplace", "Explore Marketplace")}
          </Link>
        </div>
      </div>

      {/* Missing listings notice if any */}
      {missingIds.length > 0 && (
        <div
          role="status"
          data-testid="compare-missing-notice"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm font-semibold">
              {t(
                "compare.missingNotice",
                "Some listings in your compare tray are no longer available.",
              )}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              {missingIds.length} {missingIds.length === 1 ? "listing" : "listings"} removed or
              inaccessible.
            </p>
          </div>
          <button
            type="button"
            data-testid="remove-missing-listings-btn"
            onClick={() => missingIds.forEach((id) => handleRemove(id))}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 shrink-0"
          >
            {t("compare.removeUnavailable", "Remove unavailable")}
          </button>
        </div>
      )}

      {/* Desktop & Mobile Scrollable Table Container */}
      <div
        data-testid="compare-table-container"
        className="w-full overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-xs"
      >
        <table
          data-testid="compare-table"
          className="w-full border-collapse text-left text-sm"
        >
          <caption className="sr-only">{t("compare.title", "Compare Produce")}</caption>
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/80">
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[130px] sm:min-w-[160px] bg-stone-50 p-3 sm:p-4 text-xs font-bold uppercase tracking-wider text-stone-600 border-r border-stone-200"
              >
                {t("compare.rowAttributes", "Attribute")}
              </th>
              {listings.map((listing) => (
                <th
                  key={listing.id}
                  scope="col"
                  data-testid={`compare-header-${listing.id}`}
                  className="min-w-[200px] sm:min-w-[240px] max-w-[280px] p-3 sm:p-4 text-center font-bold text-stone-900 border-r border-stone-100 last:border-r-0"
                >
                  <span className="line-clamp-1">
                    {isBangla ? listing.cropNameBn : listing.cropNameEn}
                  </span>
                </th>
              ))}
              {missingIds.map((missingId) => (
                <th
                  key={missingId}
                  scope="col"
                  data-testid={`compare-missing-header-${missingId}`}
                  className="min-w-[200px] sm:min-w-[240px] max-w-[280px] p-3 sm:p-4 text-center font-bold text-stone-500 bg-stone-50/50 border-r border-stone-100 last:border-r-0"
                >
                  {t("compare.unavailable", "Unavailable")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {/* ROW 1: PHOTO */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowPhoto", "Photo")}
              </th>
              {listings.map((listing) => {
                const photoUrl =
                  listing.thumbnailUrl ?? listing.images?.[0]?.url ?? "/placeholder-crop.png";
                const cropName = isBangla ? listing.cropNameBn : listing.cropNameEn;
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-photo-${listing.id}`}
                    className="p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0"
                  >
                    <div className="mx-auto h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-2xs">
                      <img
                        src={photoUrl}
                        alt={`${cropName} Grade ${listing.grade}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  data-testid={`compare-missing-cell-photo-${missingId}`}
                  className="p-3 sm:p-4 text-center align-middle bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  <div className="mx-auto flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-100 text-stone-400 text-xs">
                    {t("compare.unavailable", "Unavailable")}
                  </div>
                </td>
              ))}
            </tr>

            {/* ROW 2: CROP */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowCrop", "Crop")}
              </th>
              {listings.map((listing) => {
                const cropName = isBangla ? listing.cropNameBn : listing.cropNameEn;
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-crop-${listing.id}`}
                    className="p-3 sm:p-4 text-center align-middle font-medium text-stone-900 border-r border-stone-100 last:border-r-0"
                  >
                    {cropName}
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 3: GRADE (highlighted via isBestGrade) */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowGrade", "Quality Grade")}
              </th>
              {listings.map((listing) => {
                const isBestGrade = Boolean(
                  listing.highlights?.isBestGrade ??
                    highlights?.byListingId?.[listing.id]?.isBestGrade,
                );
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-grade-${listing.id}`}
                    data-highlighted={isBestGrade ? "true" : "false"}
                    className={cn(
                      "p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0 transition-colors",
                      isBestGrade
                        ? "bg-emerald-50/80 font-semibold ring-1 ring-inset ring-emerald-300"
                        : "bg-white",
                    )}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <GradeBadge grade={listing.grade} size="sm" />
                      {isBestGrade && (
                        <span
                          data-testid={`badge-best-grade-${listing.id}`}
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
                        >
                          {t("compare.bestGrade", "Best grade")}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 4: QUANTITY (highlighted via isLargestQuantity) */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowQuantity", "Quantity")}
              </th>
              {listings.map((listing) => {
                const isLargestQuantity = Boolean(
                  listing.highlights?.isLargestQuantity ??
                    highlights?.byListingId?.[listing.id]?.isLargestQuantity,
                );
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-quantity-${listing.id}`}
                    data-highlighted={isLargestQuantity ? "true" : "false"}
                    className={cn(
                      "p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0 transition-colors",
                      isLargestQuantity
                        ? "bg-emerald-50/80 font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300"
                        : "bg-white text-stone-900",
                    )}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="font-semibold text-sm sm:text-base">
                        {listing.quantityKg.toLocaleString()} kg
                      </span>
                      {isLargestQuantity && (
                        <span
                          data-testid={`badge-largest-quantity-${listing.id}`}
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
                        >
                          {t("compare.largestQuantity", "Largest quantity")}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 5: PRICE PER KG (highlighted via isLowestPrice) */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowPricePerKg", "Price per kg")}
              </th>
              {listings.map((listing) => {
                const isLowestPrice = Boolean(
                  listing.highlights?.isLowestPrice ??
                    highlights?.byListingId?.[listing.id]?.isLowestPrice,
                );
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-price-${listing.id}`}
                    data-highlighted={isLowestPrice ? "true" : "false"}
                    className={cn(
                      "p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0 transition-colors",
                      isLowestPrice
                        ? "bg-emerald-50/80 font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300"
                        : "bg-white text-stone-900",
                    )}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <PriceTag amountPoisha={listing.displayPricePerKg} size="md" />
                      {isLowestPrice && (
                        <span
                          data-testid={`badge-lowest-price-${listing.id}`}
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
                        >
                          {t("compare.lowestPrice", "Lowest price")}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 6: TOTAL COST */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowTotalCost", "Total Cost")}
              </th>
              {listings.map((listing) => {
                const totalCost =
                  listing.displayTotalCost ??
                  listing.totalDisplayCost ??
                  calculateSubtotal(listing.displayPricePerKg, listing.quantityKg);
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-total-cost-${listing.id}`}
                    className="p-3 sm:p-4 text-center align-middle font-bold text-stone-900 border-r border-stone-100 last:border-r-0"
                  >
                    {formatPoisha(totalCost)}
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 7: VS AI MARKET (%) (highlighted via isBestValue) */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowVsAi", "vs AI Market (%)")}
              </th>
              {listings.map((listing) => {
                const isBestValue = Boolean(
                  listing.highlights?.isBestValue ??
                    highlights?.byListingId?.[listing.id]?.isBestValue,
                );
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-vs-ai-${listing.id}`}
                    data-highlighted={isBestValue ? "true" : "false"}
                    className={cn(
                      "p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0 transition-colors",
                      isBestValue
                        ? "bg-emerald-50/80 font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300"
                        : "bg-white text-stone-900",
                    )}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="font-semibold text-sm sm:text-base">
                        {listing.percentageVsAiExpected != null
                          ? `${listing.percentageVsAiExpected}%`
                          : "—"}
                      </span>
                      {isBestValue && (
                        <span
                          data-testid={`badge-best-value-${listing.id}`}
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
                        >
                          {t("compare.bestValue", "Best value")}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 8: REGION */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowRegion", "Region")}
              </th>
              {listings.map((listing) => {
                const region =
                  listing.farmerRegion ||
                  listing.location?.division ||
                  "—";
                const district = listing.location?.district;
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-region-${listing.id}`}
                    className="p-3 sm:p-4 text-center align-middle text-stone-700 text-sm border-r border-stone-100 last:border-r-0"
                  >
                    {district ? `${district}, ` : ""}
                    {region}
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0"
                >
                  —
                </td>
              ))}
            </tr>

            {/* ROW 9: TIME LEFT (COUNTDOWN) */}
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50/95 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowTimeLeft", "Time Left")}
              </th>
              {listings.map((listing) => {
                const isEnded = listing.status !== ListingStatus.ACTIVE;
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-time-left-${listing.id}`}
                    className="p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0"
                  >
                    {isEnded ? (
                      <span
                        data-testid={`ended-badge-${listing.id}`}
                        className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 border border-stone-200"
                      >
                        {t("countdown.ended", "Auction ended")}
                      </span>
                    ) : (
                      <div className="flex justify-center">
                        <CountdownTimer
                          endsAt={listing.endsAt}
                          status={listing.status}
                          size="sm"
                        />
                      </div>
                    )}
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  className="p-3 sm:p-4 text-center align-middle text-stone-400 bg-stone-50/30 border-r border-stone-100 last:border-r-0 text-xs font-medium"
                >
                  {t("compare.unavailable", "Unavailable")}
                </td>
              ))}
            </tr>

            {/* ROW 10: ACTIONS (Bid now & Remove) */}
            <tr className="bg-stone-50/50">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-stone-50 p-3 sm:p-4 font-semibold text-stone-700 border-r border-stone-200 text-xs sm:text-sm whitespace-nowrap"
              >
                {t("compare.rowActions", "Actions")}
              </th>
              {listings.map((listing) => {
                const isEnded = listing.status !== ListingStatus.ACTIVE;
                return (
                  <td
                    key={listing.id}
                    data-testid={`compare-cell-actions-${listing.id}`}
                    className="p-3 sm:p-4 text-center align-middle border-r border-stone-100 last:border-r-0"
                  >
                    <div className="flex flex-col gap-2">
                      <Link
                        to={`/buyer/listings/${listing.id}`}
                        data-testid={`compare-bid-now-${listing.id}`}
                        aria-disabled={isEnded}
                        className={cn(
                          "inline-flex min-h-[44px] items-center justify-center rounded-md px-3 py-2 text-xs font-semibold shadow-xs transition-colors",
                          isEnded
                            ? "border border-stone-300 bg-stone-100 text-stone-600 hover:bg-stone-200"
                            : "bg-primary text-white hover:bg-primary/90",
                        )}
                      >
                        {t("compare.bidNow", "Bid now")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemove(listing.id)}
                        data-testid={`compare-remove-${listing.id}`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:text-red-600 transition-colors"
                      >
                        {t("compare.remove", "Remove")}
                      </button>
                    </div>
                  </td>
                );
              })}
              {missingIds.map((missingId) => (
                <td
                  key={missingId}
                  data-testid={`compare-missing-cell-actions-${missingId}`}
                  className="p-3 sm:p-4 text-center align-middle bg-stone-50/50 border-r border-stone-100 last:border-r-0"
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-stone-400 py-2">
                      {t("compare.listingUnavailable", "Listing unavailable")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(missingId)}
                      data-testid={`compare-remove-${missingId}`}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:text-red-600 transition-colors"
                    >
                      {t("compare.remove", "Remove")}
                    </button>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}

export function ComparePage(): ReactElement {
  return (
    <CompareTrayProvider>
      <ComparePageContent />
    </CompareTrayProvider>
  );
}

export default ComparePage;
