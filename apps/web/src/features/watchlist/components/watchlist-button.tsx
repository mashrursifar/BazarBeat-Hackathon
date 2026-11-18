import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils.js";
import { useWatchlistToggle } from "../use-watchlist-toggle.js";

export interface WatchlistButtonProps {
  listingId: string;
  initialIsWatched?: boolean;
  onWatchlistChanged?: (isWatched: boolean) => void;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function WatchlistButton({
  listingId,
  initialIsWatched = false,
  onWatchlistChanged,
  className,
  showLabel = false,
  size = "md",
}: WatchlistButtonProps): ReactElement {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isWatched, isLoading, toggle } = useWatchlistToggle({
    listingId,
    initialIsWatched,
    onSuccess: (nextWatched) => {
      setErrorMessage(null);
      onWatchlistChanged?.(nextWatched);
    },
    onError: (code) => {
      if (code === "WATCHLIST_CAP_EXCEEDED") {
        setErrorMessage(
          t("watchlist.capExceeded", "Watchlist limit reached (maximum 50 items)"),
        );
      } else if (code === "LISTING_NOT_ACTIVE") {
        setErrorMessage(
          t("watchlist.listingNotActive", "Only active listings can be saved"),
        );
      } else {
        setErrorMessage(t("watchlist.toggleError", "Could not update watchlist"));
      }
    },
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    void toggle();
  };

  const buttonSizeClasses = {
    sm: "h-9 px-2 text-xs",
    md: "min-h-[44px] min-w-[44px] p-2.5 text-xs",
    lg: "min-h-[44px] px-4 py-2.5 text-sm",
  }[size];

  const iconSizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-5 w-5",
  }[size];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        data-testid={`watchlist-toggle-${listingId}`}
        aria-label={
          isWatched
            ? t("watchlist.removeFromWatchlist", "Remove from watchlist")
            : t("watchlist.addToWatchlist", "Add to watchlist")
        }
        aria-pressed={isWatched}
        disabled={isLoading}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 select-none",
          isWatched
            ? "bg-white text-red-500 hover:bg-red-50 shadow-xs"
            : "bg-white/85 text-stone-600 hover:bg-white hover:text-red-500 shadow-xs backdrop-blur-xs",
          buttonSizeClasses,
          className,
        )}
      >
        <svg
          className={cn(
            "transition-transform duration-150 active:scale-90",
            iconSizeClasses,
            isWatched ? "fill-red-500 stroke-red-500" : "fill-none stroke-current stroke-2",
          )}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
        {showLabel && (
          <span className="font-semibold">
            {isWatched
              ? t("watchlist.watching", "Watching")
              : t("watchlist.watch", "Watch")}
          </span>
        )}
      </button>

      {errorMessage && (
        <div
          role="alert"
          data-testid="watchlist-error-message"
          className="absolute right-0 top-12 z-50 w-56 rounded-md bg-red-600 p-2 text-xs font-medium text-white shadow-lg animate-in fade-in"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
