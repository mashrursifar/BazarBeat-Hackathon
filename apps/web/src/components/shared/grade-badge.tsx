import { type ReactElement } from "react";
import { CropGrade } from "@bazarbeat/shared";

import { cn } from "../../lib/utils.js";

export interface GradeBadgeProps {
  grade: CropGrade | "A" | "B" | "C";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const GRADE_STYLES: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  B: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  C: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800",
};

const SIZE_STYLES = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-base px-3.5 py-1.5 gap-2 font-bold",
};

export function GradeBadge({
  grade,
  size = "md",
  showLabel = true,
  className,
}: GradeBadgeProps): ReactElement {
  const normalizedGrade = grade.toUpperCase();
  const colorStyle = GRADE_STYLES[normalizedGrade] ?? GRADE_STYLES.B;

  return (
    <span
      data-testid={`grade-badge-${normalizedGrade.toLowerCase()}`}
      role="status"
      aria-label={`Grade ${normalizedGrade}`}
      className={cn(
        "inline-flex items-center rounded-full border font-bold shadow-sm select-none",
        colorStyle,
        SIZE_STYLES[size],
        className,
      )}
    >
      {showLabel && <span className="font-semibold text-xs opacity-90 uppercase tracking-wider">Grade</span>}
      <span className="font-extrabold tracking-tight text-base sm:text-lg">{normalizedGrade}</span>
    </span>
  );
}
