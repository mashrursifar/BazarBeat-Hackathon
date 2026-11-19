import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ListingStatus,
  type MarketplaceQuery,
  MarketplaceSort,
  marketplaceQuerySchema,
} from "@bazarbeat/shared";

import { CompareTray } from "../../components/shared/compare-tray.js";
import { DemoAiChip } from "../../components/shared/demo-ai-chip.js";
import { DemoModeBadge } from "../../components/demo-mode-badge.js";
import { LanguageSwitcher } from "../../components/language-switcher.js";
import { ListingCard } from "../../components/shared/listing-card.js";
import { useOptionalAuth } from "../auth/auth-context.js";
import { getCrops } from "../listings/api/listing-api.js";
import { getMarketplaceListings } from "./api/marketplace-api.js";
import {
  type FilterValues,
  MarketplaceFilterBar,
} from "./components/marketplace-filter-bar.js";
import { MarketplacePagination } from "./components/marketplace-pagination.js";
import { MarketplaceSortSelect } from "./components/marketplace-sort-select.js";
import { CompareTrayProvider } from "./context/compare-tray-context.js";

function ListingCardSkeleton(): ReactElement {
  return (
    <div
      data-testid="marketplace-skeleton"
      role="status"
      className="flex flex-col rounded-xl border border-stone-200 bg-white overflow-hidden animate-pulse shadow-xs"
    >
      <div className="aspect-[4/3] w-full bg-stone-200" />
      <div className="p-4 flex flex-col justify-between flex-1 gap-3">
        <div className="space-y-2">
          <div className="h-5 w-3/4 rounded bg-stone-200" />
          <div className="h-3 w-1/2 rounded bg-stone-100" />
        </div>
        <div className="space-y-2 pt-3 border-t border-stone-100">
          <div className="h-6 w-1/3 rounded bg-stone-200" />
          <div className="h-8 w-full rounded bg-stone-100" />
        </div>
      </div>
    </div>
  );
}

