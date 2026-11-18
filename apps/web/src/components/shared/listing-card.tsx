import {
  type ReactElement,
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { type BuyerListingCard } from "@bazarbeat/shared";

import { useCompareTray } from "../../features/marketplace/context/compare-tray-context.js";
import { formatDisplayPrice } from "@bazarbeat/shared";
import { formatLocalizedNumber } from "../../lib/format.js";
import { cn } from "../../lib/utils.js";
import { WatchlistButton } from "../../features/watchlist/components/watchlist-button.js";
import { CountdownTimer } from "./countdown-timer.js";
import { GradeBadge } from "./grade-badge.js";
import { PriceTag } from "./price-tag.js";

interface ListingCardContextValue {
  listing: BuyerListingCard;
  isCompared: boolean;
  canCompare: boolean;
  disabledReason?: string;
  onCompareToggle: () => void;
}

const ListingCardContext = createContext<ListingCardContextValue | null>(null);

function useListingCardContext(): ListingCardContextValue {
  const context = useContext(ListingCardContext);
  if (!context) {
    throw new Error("ListingCard compound components must be rendered within a ListingCard");
  }
  return context;
}

export interface ListingCardProps {
  listing: BuyerListingCard;
  children?: ReactNode;
  className?: string;
  detailUrl?: string;
}

export function ListingCard({
  listing,
  children,
  className,
  detailUrl = `/buyer/listings/${listing.id}`,
}: ListingCardProps): ReactElement {
  const compareTray = useCompareTray();
  const isCompared = compareTray.isInTray(listing.id);
  const addCheck = compareTray.canAdd(listing);

  const { t } = useTranslation();

  const disabledReason = useMemo(() => {
    if (isCompared || addCheck.allowed) return undefined;
    if (addCheck.reason === "limit") {
      return t("marketplace.compareLimitReached");
    }
    if (addCheck.reason === "crop_mismatch") {
      const cropName = compareTray.trayCropNameEn ?? "";
      return t("marketplace.compareCropMismatch", { crop: cropName });
    }
    return undefined;
  }, [isCompared, addCheck, t, compareTray.trayCropNameEn]);

  const contextValue = useMemo<ListingCardContextValue>(
    () => ({
      listing,
      isCompared,
      canCompare: isCompared || addCheck.allowed,
      disabledReason,
      onCompareToggle: (): void => compareTray.toggleItem(listing),
    }),
    [listing, isCompared, addCheck.allowed, disabledReason, compareTray],
  );

  return (
    <ListingCardContext.Provider value={contextValue}>
      <article
        data-testid={`listing-card-${listing.id}`}
        className={cn(
          "group flex flex-col rounded-xl border border-stone-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-md overflow-hidden min-w-0 h-full",
          isCompared && "ring-2 ring-primary border-primary",
          className,
        )}
      >
        {children ?? (
          <>
            <ListingCard.Image detailUrl={detailUrl} />
            <div className="flex flex-1 flex-col justify-between p-4 min-w-0">
              <div>
                <ListingCard.Header detailUrl={detailUrl} />
                <ListingCard.Location />
              </div>
              <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-2">
                <ListingCard.Price />
                <div className="flex items-center justify-between gap-2 min-h-[2.5rem]">
                  <ListingCard.Countdown />
                  <ListingCard.CompareCheckbox />
                </div>
              </div>
            </div>
          </>
        )}
      </article>
    </ListingCardContext.Provider>
  );
}

export interface ListingCardImageProps {
  className?: string;
  detailUrl?: string;
}

ListingCard.Image = function ListingCardImage({
  className,
  detailUrl,
}: ListingCardImageProps): ReactElement {
  const { listing } = useListingCardContext();
  const imageUrl = listing.thumbnailUrl ?? listing.images?.[0]?.url;
  const cropName = listing.crop?.nameEn ?? "Produce";

  const imageElement = (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden bg-stone-100 select-none",
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={cropName}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
          <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </div>
  );

  return (
    <div className="relative">
      {detailUrl ? (
        <Link to={detailUrl} className="block focus:outline-none">
          {imageElement}
        </Link>
      ) : (
        imageElement
      )}
      <div className="absolute top-2.5 right-2.5 z-10">
        <ListingCard.WatchlistButton />
      </div>
    </div>
  );
};

export interface ListingCardHeaderProps {
  className?: string;
  detailUrl?: string;
}

ListingCard.Header = function ListingCardHeader({
  className,
  detailUrl,
}: ListingCardHeaderProps): ReactElement {
  const { listing } = useListingCardContext();
  const { i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const cropName = isBangla && listing.crop.nameBn ? listing.crop.nameBn : listing.crop.nameEn;
  const secondaryName = isBangla ? listing.crop.nameEn : listing.crop.nameBn;
  const formattedQuantity = formatLocalizedNumber(listing.quantityKg, isBangla);

  const titleContent = (
    <div className={cn("flex items-start justify-between gap-2 min-w-0", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-stone-900 group-hover:text-primary transition-colors truncate">
          {cropName}
        </h3>
        {secondaryName && (
          <p className="text-xs text-stone-400 truncate leading-tight">{secondaryName}</p>
        )}
      </div>
      <span className="shrink-0 rounded bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700">
        {formattedQuantity} {listing.crop.unit}
      </span>
    </div>
  );

  if (detailUrl) {
    return (
      <Link to={detailUrl} className="block focus-visible:outline-primary rounded-xs">
        {titleContent}
      </Link>
    );
  }

  return titleContent;
};

export interface ListingCardLocationProps {
  className?: string;
}

ListingCard.Location = function ListingCardLocation({
  className,
}: ListingCardLocationProps): ReactElement {
  const { listing } = useListingCardContext();
  const locationText = `${listing.location.district}, ${listing.location.division}`;

  return (
    <p
      className={cn(
        "mt-1.5 flex items-center gap-1 text-xs text-stone-500 capitalize truncate min-h-[1.125rem]",
        className,
      )}
      title={locationText}
    >
      <svg
        className="h-3.5 w-3.5 shrink-0 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
        />
      </svg>
      <span className="truncate">{locationText}</span>
    </p>
  );
};

export interface ListingCardPriceProps {
  className?: string;
}

/**
 * Renders price display with fixed minimum height to guarantee no layout shift
 * when bids are updated live.
 */
ListingCard.Price = function ListingCardPrice({
  className,
}: ListingCardPriceProps): ReactElement {
  const { listing } = useListingCardContext();
  const { t } = useTranslation();

  const hasBids = listing.bidCount > 0 && listing.currentBidPerKg !== null;
  const hintText = hasBids
    ? t("marketplace.bidsCount_other", { count: listing.bidCount })
    : t("marketplace.noBidsYet");

  return (
    <div
      data-testid="listing-card-price-section"
      className={cn("flex flex-col justify-center min-h-[3.25rem] min-w-0 select-none", className)}
    >
      <div className="flex items-baseline justify-between gap-1 min-w-0">
        <PriceTag amountPoisha={listing.displayPricePerKg} size="md" />
        <span
          data-testid="listing-card-bid-hint"
          className={cn(
            "text-xs truncate font-medium",
            hasBids ? "text-amber-700 font-semibold" : "text-stone-400",
          )}
        >
          {hintText}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-stone-500 mt-0.5 truncate">
        <span>
          {hasBids ? t("marketplace.currentBid") : t("marketplace.floorPrice")}
        </span>
        <span className="font-medium text-stone-600 truncate">
          {formatDisplayPrice(listing.totalDisplayCost)} total
        </span>
      </div>
    </div>
  );
};

export interface ListingCardCountdownProps {
  className?: string;
}

ListingCard.Countdown = function ListingCardCountdown({
  className,
}: ListingCardCountdownProps): ReactElement {
  const { listing } = useListingCardContext();

  return (
    <div className={cn("shrink-0", className)}>
      <CountdownTimer endsAt={listing.endsAt} size="sm" showIcon={true} />
    </div>
  );
};

export interface ListingCardCompareCheckboxProps {
  className?: string;
}

ListingCard.CompareCheckbox = function ListingCardCompareCheckbox({
  className,
}: ListingCardCompareCheckboxProps): ReactElement {
  const { listing, isCompared, canCompare, disabledReason, onCompareToggle } =
    useListingCardContext();
  const { t } = useTranslation();

  const checkboxId = `compare-checkbox-${listing.id}`;

  return (
    <div className={cn("inline-flex items-center shrink-0", className)} title={disabledReason}>
      <label
        htmlFor={checkboxId}
        className={cn(
          "inline-flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium px-2 py-1.5 rounded-md transition-colors min-h-[44px]",
          !canCompare && "cursor-not-allowed opacity-50",
          isCompared ? "text-primary font-bold bg-primary/10" : "text-stone-600 hover:bg-stone-100",
        )}
      >
        <input
          id={checkboxId}
          type="checkbox"
          data-testid={`compare-checkbox-${listing.id}`}
          checked={isCompared}
          disabled={!canCompare}
          onChange={onCompareToggle}
          aria-label={t("marketplace.addToCompare")}
          aria-description={disabledReason}
          className="h-4 w-4 rounded-sm border-stone-300 text-primary focus:ring-primary focus:ring-offset-0 disabled:cursor-not-allowed"
        />
        <span className="hidden sm:inline text-xs">
          {isCompared ? t("marketplace.addedToCompare") : t("marketplace.addToCompare")}
        </span>
      </label>
    </div>
  );
};

export interface ListingCardWatchlistButtonProps {
  className?: string;
  onWatchlistChanged?: (isWatched: boolean) => void;
}

ListingCard.WatchlistButton = function ListingCardWatchlistButton({
  className,
  onWatchlistChanged,
}: ListingCardWatchlistButtonProps): ReactElement {
  const { listing } = useListingCardContext();
  return (
    <WatchlistButton
      listingId={listing.id}
      initialIsWatched={Boolean(listing.isWatched)}
      onWatchlistChanged={onWatchlistChanged}
      className={className}
    />
  );
};
