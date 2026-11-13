import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LISTING_DURATION_PRESETS } from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { useAddStock, useInventory } from "../../inventory/api/use-inventory.js";
import { AddStockDialog } from "../../inventory/inventory-page.js";
import { usePublicConfig } from "../api/use-listing-wizard-api.js";
import { useListingWizard } from "../context/listing-wizard-context.js";

const DEFAULT_PRESETS: Record<string, number> = {
  "1h": LISTING_DURATION_PRESETS.ONE_HOUR,
  "3h": LISTING_DURATION_PRESETS.THREE_HOURS,
  "6h": LISTING_DURATION_PRESETS.SIX_HOURS,
  "12h": LISTING_DURATION_PRESETS.TWELVE_HOURS,
  "24h": LISTING_DURATION_PRESETS.TWENTY_FOUR_HOURS,
};

export function Step5QuantityTimer(): ReactElement {
  const { t, i18n } = useTranslation();
  const {
    selectedCrop,
    quantityKg,
    setQuantityKg,
    durationMinutes,
    setDurationMinutes,
    pickupNote,
    setPickupNote,
    setStep,
  } = useListingWizard();

  const inventoryQuery = useInventory();
  const addStockMutation = useAddStock();
  const configQuery = usePublicConfig();

  const [addStockOpen, setAddStockOpen] = useState(false);
  const [quantityInput, setQuantityInput] = useState<string>(
    quantityKg > 0 ? quantityKg.toString() : "",
  );

  const inventoryItem = inventoryQuery.data?.find(
    (item) => item.crop.id === selectedCrop?.id,
  );
  const availableStockKg = inventoryItem?.availableKg ?? 0;

  const minLotKg = selectedCrop?.minLotKg ?? 10;
  const maxLotKg = selectedCrop?.maxLotKg ?? 5000;
  const shelfLifeHours = selectedCrop?.shelfLifeHours ?? 48;
  const shelfLifeCapMinutes = shelfLifeHours * 60;

  // Filter duration presets by shelf life
  const rawPresets: Record<string, number> =
    configQuery.data?.durationPresets ?? DEFAULT_PRESETS;

  // Filter out any preset longer than shelf life
  const activePresets = Object.entries(rawPresets)
    .filter(([, minutes]) => minutes <= shelfLifeCapMinutes)
    .sort(([, a], [, b]) => a - b);

  // Initialize duration to default (6h or highest available under shelf life)
  useEffect(() => {
    if (!durationMinutes || durationMinutes > shelfLifeCapMinutes) {
      const defaultMinutes =
        activePresets.find(([, m]) => m === 360)?.[1] ??
        activePresets[activePresets.length - 1]?.[1] ??
        60;
      setDurationMinutes(defaultMinutes);
    }
  }, [durationMinutes, shelfLifeCapMinutes, activePresets, setDurationMinutes]);

  // Default quantity if empty and enough stock
  useEffect(() => {
    if (quantityKg === 0 && availableStockKg >= minLotKg) {
      setQuantityKg(minLotKg);
      setQuantityInput(minLotKg.toString());
    }
  }, [quantityKg, availableStockKg, minLotKg, setQuantityKg]);

  const handleQuantityChange = (val: string): void => {
    setQuantityInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setQuantityKg(num);
    } else {
      setQuantityKg(0);
    }
  };

  // Validation checks
  const isStockInsufficientForMin = availableStockKg < minLotKg;
  const exceedsStock = quantityKg > availableStockKg;
  const belowMinLot = quantityKg > 0 && quantityKg < minLotKg;
  const exceedsMaxLot = quantityKg > maxLotKg;
  const isQuantityValid =
    quantityKg >= minLotKg && quantityKg <= maxLotKg && quantityKg <= availableStockKg;

  const formatDurationLabel = (minutes: number): string => {
    if (minutes < 60) {
      return i18n.language === "bn" ? `${minutes} মি` : `${minutes}m`;
    }
    const hours = Math.round(minutes / 60);
    return i18n.language === "bn" ? `${hours} ঘণ্টা` : `${hours}h`;
  };

  return (
    <div data-testid="step-5-quantity-timer" className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("wizard.step5Title", "Lot Quantity & Auction Duration")}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t(
            "wizard.step5Subtitle",
            "Choose how much available stock to sell and how long the bidding lasts.",
          )}
        </p>
      </div>

      {/* Available Stock & Lot Info Card */}
      <div
        data-testid="stock-info-card"
        className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("wizard.availableStock", "Available in stock:")}
            </span>
            <span
              data-testid="available-stock-display"
              className="text-xl sm:text-2xl font-black text-foreground"
            >
              {availableStockKg} kg
            </span>
          </div>

          <Button
            type="button"
            data-testid="inline-add-stock-btn"
            onClick={() => setAddStockOpen(true)}
            className="w-auto text-xs py-2 px-3 bg-white text-primary border border-primary/30 hover:bg-stone-50"
          >
            + {t("inventory.addStock", "Add stock")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-stone-600 pt-2 border-t border-stone-200">
          <span>
            {t("wizard.lotRange", "Allowed lot range:")}{" "}
            <strong>
              {minLotKg} kg – {maxLotKg} kg
            </strong>
          </span>
          <span>
            {t("wizard.shelfLifeLimit", "Shelf life cap:")}{" "}
            <strong>{shelfLifeHours} hours</strong>
          </span>
        </div>
      </div>

      {/* Insufficient Stock Warning */}
      {isStockInsufficientForMin && (
        <div
          data-testid="insufficient-stock-warning"
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950 space-y-2 shadow-2xs"
        >
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <span>⚠️</span>
            <span>
              {t(
                "wizard.insufficientStockWarning",
                "You do not have enough stock in inventory to meet the minimum lot of {{minLotKg}} kg.",
                { minLotKg },
              )}
            </span>
          </div>
          <p className="text-xs text-amber-900">
            {t(
              "wizard.insufficientStockDesc",
              "Please add harvest stock to your inventory first, then enter the quantity to sell.",
            )}
          </p>
        </div>
      )}

      {/* Quantity Input */}
      <div className="space-y-2">
        <label htmlFor="lot-quantity-input" className="block text-sm font-bold text-foreground">
          {t("wizard.quantityLabel", "Quantity to sell (kg)")} *
        </label>

        <div className="relative flex items-center max-w-xs">
          <Input
            id="lot-quantity-input"
            data-testid="lot-quantity-input"
            type="number"
            inputMode="decimal"
            min={minLotKg}
            max={Math.min(maxLotKg, availableStockKg)}
            step="1"
            placeholder={minLotKg.toString()}
            value={quantityInput}
            onChange={(e) => handleQuantityChange(e.target.value)}
            required
            className="pr-12 text-lg font-bold"
          />
          <span className="absolute right-3 text-xs font-semibold text-muted-foreground">
            kg
          </span>
        </div>

        {/* Quantity inline errors */}
        {belowMinLot && (
          <p
            data-testid="quantity-error-min"
            role="alert"
            className="text-xs text-red-700 font-medium"
          >
            {t("wizard.quantityBelowMin", "Quantity must be at least {{minLotKg}} kg.", {
              minLotKg,
            })}
          </p>
        )}
        {exceedsStock && (
          <p
            data-testid="quantity-error-stock"
            role="alert"
            className="text-xs text-red-700 font-medium"
          >
            {t(
              "wizard.quantityAboveStock",
              "Quantity exceeds your available stock of {{availableKg}} kg.",
              { availableKg: availableStockKg },
            )}
          </p>
        )}
        {exceedsMaxLot && (
          <p
            data-testid="quantity-error-max"
            role="alert"
            className="text-xs text-red-700 font-medium"
          >
            {t(
              "wizard.quantityAboveMax",
              "Quantity cannot exceed crop limit of {{maxLotKg}} kg.",
              { maxLotKg },
            )}
          </p>
        )}
      </div>

      {/* Duration Presets */}
      <div className="space-y-3 pt-2">
        <div className="space-y-1">
          <label className="block text-sm font-bold text-foreground">
            {t("wizard.durationLabel", "Auction duration")} *
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              "wizard.durationHelp",
              "Capped by crop shelf life (max {{maxHours}} hours).",
              { maxHours: shelfLifeHours },
            )}
          </p>
        </div>

        <div
          data-testid="duration-presets"
          className="flex flex-wrap items-center gap-2"
          role="radiogroup"
          aria-label={t("wizard.durationLabel", "Auction duration")}
        >
          {activePresets.map(([presetKey, minutes]) => {
            const isSelected = durationMinutes === minutes;
            return (
              <button
                key={presetKey}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`duration-preset-${minutes}`}
                onClick={() => setDurationMinutes(minutes)}
                className={`min-h-11 min-w-[72px] rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "bg-primary text-white ring-2 ring-primary ring-offset-1"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
                }`}
              >
                {formatDurationLabel(minutes)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Pickup Note */}
      <div className="space-y-2 pt-2">
        <label htmlFor="pickup-note-input" className="block text-sm font-bold text-foreground">
          {t("wizard.pickupNoteLabel", "Pickup / Handover note (optional)")}
        </label>
        <Input
          id="pickup-note-input"
          data-testid="pickup-note-input"
          type="text"
          maxLength={300}
          placeholder={t(
            "wizard.pickupNotePlaceholder",
            "e.g., Sonapur Bazar storage shed #2, contact on arrival",
          )}
          value={pickupNote}
          onChange={(e) => setPickupNote(e.target.value)}
          className="text-sm bg-white"
        />
        <p className="text-xs text-muted-foreground">
          {t(
            "wizard.pickupNoteHint",
            "Visible to the winning bidder after auction completion.",
          )}
        </p>
      </div>

      {/* Inline Add Stock Dialog */}
      {addStockOpen && (
        <AddStockDialog
          crops={inventoryQuery.data ?? []}
          onClose={() => setAddStockOpen(false)}
          onAdd={async (input) => {
            await addStockMutation.mutateAsync(input);
            await inventoryQuery.refetch();
          }}
        />
      )}

      {/* Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-stone-200">
        <Button
          type="button"
          data-testid="step-5-back"
          onClick={() => setStep(4)}
          className="w-full sm:w-auto bg-white text-stone-700 hover:bg-stone-100 border border-stone-300"
        >
          ← {t("wizard.backToPrice", "Back to Price Guidance")}
        </Button>

        <Button
          type="button"
          data-testid="step-5-continue"
          disabled={!isQuantityValid || !durationMinutes}
          onClick={() => setStep(6)}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {t("wizard.continueToReview", "Continue to Review")} →
        </Button>
      </div>
    </div>
  );
}
