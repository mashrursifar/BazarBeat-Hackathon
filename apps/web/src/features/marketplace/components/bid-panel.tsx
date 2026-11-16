import { type ReactElement, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BidItem,
  type BuyerListingDetail,
  BuyerListingStatus,
  ListingStatus,
  calculateSubtotal,
  calculateSuggestedBids,
  formatPoisha,
} from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { cn } from "../../../lib/utils.js";
import { type MarketplaceApiError } from "../api/marketplace-api.js";
import { usePlaceBid } from "../api/use-buyer-listing.js";
import { BindingBidDialog } from "./binding-bid-dialog.js";

/**
 * Converts a Taka string (with at most 2 decimal digits) to integer poisha.
 * Strictly prevents floating-point inaccuracy. Returns null on invalid input.
 */
export function parseTakaToPoisha(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (wholePart === undefined) return null;
  const whole = parseInt(wholePart, 10);
  const frac = parseInt(fracPart.padEnd(2, "0"), 10);
  const poisha = whole * 100 + frac;
  if (!Number.isSafeInteger(poisha) || poisha <= 0) {
    return null;
  }
  return poisha;
}

/**
 * Converts integer poisha to formatted Taka decimal string (e.g. 4500 -> "45.00").
 */
export function poishaToTaka(poisha: number): string {
  if (!Number.isSafeInteger(poisha) || poisha < 0) return "";
  return (poisha / 100).toFixed(2);
}

export interface BidPanelProps {
  listing: BuyerListingDetail;
  onBidSuccess?: (bid: BidItem) => void;
  className?: string;
}

interface MappedError {
  message: string;
  minimumRequiredPerKg?: number;
}

