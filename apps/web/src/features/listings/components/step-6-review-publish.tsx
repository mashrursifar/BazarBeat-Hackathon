import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatPoisha } from "@bazarbeat/shared";

import { GradeBadge } from "../../../components/shared/grade-badge.js";
import { PriceTag } from "../../../components/shared/price-tag.js";
import { Button } from "../../../components/ui/button.js";
import { ApiError } from "../api/listing-api.js";
import { useCreateListing } from "../api/use-listing-wizard-api.js";
import { useListingWizard } from "../context/listing-wizard-context.js";

export function Step6ReviewPublish(): ReactElement {
  const { t, i18n } = useTranslation();
  const {
    selectedCrop,
    assessmentResult,
    floorPricePerKg,
    quantityKg,
    durationMinutes,
    pickupNote,
    createdListing,
    setCreatedListing,
    clearDraft,
    reset,
    setStep,
  } = useListingWizard();

  const createListingMutation = useCreateListing();
  const [publishError, setPublishError] = useState<string | null>(null);

  const localizedCropName = selectedCrop
    ? i18n.language === "bn"
      ? selectedCrop.nameBn
      : selectedCrop.nameEn
    : "";

  const handlePublish = async (): Promise<void> => {
    if (!selectedCrop || !assessmentResult) return;
    setPublishError(null);

    try {
      const response = await createListingMutation.mutateAsync({
        cropId: selectedCrop.id,
        assessmentToken: assessmentResult.assessmentToken,
        quantityKg,
        floorPricePerKg,
        durationMinutes,
        ...(pickupNote.trim() ? { pickupNote: pickupNote.trim() } : {}),
      });

      // Clear the session storage draft on successful publish
      clearDraft();
      setCreatedListing(response.data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "INSUFFICIENT_STOCK") {
          setPublishError(
            t(
              "wizard.publishErrorInsufficientStock",
              "You do not have enough available stock for this listing.",
            ),
          );
        } else if (err.code === "CONFLICT") {
          setPublishError(
            t(
              "wizard.publishErrorConflict",
              "This assessment token has already been used or expired. Please retake photos.",
            ),
          );
        } else if (err.code === "VALIDATION_ERROR") {
          setPublishError(
            t("wizard.publishErrorValidation", "Please check your inputs and try again."),
          );
        } else {
          setPublishError(err.message || t("wizard.publishFailed", "Could not publish listing."));
        }
      } else if (err instanceof Error) {
        setPublishError(err.message);
      } else {
        setPublishError(t("wizard.publishFailed", "Could not publish listing."));
      }
    }
  };

  // SUCCESS SCREEN: Shown ONLY AFTER the server confirms creation
  if (createdListing) {
    const dateFormatter = new Intl.DateTimeFormat(
      i18n.language === "bn" ? "bn-BD" : "en-BD",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Dhaka",
      },
    );

    return (
      <div data-testid="publish-success-screen" className="space-y-6 py-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 shadow-sm">
          ✓
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {t("wizard.publishSuccessTitle", "Listing published successfully!")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t(
              "wizard.publishSuccessDesc",
              "Your auction is now LIVE for buyers to bid on.",
            )}
          </p>
        </div>

        {/* Listing details card */}
        <div className="mx-auto max-w-md rounded-xl border border-stone-200 bg-stone-50/70 p-5 text-left space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <span className="text-sm font-bold text-foreground">{localizedCropName}</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              {createdListing.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <span className="block text-muted-foreground">{t("wizard.summaryQuantity", "Quantity")}</span>
              <span className="font-bold text-foreground">{createdListing.quantityKg} kg</span>
            </div>
            <div>
              <span className="block text-muted-foreground">{t("wizard.summaryFloorPrice", "Floor Price")}</span>
              <PriceTag amountPoisha={createdListing.floorPricePerKg} size="sm" />
            </div>
            <div>
              <span className="block text-muted-foreground">{t("wizard.startsAt", "Started at:")}</span>
              <span className="font-medium text-foreground">
                {dateFormatter.format(new Date(createdListing.startsAt))}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">{t("wizard.endsAt", "Ends at:")}</span>
              <span className="font-medium text-foreground">
                {dateFormatter.format(new Date(createdListing.endsAt))}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            to="/farmer/crop-bidding"
            data-testid="success-crop-bidding-link"
            className="w-full sm:w-auto inline-flex items-center justify-center min-h-12 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary/90"
          >
            {t("wizard.viewCropBidding", "Go to Crop Bidding")} →
          </Link>

          <Link
            to="/farmer/products"
            data-testid="success-my-listings-link"
            className="w-full sm:w-auto inline-flex items-center justify-center min-h-12 rounded-xl bg-white px-5 py-3 text-sm font-bold text-stone-700 border border-stone-300 shadow-2xs hover:bg-stone-50"
          >
            {t("wizard.viewMyListings", "View My Listings")}
          </Link>

          <Button
            type="button"
            data-testid="create-another-btn"
            onClick={reset}
            className="w-full sm:w-auto bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200"
          >
            {t("wizard.createAnother", "Create Another Listing")}
          </Button>
        </div>
      </div>
    );
  }

  // REVIEW & PUBLISH SUMMARY SCREEN
  const totalFloorValuePoisha = floorPricePerKg * quantityKg;
  const durationHours = Math.round(durationMinutes / 60);

  return (
    <div data-testid="step-6-review-publish" className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("wizard.step6Title", "Review & Publish Listing")}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t(
            "wizard.step6Subtitle",
            "Verify all listing details before launching your live auction.",
          )}
        </p>
      </div>

      {/* Summary Card */}
      <div
        data-testid="review-summary-card"
        className="rounded-xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {t("wizard.summaryCrop", "Crop")}
            </span>
            <span className="text-lg sm:text-xl font-bold text-foreground">
              {localizedCropName}
            </span>
          </div>

          {assessmentResult && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">
                {t("wizard.summaryGrade", "AI Quality Grade")}:
              </span>
              <GradeBadge grade={assessmentResult.grade} size="sm" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="block text-xs text-muted-foreground font-medium">
              {t("wizard.summaryQuantity", "Quantity")}
            </span>
            <span className="text-base font-bold text-foreground">
              {quantityKg} kg
            </span>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground font-medium">
              {t("wizard.summaryFloorPrice", "Floor Price")}
            </span>
            <PriceTag amountPoisha={floorPricePerKg} size="md" />
          </div>

          <div>
            <span className="block text-xs text-muted-foreground font-medium">
              {t("wizard.summaryTotalFloorValue", "Minimum Total Value")}
            </span>
            <span className="text-base font-extrabold text-foreground">
              {formatPoisha(totalFloorValuePoisha)}
            </span>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground font-medium">
              {t("wizard.summaryDuration", "Duration")}
            </span>
            <span className="text-base font-bold text-foreground">
              {durationHours} {i18n.language === "bn" ? "ঘণ্টা" : "hours"}
            </span>
          </div>

          {pickupNote && (
            <div className="col-span-2">
              <span className="block text-xs text-muted-foreground font-medium">
                {t("wizard.summaryPickupNote", "Pickup Note")}
              </span>
              <span className="text-xs text-stone-700 italic">
                {pickupNote}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {publishError && (
        <div
          data-testid="publish-error-banner"
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs sm:text-sm text-red-950 flex items-start gap-2 shadow-2xs"
        >
          <span className="text-base">⚠️</span>
          <div className="space-y-1">
            <span className="font-bold">{publishError}</span>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-stone-200">
        <Button
          type="button"
          data-testid="step-6-back"
          disabled={createListingMutation.isPending}
          onClick={() => setStep(5)}
          className="w-full sm:w-auto bg-white text-stone-700 hover:bg-stone-100 border border-stone-300"
        >
          ← {t("wizard.backToQuantity", "Back to Quantity & Timer")}
        </Button>

        <Button
          type="button"
          data-testid="publish-listing-btn"
          disabled={createListingMutation.isPending}
          onClick={() => void handlePublish()}
          className="w-full sm:w-auto min-w-[200px] bg-primary text-white hover:bg-primary/90"
        >
          {createListingMutation.isPending
            ? t("wizard.publishing", "Publishing listing…")
            : t("wizard.publishListing", "Publish Listing")}
        </Button>
      </div>
    </div>
  );
}
