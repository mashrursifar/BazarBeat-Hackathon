import { type ReactElement, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type BuyerListingCard,
  ListingStatus,
  formatDisplayPrice,
} from "@bazarbeat/shared";

import { GradeBadge } from "../../components/shared/grade-badge.js";
import { ListingCard } from "../../components/shared/listing-card.js";
import { formatLocalizedNumber } from "../../lib/format.js";
import { cn } from "../../lib/utils.js";
import { WatchlistButton } from "./components/watchlist-button.js";

function WatchlistCardSkeleton(): ReactElement {
  return (
    <div
      data-testid="watchlist-skeleton"
      className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-xs animate-pulse space-y-3"
    >
      <div className="aspect-[4/3] w-full rounded-lg bg-stone-200" />
      <div className="h-4 w-3/4 rounded bg-stone-200" />
      <div className="h-3 w-1/2 rounded bg-stone-200" />
      <div className="h-6 w-1/3 rounded bg-stone-200" />
    </div>
  );
}

export function EndedWatchlistCard({
  listing,
  onRemove,
}: {
  listing: BuyerListingCard;
  onRemove?: () => void;
}): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const imageUrl = listing.thumbnailUrl ?? listing.images?.[0]?.url;
  const cropName = isBangla && listing.crop.nameBn ? listing.crop.nameBn : listing.crop.nameEn;
  const secondaryName = isBangla ? listing.crop.nameEn : listing.crop.nameBn;

  const isSold = listing.status === ListingStatus.SOLD;
  const isExpired = listing.status === ListingStatus.EXPIRED_UNSOLD;

  const statusLabel = isSold
    ? t("watchlist.endedSold", {
        price: formatDisplayPrice(listing.currentBidPerKg ?? listing.displayPricePerKg),
        defaultValue: `Sold for ${formatDisplayPrice(listing.currentBidPerKg ?? listing.displayPricePerKg)} / kg`,
      })
    : isExpired
      ? t("watchlist.endedUnsold", "Ended without sale")
      : t("watchlist.endedCancelled", "Cancelled");

  const badgeBg = isSold
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : isExpired
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-stone-100 text-stone-700 border-stone-200";

  return (
    <article
      data-testid="ended-watchlist-card"
      className="flex flex-col rounded-xl border border-stone-200 bg-white shadow-xs overflow-hidden transition-shadow hover:shadow-md h-full"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={cropName}
            loading="lazy"
            className="h-full w-full object-cover grayscale opacity-80"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
            <svg
              className="h-10 w-10 opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5">
          <GradeBadge grade={listing.grade} size="sm" />
        </div>
        <div className="absolute top-2.5 right-2.5 z-10">
          <WatchlistButton
            listingId={listing.id}
            initialIsWatched={true}
            onWatchlistChanged={(watched) => {
              if (!watched) onRemove?.();
            }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-stone-900 truncate">{cropName}</h3>
            {secondaryName && (
              <p className="text-xs text-stone-400 truncate leading-tight">
                {secondaryName}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
            {formatLocalizedNumber(listing.quantityKg, isBangla)} kg
          </span>
        </div>

        <div className="border-t border-stone-100 pt-2">
          <div
            data-testid="ended-status-badge"
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
              badgeBg,
            )}
          >
            {statusLabel}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3">
          <Link
            to={`/buyer/listings/${listing.id}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {t("watchlist.viewDetails", "View Details")} →
          </Link>

          <button
            type="button"
            data-testid={`remove-watchlist-${listing.id}`}
            onClick={onRemove}
            className="text-xs font-medium text-stone-500 hover:text-red-600 transition-colors"
          >
            {t("watchlist.remove", "Remove")}
          </button>
        </div>
      </div>
    </article>
  );
}

export function WatchlistPage(): ReactElement {
  const { t } = useTranslation();
  const [items, setItems] = useState<BuyerListingCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/watchlist", {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load watchlist");
      }
      const json = await response.json();
      setItems(json.data ?? []);
    } catch {
      setError(t("watchlist.error", "Failed to load watchlist"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchWatchlist();
  }, [fetchWatchlist]);

  const handleRemove = (listingId: string): void => {
    setItems((prev) => prev.filter((item) => item.id !== listingId));
  };

  return (
    <div data-testid="watchlist-page" className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1
          data-testid="watchlist-page-title"
          className="text-2xl sm:text-3xl font-extrabold text-foreground"
        >
          {t("watchlist.title", "Watchlist")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "watchlist.subtitle",
            "Track saved auctions and monitor auctions ending soon.",
          )}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <WatchlistCardSkeleton key={idx} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 sm:p-6 text-center space-y-3"
        >
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            type="button"
            data-testid="watchlist-retry-btn"
            onClick={() => void fetchWatchlist()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {t("watchlist.retry", "Retry")}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div
          data-testid="watchlist-empty-state"
          className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-8 sm:p-12 text-center space-y-4 max-w-lg mx-auto my-8"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            <svg
              className="h-8 w-8 text-stone-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {t("watchlist.emptyTitle", "Your watchlist is empty")}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {t(
                "watchlist.emptyDescription",
                "Save active listings from the marketplace to keep track of auctions ending soon.",
              )}
            </p>
          </div>
          <Link
            to="/buyer/marketplace"
            data-testid="browse-marketplace-link"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {t("watchlist.browseMarketplace", "Browse Marketplace")}
          </Link>
        </div>
      )}

      {/* Populated Grid */}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {items.map((listing) => {
            const isActive = listing.status === ListingStatus.ACTIVE;
            if (isActive) {
              return (
                <ListingCard
                  key={listing.id}
                  listing={{ ...listing, isWatched: true }}
                />
              );
            }
            return (
              <EndedWatchlistCard
                key={listing.id}
                listing={listing}
                onRemove={() => handleRemove(listing.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
