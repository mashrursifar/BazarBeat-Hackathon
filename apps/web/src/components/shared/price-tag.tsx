import { type ReactElement } from "react";
import { formatPoisha } from "@bazarbeat/shared";

import { cn } from "../../lib/utils.js";

export interface PriceTagProps {
  amountPoisha: number;
  unit?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_STYLES = {
  sm: { price: "text-sm font-semibold", unit: "text-xs" },
  md: { price: "text-base font-bold", unit: "text-xs sm:text-sm" },
  lg: { price: "text-2xl font-extrabold sm:text-3xl", unit: "text-sm sm:text-base" },
};

export function PriceTag({
  amountPoisha,
  unit = "kg",
  size = "md",
  className,
}: PriceTagProps): ReactElement {
  const formattedPrice = formatPoisha(amountPoisha);
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      data-testid="price-tag"
      className={cn("inline-flex items-baseline gap-0.5 text-stone-900 select-none", className)}
    >
      <span className={cn("tracking-tight text-primary font-bold", sizeStyle.price)}>
        {formattedPrice}
      </span>
      <span className={cn("text-muted-foreground font-medium", sizeStyle.unit)}>
        /{unit}
      </span>
    </span>
  );
}
