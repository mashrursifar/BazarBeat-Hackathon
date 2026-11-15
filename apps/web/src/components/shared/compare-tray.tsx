import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useCompareTray } from "../../features/marketplace/context/compare-tray-context.js";
import { formatPoisha } from "@bazarbeat/shared";
import { cn } from "../../lib/utils.js";
import { GradeBadge } from "./grade-badge.js";

export interface CompareTrayProps {
  className?: string;
}

export function CompareTray({ className }: CompareTrayProps): ReactElement | null {
  const { items, count, trayCropNameEn, trayCropNameBn, removeItem, clearTray } =
    useCompareTray();
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  if (count === 0) {
    return null;
  }

  const cropName = isBangla && trayCropNameBn ? trayCropNameBn : (trayCropNameEn ?? "");
  const canCompare = count >= 2;
  const compareUrl = `/buyer/compare?ids=${items.map((i) => i.id).join(",")}`;

  return (
    <aside
      data-testid="compare-tray"
      aria-label={t("marketplace.compareTray.title")}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-300",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Header / Info */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-stone-900">
                {t("marketplace.compareTray.title")}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {t("marketplace.compareTray.selectedCount", { count })}
              </span>
            </div>
            {cropName && (
              <p className="text-xs text-stone-500 font-medium">
                {t("marketplace.compareTray.cropLabel", { crop: cropName })}
              </p>
            )}
          </div>

          <button
            type="button"
            data-testid="compare-tray-clear-all"
            onClick={clearTray}
            className="text-xs font-semibold text-stone-500 hover:text-red-600 sm:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center underline decoration-dotted"
          >
            {t("marketplace.compareTray.clearAll")}
          </button>
        </div>

        {/* Selected Items Scroll / Grid */}
        <div
          data-testid="compare-tray-items"
          className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin max-w-full"
        >
          {items.map((item) => {
            const itemCropName =
              isBangla && item.crop.nameBn ? item.crop.nameBn : item.crop.nameEn;
            const imgUrl = item.thumbnailUrl ?? item.images?.[0]?.url;

            return (
              <div
                key={item.id}
                data-testid={`compare-tray-item-${item.id}`}
                className="group relative flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 shrink-0 shadow-2xs pr-7 max-w-[13rem]"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-stone-200">
                  {imgUrl ? (
                    <img src={imgUrl} alt={itemCropName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
                      Crop
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-bold text-stone-900 truncate">{itemCropName}</p>
                    <GradeBadge grade={item.grade} size="sm" showLabel={false} />
                  </div>
                  <p className="text-xs font-semibold text-primary truncate">
                    {formatPoisha(item.displayPricePerKg)}
                    <span className="text-[10px] text-stone-500 font-normal">/kg</span>
                  </p>
                </div>

                <button
                  type="button"
                  data-testid={`compare-tray-remove-${item.id}`}
                  onClick={() => removeItem(item.id)}
                  aria-label={t("marketplace.compareTray.removeItem", { title: itemCropName })}
                  className="absolute right-1 top-1 bottom-1 flex w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 justify-end">
          <button
            type="button"
            data-testid="compare-tray-clear-all-desktop"
            onClick={clearTray}
            className="hidden sm:inline-flex text-xs font-semibold text-stone-500 hover:text-red-600 min-h-[44px] items-center px-2 cursor-pointer underline decoration-dotted"
          >
            {t("marketplace.compareTray.clearAll")}
          </button>

          {canCompare ? (
            <Link
              to={compareUrl}
              data-testid="compare-tray-submit"
              className="inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors cursor-pointer"
            >
              {t("marketplace.compareTray.compareButton", { count })}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              data-testid="compare-tray-submit-disabled"
              title={t("marketplace.compareTray.minItemsHint")}
              aria-disabled="true"
              className="inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-lg bg-stone-200 px-4 py-2 text-sm font-bold text-stone-400 cursor-not-allowed"
            >
              {t("marketplace.compareTray.compareButton", { count })}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