export function MarketplaceContent(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const isStandaloneMarket = location.pathname === "/market";
  const [searchParams, setSearchParams] = useSearchParams();

  // Validate URL search params against shared marketplaceQuerySchema
  const validatedQuery = useMemo<MarketplaceQuery>(() => {
    const raw: Record<string, unknown> = {};

    const crop = searchParams.get("crop");
    if (crop) raw.crop = crop;

    const grade = searchParams.get("grade");
    if (grade) raw.grade = grade;

    const division = searchParams.get("division");
    if (division) raw.division = division;

    const district = searchParams.get("district");
    if (district) raw.district = district;

    const minPrice = searchParams.get("minPrice");
    if (minPrice) raw.minPrice = minPrice;

    const maxPrice = searchParams.get("maxPrice");
    if (maxPrice) raw.maxPrice = maxPrice;

    const minQuantity = searchParams.get("minQuantity");
    if (minQuantity) raw.minQuantity = minQuantity;

    const endingWithin = searchParams.get("endingWithin");
    if (endingWithin) raw.endingWithin = endingWithin;

    const sort = searchParams.get("sort");
    if (sort) raw.sort = sort;

    const page = searchParams.get("page");
    if (page) raw.page = page;

    const limit = searchParams.get("limit");
    if (limit) raw.limit = limit;

    const parseResult = marketplaceQuerySchema.safeParse(raw);
    if (parseResult.success) {
      return parseResult.data;
    }

    return {
      sort: MarketplaceSort.ENDING_SOONEST,
      page: 1,
      limit: 20,
      status: ListingStatus.ACTIVE,
    };
  }, [searchParams]);

  // Fetch catalog crops for filter dropdown
  const { data: crops = [] } = useQuery({
    queryKey: ["crops"],
    queryFn: getCrops,
    staleTime: 5 * 60 * 1000,
  });

  // Query marketplace listings with 15s polling and keepPreviousData to prevent layout shift
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["marketplace-listings", validatedQuery],
    queryFn: () => getMarketplaceListings(validatedQuery),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });

  const listings = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const page = validatedQuery.page ?? 1;
  const limit = validatedQuery.limit ?? 20;

  // Sync filter changes to URL search params
  const handleFilterChange = (newFilters: FilterValues): void => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");

    if (newFilters.crop) params.set("crop", newFilters.crop);
    else params.delete("crop");

    if (newFilters.grade) params.set("grade", newFilters.grade);
    else params.delete("grade");

    if (newFilters.division) params.set("division", newFilters.division);
    else params.delete("division");

    if (newFilters.district) params.set("district", newFilters.district);
    else params.delete("district");

    if (newFilters.minPricePoisha !== undefined) {
      params.set("minPrice", newFilters.minPricePoisha.toString());
    } else {
      params.delete("minPrice");
    }

    if (newFilters.maxPricePoisha !== undefined) {
      params.set("maxPrice", newFilters.maxPricePoisha.toString());
    } else {
      params.delete("maxPrice");
    }

    if (newFilters.minQuantityKg !== undefined) {
      params.set("minQuantity", newFilters.minQuantityKg.toString());
    } else {
      params.delete("minQuantity");
    }

    if (newFilters.endingWithin !== undefined) {
      params.set("endingWithin", newFilters.endingWithin.toString());
    } else {
      params.delete("endingWithin");
    }

    if (newFilters.watchingOnly) {
      params.set("watchingOnly", "true");
    } else {
      params.delete("watchingOnly");
    }

    setSearchParams(params);
  };

  const handleClearFilters = (): void => {
    const params = new URLSearchParams();
    const currentSort = searchParams.get("sort");
    if (currentSort) params.set("sort", currentSort);
    setSearchParams(params);
  };

  const handleSortChange = (newSort: MarketplaceSort): void => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", newSort);
    params.delete("page");
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number): void => {
    const params = new URLSearchParams(searchParams);
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentFilters: FilterValues = useMemo(
    () => ({
      crop: validatedQuery.crop,
      grade: validatedQuery.grade,
      division: validatedQuery.division,
      district: validatedQuery.district,
      minPricePoisha: validatedQuery.minPrice,
      maxPricePoisha: validatedQuery.maxPrice,
      minQuantityKg: validatedQuery.minQuantity ?? validatedQuery.minQty,
      endingWithin: validatedQuery.endingWithin,
      watchingOnly: searchParams.get("watchingOnly") === "true",
    }),
    [validatedQuery, searchParams],
  );

  const displayedListings = useMemo(() => {
    if (currentFilters.watchingOnly) {
      return listings.filter((l) => Boolean(l.isWatched));
    }
    return listings;
  }, [listings, currentFilters.watchingOnly]);

  return (
    <main
      data-testid="marketplace-page"
      className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 pb-32 min-w-0"
    >
      {isStandaloneMarket && (
        <header className="border-b border-stone-200 bg-white/95 backdrop-blur-sm sticky top-0 z-20 -mx-4 -mt-6 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-base shadow-sm">
                B
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                {t("appName")}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <DemoModeBadge />
            <LanguageSwitcher />
            {user ? (
              <Link
                to={user.role === "FARMER" ? "/farmer/dashboard" : "/buyer/dashboard"}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {t("dashboard.title", "Dashboard")}
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-stone-300 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {t("landing.loginLink", "Log In")}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {t("login.createAccount", "Sign Up")}
                </Link>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
              {t("marketplace.title")}
            </h1>
            <DemoAiChip />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-stone-500 max-w-2xl">
            {t("marketplace.subtitle")}
          </p>
        </div>

        {/* Polling indicator subtle status */}
        {isFetching && !isLoading && (
          <div
            data-testid="marketplace-refreshing-indicator"
            aria-hidden="true"
            className="flex items-center gap-1.5 text-xs text-stone-400 self-start sm:self-auto"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">{t("realtime.live")}</span>
          </div>
        )}
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="mt-6 flex flex-col gap-4">
        <MarketplaceFilterBar
          filters={currentFilters}
          availableCrops={crops}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs font-semibold text-stone-600" data-testid="results-count">
            {t("marketplace.resultsCount_other", { count: total })}
          </p>
          <MarketplaceSortSelect
            value={validatedQuery.sort ?? MarketplaceSort.ENDING_SOONEST}
            onChange={handleSortChange}
          />
        </div>
      </div>

      {/* Content Section: Loading, Error, Empty, or Listings Grid */}
      <div className="mt-6 min-h-[20rem]">
        {isLoading ? (
          <div
            data-testid="marketplace-loading-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {Array.from({ length: 8 }).map((_, idx) => (
              <ListingCardSkeleton key={idx} />
            ))}
          </div>
        ) : isError ? (
          <div
            data-testid="marketplace-error-state"
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-8 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-red-900">
              {t("marketplace.errorTitle")}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-red-700 max-w-md mx-auto">
              {t("marketplace.errorSubtitle")}
            </p>
            <button
              type="button"
              data-testid="marketplace-retry-button"
              onClick={() => void refetch()}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-red-900 shadow-2xs hover:bg-red-50 cursor-pointer"
            >
              {t("marketplace.retry")}
            </button>
          </div>
        ) : displayedListings.length === 0 ? (
          <div
            data-testid="marketplace-empty-state"
            className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-10 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-stone-900">
              {t("marketplace.emptyTitle")}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-stone-500 max-w-sm mx-auto">
              {t("marketplace.emptySubtitle")}
            </p>
            <button
              type="button"
              data-testid="marketplace-empty-clear-button"
              onClick={handleClearFilters}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-2xs hover:bg-primary/90 cursor-pointer"
            >
              {t("marketplace.clearFilters")}
            </button>
          </div>
        ) : (
          <>
            <div
              data-testid="marketplace-listings-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {displayedListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            <MarketplacePagination
              page={page}
              total={total}
              limit={limit}
              onPageChange={handlePageChange}
              className="mt-8"
            />
          </>
        )}
      </div>

      {/* Compare Tray Sticky Bar */}
      <CompareTray />
    </main>
  );
}

export default function MarketplacePage(): ReactElement {
  return (
    <CompareTrayProvider>
      <MarketplaceContent />
    </CompareTrayProvider>
  );
}
