import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { formatLocalizedNumber } from "../../../lib/format.js";
import { cn } from "../../../lib/utils.js";

export interface MarketplacePaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  className?: string;
}

export function MarketplacePagination({
  page,
  total,
  limit,
  onPageChange,
  className,
}: MarketplacePaginationProps): ReactElement | null {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (total <= limit && page === 1) {
    return null;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);

  return (
    <nav
      data-testid="marketplace-pagination"
      aria-label="Marketplace pagination"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 py-4 border-t border-stone-200",
        className,
      )}
    >
      <div className="text-xs text-stone-500">
        {t("marketplace.showingResults", {
          start: formatLocalizedNumber(start, isBangla),
          end: formatLocalizedNumber(end, isBangla),
          total: formatLocalizedNumber(total, isBangla),
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="pagination-prev"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs transition-colors",
            hasPrev
              ? "hover:bg-stone-50 hover:text-stone-900 cursor-pointer"
              : "opacity-40 cursor-not-allowed",
          )}
        >
          &larr; {t("marketplace.paginationPrev")}
        </button>

        <span data-testid="pagination-indicator" className="px-2 text-xs font-medium text-stone-600">
          {t("marketplace.pageIndicator", {
            page: formatLocalizedNumber(page, isBangla),
            totalPages: formatLocalizedNumber(totalPages, isBangla),
          })}
        </span>

        <button
          type="button"
          data-testid="pagination-next"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs transition-colors",
            hasNext
              ? "hover:bg-stone-50 hover:text-stone-900 cursor-pointer"
              : "opacity-40 cursor-not-allowed",
          )}
        >
          {t("marketplace.paginationNext")} &rarr;
        </button>
      </div>
    </nav>
  );
}
