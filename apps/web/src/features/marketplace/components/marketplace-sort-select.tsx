import { type ChangeEvent, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { MarketplaceSort } from "@bazarbeat/shared";

import { cn } from "../../../lib/utils.js";

export interface MarketplaceSortSelectProps {
  value: MarketplaceSort;
  onChange: (sort: MarketplaceSort) => void;
  className?: string;
}

export function MarketplaceSortSelect({
  value,
  onChange,
  className,
}: MarketplaceSortSelectProps): ReactElement {
  const { t } = useTranslation();

  const handleChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onChange(e.target.value as MarketplaceSort);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor="marketplace-sort-select"
        className="text-xs font-semibold text-stone-500 shrink-0 select-none"
      >
        {t("marketplace.sort")}:
      </label>
      <select
        id="marketplace-sort-select"
        data-testid="marketplace-sort-select"
        value={value}
        onChange={handleChange}
        className="h-10 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-800 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-h-[44px]"
      >
        <option value={MarketplaceSort.ENDING_SOONEST}>
          {t("marketplace.sortEndingSoonest")}
        </option>
        <option value={MarketplaceSort.LOWEST_PRICE}>
          {t("marketplace.sortLowestPrice")}
        </option>
        <option value={MarketplaceSort.HIGHEST_GRADE}>
          {t("marketplace.sortHighestGrade")}
        </option>
        <option value={MarketplaceSort.NEWEST}>
          {t("marketplace.sortNewest")}
        </option>
      </select>
    </div>
  );
}
