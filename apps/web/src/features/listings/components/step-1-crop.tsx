import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";
import { useCrops } from "../api/use-listing-wizard-api.js";
import { useListingWizard } from "../context/listing-wizard-context.js";

export function Step1Crop(): ReactElement {
  const { t, i18n } = useTranslation();
  const { data: crops, isLoading, isError, refetch } = useCrops();
  const { selectedCrop, setSelectedCrop, setStep } = useListingWizard();

  if (isLoading) {
    return (
      <div data-testid="step-1-loading" className="space-y-4 py-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">
          {t("wizard.loadingCrops", "Loading available crops…")}
        </p>
      </div>
    );
  }

  if (isError || !crops) {
    return (
      <div
        data-testid="step-1-error"
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-900"
      >
        <p className="font-bold text-sm sm:text-base">
          {t("wizard.cropsLoadError", "Could not load crops list.")}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 min-h-[44px] rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 shadow-sm hover:bg-red-50"
        >
          {t("auth.retry", "Try again")}
        </button>
      </div>
    );
  }

  return (
    <div data-testid="step-1-crop" className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("wizard.step1Title", "Select the crop you want to sell")}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          {t(
            "wizard.step1Subtitle",
            "Choose one of our 5 verified marketplace crops to start AI grading.",
          )}
        </p>
      </div>

      {/* Grid of crop cards */}
      <div
        role="radiogroup"
        aria-label={t("wizard.cropList", "Available crops")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {crops.map((crop) => {
          const isSelected = selectedCrop?.id === crop.id;
          const localizedName = i18n.language === "bn" ? crop.nameBn : crop.nameEn;
          const secondaryName = i18n.language === "bn" ? crop.nameEn : crop.nameBn;

          return (
            <div
              key={crop.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              data-testid={`crop-card-${crop.slug}`}
              onClick={() => setSelectedCrop(crop)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setSelectedCrop(crop);
                }
              }}
              className={cn(
                "group relative flex min-h-[96px] cursor-pointer items-start justify-between rounded-xl border p-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                  : "border-stone-200 bg-white hover:border-primary/50 hover:bg-stone-50/50",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">{localizedName}</h3>
                  <span className="text-xs text-muted-foreground">({secondaryName})</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
                  <span className="rounded bg-stone-100 px-2 py-0.5 font-medium">
                    {t("wizard.lotSize", "Lot:")} {crop.minLotKg}–{crop.maxLotKg} kg
                  </span>
                  <span className="rounded bg-stone-100 px-2 py-0.5 font-medium">
                    {t("wizard.shelfLife", "Shelf life:")} {crop.shelfLifeHours}h
                  </span>
                </div>
              </div>

              {/* Selection radio visual */}
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors mt-0.5",
                  isSelected
                    ? "border-primary bg-primary text-white"
                    : "border-stone-300 bg-white group-hover:border-primary",
                )}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-end pt-4 border-t border-stone-200">
        <Button
          type="button"
          data-testid="step-1-continue"
          disabled={!selectedCrop}
          onClick={() => setStep(2)}
          className="w-full sm:w-auto min-w-[160px]"
        >
          {t("wizard.continue", "Continue to photos")} →
        </Button>
      </div>
    </div>
  );
}
