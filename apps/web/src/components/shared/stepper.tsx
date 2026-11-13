import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../lib/utils.js";

export interface StepItem {
  id: number;
  key: string;
  label: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps): ReactElement {
  const { t } = useTranslation();
  const currentStepItem = steps.find((s) => s.id === currentStep) ?? steps[0];

  return (
    <nav
      aria-label="Progress"
      data-testid="stepper"
      className={cn("w-full py-2", className)}
    >
      {/* Mobile view (< 640px) */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
          <span>
            {t("stepper.step", "Step")} {currentStep} {t("stepper.of", "of")} {steps.length}
          </span>
          <span className="font-bold text-foreground truncate max-w-[180px]">
            {currentStepItem?.label}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 border border-stone-200">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop / Tablet view (>= 640px) */}
      <ol className="hidden sm:flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isClickable = onStepClick !== undefined && (isCompleted || isCurrent);

          return (
            <li
              key={step.id}
              className={cn("flex flex-1 items-center", index === steps.length - 1 && "flex-none")}
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(step.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 group text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1",
                  isClickable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "border-2 border-primary bg-primary/10 text-primary font-extrabold",
                    !isCompleted && !isCurrent && "border border-stone-300 bg-stone-50 text-stone-500",
                  )}
                >
                  {isCompleted ? (
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold whitespace-nowrap",
                    isCurrent && "text-primary font-bold",
                    isCompleted && "text-foreground",
                    !isCompleted && !isCurrent && "text-stone-400",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "mx-2 h-0.5 flex-1 transition-colors",
                    step.id < currentStep ? "bg-primary" : "bg-stone-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
