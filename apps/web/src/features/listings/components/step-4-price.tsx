import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { evaluateFloorPrice, formatPoisha } from "@bazarbeat/shared";

import { PriceTag } from "../../../components/shared/price-tag.js";
import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { renderPriceReason } from "../../ai-reasons/ai-reason-text.js";
import { usePricePrediction } from "../api/use-listing-wizard-api.js";
import { useListingWizard } from "../context/listing-wizard-context.js";

export function Step4Price(): ReactElement {
  const { t } = useTranslation();
  const {
    selectedCrop,
    assessmentResult,
    quantityKg,
    priceGuidance,
    setPriceGuidance,
    floorPricePerKg,
    setFloorPricePerKg,
    localSellingCostPerKg,
    setLocalSellingCostPerKg,
    setStep,
  } = useListingWizard();

  const pricePrediction = usePricePrediction();
  const [costInput, setCostInput] = useState<string>(
    localSellingCostPerKg > 0 ? (localSellingCostPerKg / 100).toString() : "",
  );
  const [floorInput, setFloorInput] = useState<string>(
    floorPricePerKg > 0 ? (floorPricePerKg / 100).toString() : "",
  );

  // Sync floorInput if floorPricePerKg changes externally (e.g. "Use suggested floor")
  useEffect(() => {
    if (floorPricePerKg > 0) {
      setFloorInput((floorPricePerKg / 100).toString());
    } else {
      setFloorInput("");
    }
  }, [floorPricePerKg]);

  // Request price prediction on mount if not yet cached
  useEffect(() => {
    if (!priceGuidance && selectedCrop && assessmentResult && !pricePrediction.isPending) {
      pricePrediction.mutate(
        {
          cropId: selectedCrop.id,
          grade: assessmentResult.grade,
          quantityKg: quantityKg > 0 ? quantityKg : selectedCrop.minLotKg,
          localSellingCostPerKg: localSellingCostPerKg > 0 ? localSellingCostPerKg : undefined,
        },
        {
          onSuccess: (guidance) => {
            setPriceGuidance(guidance);
            if (floorPricePerKg <= 0 && guidance.suggestedFloorPerKg > 0) {
              setFloorPricePerKg(guidance.suggestedFloorPerKg);
            }
          },
        },
      );
    }
  }, [selectedCrop, assessmentResult, priceGuidance, pricePrediction, quantityKg, localSellingCostPerKg, floorPricePerKg, setPriceGuidance, setFloorPricePerKg]);

  const handleUpdateCost = (): void => {
    const bdt = parseFloat(costInput);
    const poisha = !isNaN(bdt) && bdt > 0 ? Math.round(bdt * 100) : 0;
    setLocalSellingCostPerKg(poisha);

    if (selectedCrop && assessmentResult) {
      pricePrediction.mutate(
        {
          cropId: selectedCrop.id,
          grade: assessmentResult.grade,
          quantityKg: quantityKg > 0 ? quantityKg : selectedCrop.minLotKg,
          localSellingCostPerKg: poisha > 0 ? poisha : undefined,
        },
        {
          onSuccess: (guidance) => {
            setPriceGuidance(guidance);
          },
        },
      );
    }
  };

  const handleFloorChange = (value: string): void => {
    setFloorInput(value);
    const bdt = parseFloat(value);
    if (!isNaN(bdt) && bdt > 0) {
      setFloorPricePerKg(Math.round(bdt * 100));
    } else {
      setFloorPricePerKg(0);
    }
  };

  const handleUseSuggestedFloor = (): void => {
    if (priceGuidance?.suggestedFloorPerKg) {
      setFloorPricePerKg(priceGuidance.suggestedFloorPerKg);
      setFloorInput((priceGuidance.suggestedFloorPerKg / 100).toString());
    }
  };

  // Evaluate floor price against market guidance
  let floorWarning: "below-market" | "overpriced" | "ok" | null = null;
  if (
    floorPricePerKg > 0 &&
    priceGuidance &&
    priceGuidance.lowPerKg > 0 &&
    priceGuidance.highPerKg > 0
  ) {
    try {
      floorWarning = evaluateFloorPrice(
        floorPricePerKg,
        priceGuidance.lowPerKg,
        priceGuidance.highPerKg,
      );
    } catch {
      floorWarning = null;
    }
  }

  if (pricePrediction.isPending && !priceGuidance) {
    return (
      <div data-testid="step-4-price-loading" role="status" className="space-y-6 py-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-stone-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-xl bg-stone-200" />
          ))}
        </div>
        <div className="h-20 animate-pulse rounded-xl bg-stone-200" />
        <p className="text-center text-sm text-muted-foreground">
          {t("wizard.loadingGuidance", "Fetching price guidance…")}
        </p>
      </div>
    );
  }

  if (pricePrediction.isError && !priceGuidance) {
    return (
      <div data-testid="step-4-price-error" className="space-y-6 py-6 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-950">
          <p className="text-sm font-semibold">
            {t("wizard.guidanceError", "Failed to retrieve price guidance. Please try again.")}
          </p>
          <Button
            type="button"
            className="mt-4 w-auto inline-flex"
            onClick={() => {
              if (selectedCrop && assessmentResult) {
                pricePrediction.mutate({
                  cropId: selectedCrop.id,
                  grade: assessmentResult.grade,
                  quantityKg: quantityKg > 0 ? quantityKg : selectedCrop.minLotKg,
                  localSellingCostPerKg: localSellingCostPerKg > 0 ? localSellingCostPerKg : undefined,
                });
              }
            }}
          >
            {t("auth.retry", "Try again")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="step-4-price" className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("wizard.step4Title", "Price Guidance & Floor Price")}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t(
            "wizard.step4Subtitle",
            "Review AI market estimate and set your minimum acceptable floor price.",
          )}
        </p>
      </div>

      {priceGuidance && (
        <>
          {/* AI Market Range Visual */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {t("wizard.aiMarketRange", "AI Market Price Range")}
              </h3>
              <span
                data-testid="trend-badge"
                className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700"
              >
                {priceGuidance.trend === "UP" && `📈 ${t("wizard.trendUp", "Prices trending up")}`}
                {priceGuidance.trend === "DOWN" && `📉 ${t("wizard.trendDown", "Prices trending down")}`}
                {priceGuidance.trend === "FLAT" && `➡️ ${t("wizard.trendFlat", "Prices stable")}`}
              </span>
            </div>

            <div
              data-testid="price-range-visual"
              className="grid grid-cols-3 gap-2 sm:gap-4 rounded-xl border border-stone-200 bg-stone-50/50 p-3 sm:p-4 text-center"
            >
              <div className="rounded-lg bg-white p-2.5 sm:p-3 shadow-2xs">
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("wizard.low", "Low")}
                </span>
                <PriceTag amountPoisha={priceGuidance.lowPerKg} size="md" className="mt-1" />
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 sm:p-3 shadow-2xs">
                <span className="block text-xs font-semibold text-primary uppercase tracking-wider">
                  {t("wizard.expected", "Expected")}
                </span>
                <PriceTag amountPoisha={priceGuidance.expectedPerKg} size="lg" className="mt-1" />
              </div>

              <div className="rounded-lg bg-white p-2.5 sm:p-3 shadow-2xs">
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("wizard.high", "High")}
                </span>
                <PriceTag amountPoisha={priceGuidance.highPerKg} size="md" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Local Market Estimate Card */}
          <div
            data-testid="local-market-card"
            className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 shadow-2xs space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm sm:text-base font-bold text-foreground">
                🏪 {t("wizard.localMarketCardTitle", "Local market estimate")}
              </h4>
              <span className="text-sm font-bold text-stone-900">
                {formatPoisha(priceGuidance.expectedPerKg)} / kg
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t(
                "wizard.localMarketCardDesc",
                "Based on recent mandi/bazar transactions, this is what you could expect selling locally.",
              )}
            </p>
            {priceGuidance.explanation && priceGuidance.explanation.length > 0 && (
              <div data-testid="price-reasons-list" className="flex flex-wrap gap-1.5 pt-1">
                {priceGuidance.explanation.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
                  >
                    <span>📊</span>
                    <span>{renderPriceReason(item, t)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Optional Local Selling Cost Input */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <label className="block text-xs sm:text-sm font-semibold text-foreground">
              {t(
                "wizard.localSellingCost",
                "Local selling cost (transport, commission) - optional",
              )}
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {t(
                  "wizard.localSellingCostHint",
                  "Enter estimated expenses per kg to tailor your suggested floor.",
                )}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stone-500">৳</span>
              <Input
                data-testid="local-selling-cost-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                placeholder="0.00"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                onBlur={handleUpdateCost}
                className="max-w-[140px] bg-white"
              />
              <span className="text-xs text-muted-foreground">/ kg</span>
              <Button
                type="button"
                data-testid="update-cost-btn"
                onClick={handleUpdateCost}
                className="w-auto text-xs py-2 px-3 bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"
              >
                {t("wizard.updateGuidance", "Update")}
              </Button>
            </div>
          </div>

          {/* Floor Price Input & Warning Section */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="floor-price-input" className="block text-sm font-bold text-foreground">
                {t("wizard.floorPriceLabel", "Your floor price (৳/kg)")} *
              </label>

              <Button
                type="button"
                data-testid="use-suggested-floor-btn"
                onClick={handleUseSuggestedFloor}
                className="w-auto text-xs py-1.5 px-3 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
              >
                ✨ {t("wizard.useSuggestedFloor", "Use suggested floor")} (
                {formatPoisha(priceGuidance.suggestedFloorPerKg)}/kg)
              </Button>
            </div>

            <div className="relative flex items-center max-w-xs">
              <span className="absolute left-3 text-base font-bold text-stone-500">৳</span>
              <Input
                id="floor-price-input"
                data-testid="floor-price-input"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.5"
                placeholder="0.00"
                value={floorInput}
                onChange={(e) => handleFloorChange(e.target.value)}
                required
                className="pl-8 pr-14 text-lg font-bold"
              />
              <span className="absolute right-3 text-xs font-semibold text-muted-foreground">
                / kg
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {t(
                "wizard.floorPriceHelp",
                "Bids below this floor price will never be accepted.",
              )}
            </p>

            {/* Live Floor Evaluation Warnings */}
            {floorWarning === "below-market" && (
              <div
                data-testid="floor-warning-below-market"
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-900 flex items-start gap-2 shadow-2xs"
              >
                <span className="text-base">⚠️</span>
                <span>
                  {t(
                    "wizard.floorWarningBelowMarket",
                    "Warning: Your floor price is below the AI market range. You may be selling for less than market value.",
                  )}
                </span>
              </div>
            )}

            {floorWarning === "overpriced" && (
              <div
                data-testid="floor-warning-overpriced"
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-900 flex items-start gap-2 shadow-2xs"
              >
                <span className="text-base">⚠️</span>
                <span>
                  {t(
                    "wizard.floorWarningOverpriced",
                    "Warning: Your floor price is more than 30% above the high market price. Your listing may not receive qualifying bids.",
                  )}
                </span>
              </div>
            )}

            {floorWarning === "ok" && (
              <div
                data-testid="floor-status-ok"
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs sm:text-sm text-emerald-800 flex items-center gap-2 shadow-2xs"
              >
                <span className="text-base text-emerald-600 font-bold">✓</span>
                <span>
                  {t(
                    "wizard.floorPriceOk",
                    "Floor price is within the recommended market range.",
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Reassurance text */}
          <div
            data-testid="reassurance-banner"
            className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs sm:text-sm text-stone-700 flex items-center gap-2.5 shadow-2xs"
          >
            <span className="text-lg">💡</span>
            <span className="font-medium leading-relaxed">
              {t(
                "wizard.reassuranceText",
                "If no bid reaches your floor, you can still sell in your local market.",
              )}
            </span>
          </div>
        </>
      )}

      {/* Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-stone-200">
        <Button
          type="button"
          data-testid="step-4-back"
          onClick={() => setStep(3)}
          className="w-full sm:w-auto bg-white text-stone-700 hover:bg-stone-100 border border-stone-300"
        >
          ← {t("wizard.backToAiResult", "Back to AI Result")}
        </Button>

        <Button
          type="button"
          data-testid="step-4-continue"
          disabled={floorPricePerKg <= 0 || pricePrediction.isPending}
          onClick={() => setStep(5)}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {t("wizard.continueToQuantity", "Continue to Quantity & Timer")} →
        </Button>
      </div>
    </div>
  );
}