export function BidPanel({
  listing,
  onBidSuccess,
  className,
}: BidPanelProps): ReactElement {
  const { t } = useTranslation();
  const inputId = useId();

  // Next minimum required bid
  const minimumRequiredPerKg = useMemo(() => {
    if (listing.bidCount === 0) {
      return listing.floorPricePerKg;
    }
    return (listing.currentBidPerKg ?? listing.floorPricePerKg) + listing.minIncrementPerKg;
  }, [listing.bidCount, listing.currentBidPerKg, listing.floorPricePerKg, listing.minIncrementPerKg]);

  // Suggested quick bids computed by shared pure function
  const suggestedBids = useMemo(() => {
    try {
      return calculateSuggestedBids({
        floorPricePerKg: listing.floorPricePerKg,
        currentBidPerKg: listing.currentBidPerKg,
        minIncrementPerKg: listing.minIncrementPerKg,
        bidCount: listing.bidCount,
        quantityKg: listing.quantityKg,
      });
    } catch {
      return [];
    }
  }, [
    listing.floorPricePerKg,
    listing.currentBidPerKg,
    listing.minIncrementPerKg,
    listing.bidCount,
    listing.quantityKg,
  ]);

  // Input state in Taka
  const [takaInput, setTakaInput] = useState<string>(poishaToTaka(minimumRequiredPerKg));
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [mappedError, setMappedError] = useState<MappedError | null>(null);

  // Idempotency key per bid intent (UUID).
  // Reused across retries of the SAME intent, replaced when amount changes.
  const [intentKey, setIntentKey] = useState<string>(() => crypto.randomUUID());

  // Parse amount at the edge
  const parsedPoisha = useMemo(() => parseTakaToPoisha(takaInput), [takaInput]);

  // Live total cost preview
  const liveTotalPoisha = useMemo(() => {
    if (!parsedPoisha) return null;
    try {
      return calculateSubtotal(parsedPoisha, listing.quantityKg);
    } catch {
      return null;
    }
  }, [parsedPoisha, listing.quantityKg]);

  const placeBidMutation = usePlaceBid(listing.id);

  // Handle amount change by user
  const handleAmountChange = (newTaka: string): void => {
    setTakaInput(newTaka);
    setMappedError(null);
    // Generate a fresh idempotency key for this new intent
    setIntentKey(crypto.randomUUID());
  };

  // Select a suggested bid
  const handleSelectSuggested = (amountPerKg: number): void => {
    handleAmountChange(poishaToTaka(amountPerKg));
  };

  // Map server API error into friendly user message
  const mapApiError = (err: MarketplaceApiError | Error): MappedError => {
    const apiErr = err as MarketplaceApiError;
    const code = apiErr.code;
    const details = apiErr.details as
      | { minimumRequiredPerKg?: number; currentBidPerKg?: number }
      | undefined;

    if (code === "BID_TOO_LOW") {
      const min = details?.minimumRequiredPerKg ?? minimumRequiredPerKg;
      return {
        message: t("bidPanel.errors.bidTooLow", { min: `${formatPoisha(min)}/kg` }),
        minimumRequiredPerKg: min,
      };
    }

    if (code === "AUCTION_CLOSED") {
      return { message: t("bidPanel.errors.auctionClosed") };
    }

    if (code === "OWN_LISTING" || code === "FORBIDDEN") {
      return { message: t("bidPanel.errors.ownListing") };
    }

    if (code === "CONFLICT") {
      return { message: t("bidPanel.errors.selfOutbid") };
    }

    if (code === "VALIDATION_ERROR") {
      return { message: t("bidPanel.errors.invalidAmount") };
    }

    return { message: apiErr.message || t("bidPanel.errors.generic") };
  };

  // Open confirmation dialog
  const handleOpenDialog = (): void => {
    if (!parsedPoisha) {
      setMappedError({ message: t("bidPanel.errors.invalidAmount") });
      return;
    }

    if (parsedPoisha < minimumRequiredPerKg) {
      setMappedError({
        message: t("bidPanel.errors.bidTooLow", {
          min: `${formatPoisha(minimumRequiredPerKg)}/kg`,
        }),
        minimumRequiredPerKg,
      });
      return;
    }

    setMappedError(null);
    setIsDialogOpen(true);
  };

  // Confirm and submit bid
  const handleConfirmBid = async (): Promise<void> => {
    if (!parsedPoisha) return;

    try {
      const result = await placeBidMutation.mutateAsync({
        amountPerKg: parsedPoisha,
        idempotencyKey: intentKey,
      });

      setIsDialogOpen(false);
      setMappedError(null);
      // Generate a new idempotency key for future bids
      setIntentKey(crypto.randomUUID());
      onBidSuccess?.(result.data);
    } catch (err: unknown) {
      const mapped = mapApiError(err as MarketplaceApiError);
      setMappedError(mapped);
      // Notice: intentKey is NOT changed on retry failure, so retries reuse the SAME key!
    }
  };

  // One-tap bid minimum action
  const handleBidMinimum = (): void => {
    const targetMin = mappedError?.minimumRequiredPerKg ?? minimumRequiredPerKg;
    handleAmountChange(poishaToTaka(targetMin));
  };

  // Derive outbid gap in Taka
  const outbidGapPoisha = useMemo(() => {
    if (listing.myStatus !== BuyerListingStatus.OUTBID) return 0;
    const currentOrHighest = listing.currentBidPerKg ?? listing.highestBidPerKg ?? 0;
    const myHighest = listing.myHighestBidPerKg ?? 0;
    return Math.max(0, currentOrHighest - myHighest);
  }, [listing.myStatus, listing.currentBidPerKg, listing.highestBidPerKg, listing.myHighestBidPerKg]);

  const isActive = listing.status === ListingStatus.ACTIVE;
  const isWinning = listing.myStatus === BuyerListingStatus.WINNING;
  const isOutbid = listing.myStatus === BuyerListingStatus.OUTBID;
  const isNotBidding = listing.myStatus === BuyerListingStatus.NONE;

  // Validation rules for submit button
  const isValidBidAmount = Boolean(parsedPoisha);
  const canSubmitBid = isActive && isValidBidAmount && !isWinning;

  return (
    <div
      id="bid-panel"
      data-testid="bid-panel"
      className={cn(
        "rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm space-y-5",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">{t("bidPanel.title")}</h2>
          <p className="text-xs text-stone-500">{t("bidPanel.activeSubtitle")}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-stone-500 block">{t("bidPanel.minNextBid")}</span>
          <strong
            data-testid="min-next-bid-amount"
            className="text-base font-bold font-mono text-stone-900"
          >
            {formatPoisha(minimumRequiredPerKg)}
            <span className="text-xs font-normal text-stone-500">/kg</span>
          </strong>
        </div>
      </div>

      {/* Status Banner */}
      <div data-testid="bid-status-banner">
        {isActive && isWinning && (
          <div
            data-testid="status-winning-banner"
            className="flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs sm:text-sm font-semibold text-emerald-900 shadow-2xs"
          >
            <span className="text-base">🏆</span>
            <span>{t("bidPanel.status.winning")}</span>
          </div>
        )}

        {isActive && isOutbid && (
          <div
            data-testid="status-outbid-banner"
            className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs sm:text-sm font-semibold text-amber-900 shadow-2xs"
          >
            <span className="text-base">⚠️</span>
            <span>
              {t("bidPanel.status.outbid", { gap: formatPoisha(outbidGapPoisha) })}
            </span>
          </div>
        )}

        {isActive && isNotBidding && (
          <div
            data-testid="status-not-bidding-banner"
            className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600"
          >
            {t("bidPanel.status.notBidding")}
          </div>
        )}

        {!isActive && (
          <div
            data-testid="status-closed-banner"
            className="rounded-xl border border-stone-200 bg-stone-100 p-3.5 text-center text-sm font-semibold text-stone-700"
          >
            {listing.myStatus === BuyerListingStatus.WON
              ? t("bidPanel.status.won")
              : t("listingDetail.results.soldTitle")}
          </div>
        )}
      </div>

      {/* Active Auction Bidding Controls */}
      {isActive && (
        <>
          {/* Suggested Buttons */}
          {suggestedBids.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-700 block">
                {t("bidPanel.suggestedBids")}
              </span>
              <div
                data-testid="suggested-bids-container"
                className="grid grid-cols-3 gap-2"
              >
                {suggestedBids.map((suggestion) => {
                  const isSelected = parsedPoisha === suggestion.amountPerKg;
                  return (
                    <button
                      key={suggestion.label}
                      type="button"
                      data-testid={`suggested-bid-btn-${suggestion.label.toLowerCase().replace(/[^a-z0-9]/g, "")}`}
                      onClick={() => handleSelectSuggested(suggestion.amountPerKg)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary"
                          : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 hover:border-stone-300",
                      )}
                    >
                      <span className="text-xs font-bold">{suggestion.label}</span>
                      <span className="mt-0.5 font-mono text-xs sm:text-sm font-semibold">
                        {formatPoisha(suggestion.amountPerKg)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Amount Field */}
          <div className="space-y-2">
            <label
              htmlFor={inputId}
              className="text-xs font-semibold text-stone-700 block"
            >
              {t("bidPanel.customAmount")}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500 font-bold">
                ৳
              </div>
              <Input
                id={inputId}
                data-testid="custom-bid-input"
                type="text"
                inputMode="decimal"
                value={takaInput}
                placeholder={t("bidPanel.customAmountPlaceholder")}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-8 pr-14 text-base font-mono font-bold"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-stone-500 font-semibold">
                /kg
              </div>
            </div>
          </div>

          {/* Live Total Cost Preview */}
          <div
            data-testid="total-cost-preview-container"
            className="flex items-center justify-between rounded-xl bg-stone-50 p-3.5 border border-stone-200 text-sm"
          >
            <span className="text-stone-600 text-xs sm:text-sm">
              {t("bidPanel.totalCostPreview", { quantity: listing.quantityKg })}
            </span>
            <span
              data-testid="live-total-cost-preview"
              className="font-mono font-extrabold text-primary text-base sm:text-lg"
            >
              {liveTotalPoisha !== null ? formatPoisha(liveTotalPoisha) : "—"}
            </span>
          </div>

          {/* Error Message & One-Tap Bid Minimum */}
          {mappedError && (
            <div
              role="alert"
              data-testid="bid-error-banner"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✕</span>
                <span className="font-medium">{mappedError.message}</span>
              </div>

              {mappedError.minimumRequiredPerKg && (
                <div className="pt-1">
                  <Button
                    type="button"
                    data-testid="bid-minimum-btn"
                    onClick={handleBidMinimum}
                    className="w-full sm:w-auto h-9 text-xs bg-red-700 text-white hover:bg-red-800"
                  >
                    {t("bidPanel.errors.bidMinimumAction", {
                      min: `${formatPoisha(mappedError.minimumRequiredPerKg)}/kg`,
                    })}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Submit Button (Opens Binding Confirmation Dialog) */}
          <Button
            type="button"
            data-testid="place-bid-submit-btn"
            disabled={!canSubmitBid || placeBidMutation.isPending}
            onClick={handleOpenDialog}
            className="w-full bg-primary text-white font-bold py-3 text-base shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {placeBidMutation.isPending
              ? t("bidPanel.dialog.submitting")
              : isWinning
                ? t("bidPanel.status.winning")
                : t("bidPanel.placeBidButton")}
          </Button>
        </>
      )}

      {/* Confirmation Dialog */}
      <BindingBidDialog
        isOpen={isDialogOpen}
        isPending={placeBidMutation.isPending}
        pricePerKgInPoisha={parsedPoisha ?? minimumRequiredPerKg}
        quantityKg={listing.quantityKg}
        totalCostInPoisha={liveTotalPoisha ?? 0}
        onConfirm={handleConfirmBid}
        onClose={() => setIsDialogOpen(false)}
        error={mappedError?.message}
      />
    </div>
  );
}
