import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CropResponse,
  type FarmerListing,
  type FarmerListingListResponse,
  ListingStatus,
  UserRole,
  formatPoisha,
} from "@bazarbeat/shared";

import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { LiveBidIndicator } from "../../components/shared/live-bid-indicator.js";
import { PriceTag } from "../../components/shared/price-tag.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { useAuth } from "../auth/auth-context.js";
import { useListingStream } from "../realtime/use-listing-stream.js";
import {
  listingKeys,
  useAcceptCurrentBid,
  useCancelListing,
  useCrops,
  useListingBids,
  useMyListings,
  useRelistListing,
} from "./api/use-listing-wizard-api.js";

export type BiddingTab = "LIVE" | "ENDED";

interface ToastNotification {
  id: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Toast Container
// ---------------------------------------------------------------------------
function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}): ReactElement | null {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid="new-bid-toast"
          className="pointer-events-auto flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4 shadow-lg text-emerald-950 transition-all animate-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs sm:text-sm font-semibold">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="ml-2 text-emerald-700 hover:text-emerald-900 p-1 text-sm font-bold"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cancel Confirmation Dialog
// ---------------------------------------------------------------------------
function CancelConfirmDialog({
  isOpen,
  isPending,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}): ReactElement | null {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs"
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="cancel-confirm-dialog"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {t("cropBidding.cancelDialog.title", "Cancel this auction?")}
          </h2>
        </div>

        <p className="text-sm text-stone-600 leading-relaxed">
          {t(
            "cropBidding.cancelDialog.description",
            "Are you sure you want to cancel this auction? Since there are no bids, reserved crop stock will be released back to your available inventory.",
          )}
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            data-testid="cancel-dialog-close"
            disabled={isPending}
            onClick={onClose}
            className="w-full sm:w-auto bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200"
          >
            {t("cropBidding.cancelDialog.keep", "Keep Auction Active")}
          </Button>

          <Button
            type="button"
            data-testid="confirm-cancel-btn"
            disabled={isPending}
            onClick={onConfirm}
            className="w-full sm:w-auto bg-red-600 text-white hover:bg-red-700"
          >
            {isPending
              ? t("cropBidding.cancelDialog.cancelling", "Cancelling…")
              : t("cropBidding.cancelDialog.confirm", "Yes, Cancel Auction")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accept Confirmation Dialog
// ---------------------------------------------------------------------------
function AcceptConfirmDialog({
  listing,
  isOpen,
  isPending,
  onConfirm,
  onClose,
}: {
  listing: FarmerListing;
  isOpen: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}): ReactElement | null {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const currentBid = listing.currentBidPerKg ?? listing.floorPricePerKg;
  const totalAmount = currentBid * listing.quantityKg;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs"
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="accept-confirm-dialog"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-lg">
            ✓
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {t("cropBidding.acceptDialog.title", "Accept current highest bid?")}
          </h2>
        </div>

        <p className="text-sm text-stone-600 leading-relaxed">
          {t(
            "cropBidding.acceptDialog.description",
            "Are you sure you want to accept this bid now? The auction will close immediately and create an order at the current price.",
          )}
        </p>

        {/* Pricing confirmation card */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-stone-600">
              {t("cropBidding.acceptDialog.priceLabel", "Winning Price per kg:")}
            </span>
            <span className="font-bold text-foreground">
              <PriceTag amountPoisha={currentBid} size="md" />
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
            <span className="font-semibold text-stone-700">
              {t("cropBidding.acceptDialog.totalLabel", "Total Payout Value:")}
            </span>
            <span className="text-base font-extrabold text-primary">
              {formatPoisha(totalAmount)}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            data-testid="accept-dialog-close"
            disabled={isPending}
            onClick={onClose}
            className="w-full sm:w-auto bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200"
          >
            {t("cropBidding.acceptDialog.keep", "Continue Auction")}
          </Button>

          <Button
            type="button"
            data-testid="confirm-accept-btn"
            disabled={isPending}
            onClick={onConfirm}
            className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90"
          >
            {isPending
              ? t("cropBidding.acceptDialog.accepting", "Accepting…")
              : t("cropBidding.acceptDialog.confirm", "Yes, Accept Bid & Close")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relist Dialog
// ---------------------------------------------------------------------------
function RelistDialog({
  listing,
  cropName,
  isOpen,
  isPending,
  onConfirm,
  onClose,
}: {
  listing: FarmerListing;
  cropName: string;
  isOpen: boolean;
  isPending: boolean;
  onConfirm: (data: { floorPricePerKg: number; durationMinutes: number; pickupNote?: string }) => void;
  onClose: () => void;
}): ReactElement | null {
  const { t } = useTranslation();

  const suggestedFloor =
    listing.aiPriceGuidance.suggestedFloorPerKg ?? listing.floorPricePerKg;

  const [floorInput, setFloorInput] = useState<string>(
    (suggestedFloor / 100).toFixed(2),
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(180); // 3h default
  const [pickupNote, setPickupNote] = useState<string>(listing.pickupNote ?? "");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setFloorInput((suggestedFloor / 100).toFixed(2));
    setDurationMinutes(180);
    setPickupNote(listing.pickupNote ?? "");
    setInputError(null);
  }, [listing, suggestedFloor]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const parsedFloorBdt = parseFloat(floorInput);
    if (isNaN(parsedFloorBdt) || parsedFloorBdt <= 0) {
      setInputError(t("validation.fieldInvalid", "Enter a valid floor price greater than zero."));
      return;
    }

    const floorPricePerKg = Math.round(parsedFloorBdt * 100);
    onConfirm({
      floorPricePerKg,
      durationMinutes,
      pickupNote: pickupNote.trim() ? pickupNote.trim() : undefined,
    });
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs"
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="relist-dialog"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("cropBidding.relistDialog.title", "Relist Crop Auction")}
          </h2>
          <button
            type="button"
            data-testid="relist-dialog-close"
            disabled={isPending}
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 font-bold p-1 text-sm"
          >
            ✕
          </button>
        </div>

        <p className="text-xs sm:text-sm text-stone-600">
          {t(
            "cropBidding.relistDialog.description",
            "Create a new auction for your unsold produce with updated pricing and duration.",
          )}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Readonly Crop and Quantity info */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs sm:text-sm">
            <div>
              <span className="block text-muted-foreground font-medium">
                {t("cropBidding.relistDialog.cropLabel", "Crop")}:
              </span>
              <strong data-testid="relist-crop" className="text-foreground">
                {cropName}
              </strong>
            </div>
            <div>
              <span className="block text-muted-foreground font-medium">
                {t("cropBidding.relistDialog.quantityLabel", "Quantity")}:
              </span>
              <strong data-testid="relist-quantity" className="text-foreground">
                {listing.quantityKg} kg
              </strong>
            </div>
          </div>

          {/* Floor Price Input */}
          <div className="space-y-1">
            <label
              htmlFor="relist-floor-input"
              className="block text-xs font-bold text-foreground"
            >
              {t("cropBidding.relistDialog.floorPriceLabel", "Suggested Floor Price (৳/kg)")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-stone-500 font-bold text-sm">
                ৳
              </span>
              <Input
                id="relist-floor-input"
                data-testid="relist-floor-input"
                type="number"
                step="0.5"
                min="1"
                disabled={isPending}
                value={floorInput}
                onChange={(e) => {
                  setFloorInput(e.target.value);
                  setInputError(null);
                }}
                className="pl-8 text-sm font-semibold"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("cropBidding.relistDialog.suggestedFloorHint", {
                amount: (suggestedFloor / 100).toFixed(2),
              })}
            </p>
            {inputError && (
              <p className="text-xs text-red-600 font-semibold">{inputError}</p>
            )}
          </div>

          {/* Duration Presets */}
          <div className="space-y-1.5">
            <label
              htmlFor="relist-duration-select"
              className="block text-xs font-bold text-foreground"
            >
              {t("cropBidding.relistDialog.durationLabel", "Auction Duration")}
            </label>
            <select
              id="relist-duration-select"
              data-testid="relist-duration-select"
              value={durationMinutes}
              disabled={isPending}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full min-h-10 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>

          {/* Pickup note */}
          <div className="space-y-1">
            <label
              htmlFor="relist-pickup-note"
              className="block text-xs font-bold text-foreground"
            >
              {t("cropBidding.relistDialog.pickupNoteLabel", "Pickup Note (optional)")}
            </label>
            <Input
              id="relist-pickup-note"
              data-testid="relist-pickup-note"
              type="text"
              disabled={isPending}
              value={pickupNote}
              onChange={(e) => setPickupNote(e.target.value)}
              placeholder="e.g. Storage shed near main road"
              className="text-xs sm:text-sm"
            />
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-stone-200">
            <Button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="w-full sm:w-auto bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200"
            >
              {t("cropBidding.relistDialog.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="submit-relist-btn"
              disabled={isPending}
              className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90"
            >
              {isPending
                ? t("cropBidding.relistDialog.relisting", "Relisting…")
                : t("cropBidding.relistDialog.confirm", "Relist Now")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bid History Panel
// ---------------------------------------------------------------------------
function BidHistoryPanel({
  listingId,
}: {
  listingId: string;
}): ReactElement {
  const { t, i18n } = useTranslation();
  const bidsQuery = useListingBids(listingId);

  const bids = bidsQuery.data?.data ?? [];

  const timeFormatter = new Intl.DateTimeFormat(
    i18n.language === "bn" ? "bn-BD" : "en-BD",
    {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
      timeZone: "Asia/Dhaka",
    },
  );

  return (
    <div
      data-testid={`bid-history-panel-${listingId}`}
      className="mt-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3 space-y-2 text-xs"
    >
      <div className="flex items-center justify-between border-b border-stone-200/80 pb-1.5 font-bold text-stone-700">
        <span>{t("cropBidding.bidHistory", "Bid History")}</span>
        <span className="text-[11px] text-muted-foreground font-normal">
          {bids.length} {t("cropBidding.bidCount_other", { count: bids.length })}
        </span>
      </div>

      {bidsQuery.isLoading && (
        <div className="py-2 text-center text-muted-foreground">
          {t("auth.loading", "Loading bids…")}
        </div>
      )}

      {!bidsQuery.isLoading && bids.length === 0 && (
        <div className="py-2 text-center text-muted-foreground">
          {t("cropBidding.noHistory", "No bids placed yet for this auction.")}
        </div>
      )}

      {!bidsQuery.isLoading && bids.length > 0 && (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {bids.map((bid) => (
            <li
              key={bid.id}
              data-testid="bid-history-item"
              className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 border border-stone-200 shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">
                  {bid.bidderLabel}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {timeFormatter.format(new Date(bid.placedAt))}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-primary">
                  <PriceTag amountPoisha={bid.amountPerKg} size="sm" />
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({formatPoisha(bid.totalAmount)})
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Card
// ---------------------------------------------------------------------------
function LiveListingCard({
  listing,
  crop,
  onCancelClick,
  onAcceptClick,
  onNewBidToast,
}: {
  listing: FarmerListing;
  crop?: CropResponse;
  onCancelClick: (listing: FarmerListing) => void;
  onAcceptClick: (listing: FarmerListing) => void;
  onNewBidToast: (msg: string) => void;
}): ReactElement {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const cropName = crop
    ? i18n.language === "bn"
      ? crop.nameBn
      : crop.nameEn
    : "Crop";

  const firstImage =
    listing.images[0]?.url || crop?.imageUrl || "/images/crops/bitter-gourd.svg";

  // Reactive real-time stream subscription for live bid updates and toast notifications
  const stream = useListingStream({
    listingId: listing.id,
    enabled: listing.status === ListingStatus.ACTIVE,
    onBidPlaced: (patch) => {
      onNewBidToast(
        t("cropBidding.newBidToast", {
          crop: cropName,
          amount: formatPoisha(patch.amountPerKg),
          bidder: patch.bidderLabel,
        }),
      );
      // Reactive cache update for the listings list
      queryClient.setQueriesData<FarmerListingListResponse>(
        { queryKey: listingKeys.mineAll },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((item) =>
              item.id === patch.listingId
                ? {
                    ...item,
                    currentBidPerKg: patch.currentBidPerKg,
                    bidCount: patch.bidCount,
                  }
                : item,
            ),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: listingKeys.bids(listing.id) });
    },
    onAuctionExtended: (patch) => {
      queryClient.setQueriesData<FarmerListingListResponse>(
        { queryKey: listingKeys.mineAll },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((item) =>
              item.id === patch.listingId
                ? {
                    ...item,
                    endsAt: patch.endsAt,
                    extensionCount: patch.extensionCount,
                  }
                : item,
            ),
          };
        },
      );
    },
    onAuctionClosed: (patch) => {
      queryClient.setQueriesData<FarmerListingListResponse>(
        { queryKey: listingKeys.mineAll },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((item) =>
              item.id === patch.listingId
                ? {
                    ...item,
                    status: patch.status,
                    closedAt: patch.closedAt,
                  }
                : item,
            ),
          };
        },
      );
    },
  });

  const hasBids = listing.bidCount > 0 && Boolean(listing.currentBidPerKg);

  return (
    <div
      data-testid={`live-listing-card-${listing.id}`}
      className="flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div>
        {/* Photo and Badges */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
          <img
            src={firstImage}
            alt={cropName}
            className="h-full w-full object-cover"
          />
          <div className="absolute top-2.5 right-2.5">
            <LiveBidIndicator
              bidCount={listing.bidCount}
              isLive={stream.isConnected}
              showStatusText={true}
              size="sm"
            />
          </div>
          <div className="absolute bottom-2.5 left-2.5">
            <GradeBadge grade={listing.aiAssessment.grade} size="sm" />
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-foreground leading-tight">
              {cropName}
            </h3>
            <span
              data-testid={`quantity-${listing.id}`}
              className="text-xs font-semibold text-stone-500 whitespace-nowrap"
            >
              {listing.quantityKg} kg
            </span>
          </div>

          {/* Pricing Row: Floor vs Large Current Price */}
          <div className="rounded-xl border border-stone-100 bg-stone-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("cropBidding.floorPrice", "Floor:")}</span>
              <span data-testid={`floor-price-${listing.id}`}>
                <PriceTag amountPoisha={listing.floorPricePerKg} size="sm" />
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t border-stone-200/60">
              <span className="text-xs font-bold text-stone-700">
                {t("cropBidding.currentPrice", "Current highest:")}
              </span>
              <div
                data-testid={`current-price-${listing.id}`}
                className="text-2xl font-black text-primary"
              >
                {listing.currentBidPerKg ? (
                  <PriceTag amountPoisha={listing.currentBidPerKg} size="lg" />
                ) : (
                  <span className="text-sm font-semibold text-stone-500">
                    {t("cropBidding.noBidsYet", "No bids yet")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bid Count and Countdown Timer */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <div data-testid={`bid-count-${listing.id}`}>
              <LiveBidIndicator
                bidCount={listing.bidCount}
                isLive={stream.isConnected}
                showStatusText={false}
                size="sm"
              />
            </div>

            <div>
              <CountdownTimer
                endsAt={listing.endsAt}
                status={listing.status}
                size="sm"
                showIcon={true}
              />
            </div>
          </div>

          {/* Bid History Toggle */}
          <button
            type="button"
            data-testid={`toggle-bid-history-${listing.id}`}
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full text-center text-xs font-semibold text-stone-600 hover:text-primary transition-colors py-1"
          >
            {showHistory
              ? t("cropBidding.hideHistory", "Hide History")
              : `${t("cropBidding.viewHistory", "View Bid History")} (${listing.bidCount})`}
          </button>

          {/* Expandable Bid History Panel */}
          {showHistory && <BidHistoryPanel listingId={listing.id} />}
        </div>
      </div>

      {/* Action Controls */}
      <div className="p-4 pt-1 border-t border-stone-100">
        {!hasBids && (
          <Button
            type="button"
            data-testid={`cancel-listing-btn-${listing.id}`}
            onClick={() => onCancelClick(listing)}
            className="w-full bg-white text-red-600 border border-red-200 hover:bg-red-50 text-xs sm:text-sm font-bold min-h-11"
          >
            {t("cropBidding.actions.cancel", "Cancel Auction")}
          </Button>
        )}

        {hasBids && (
          <Button
            type="button"
            data-testid={`accept-now-btn-${listing.id}`}
            onClick={() => onAcceptClick(listing)}
            className="w-full bg-primary text-white hover:bg-primary/90 text-xs sm:text-sm font-bold min-h-11"
          >
            {t("cropBidding.actions.acceptNow", "Accept Now")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ended Card
// ---------------------------------------------------------------------------
function EndedListingCard({
  listing,
  crop,
  onRelistClick,
}: {
  listing: FarmerListing;
  crop?: CropResponse;
  onRelistClick: (listing: FarmerListing) => void;
}): ReactElement {
  const { t, i18n } = useTranslation();

  const cropName = crop
    ? i18n.language === "bn"
      ? crop.nameBn
      : crop.nameEn
    : "Crop";

  const firstImage =
    listing.images[0]?.url || crop?.imageUrl || "/images/crops/bitter-gourd.svg";

  const isSold = listing.status === ListingStatus.SOLD;
  const isUnsold = listing.status === ListingStatus.EXPIRED_UNSOLD;
  const isCancelled = listing.status === ListingStatus.CANCELLED;

  return (
    <div
      data-testid={`ended-listing-card-${listing.id}`}
      className="flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xs"
    >
      <div>
        {/* Photo and Badges */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
          <img
            src={firstImage}
            alt={cropName}
            className="h-full w-full object-cover grayscale-25"
          />
          <div className="absolute top-2.5 right-2.5">
            <span
              data-testid={`status-badge-${listing.status}`}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                isSold
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : isUnsold
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-stone-100 text-stone-700 border-stone-300"
              }`}
            >
              {t(`listings.status.${listing.status}`)}
            </span>
          </div>
          <div className="absolute bottom-2.5 left-2.5">
            <GradeBadge grade={listing.aiAssessment.grade} size="sm" />
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-foreground leading-tight">
              {cropName}
            </h3>
            <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">
              {listing.quantityKg} kg
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("cropBidding.floorPrice", "Floor:")}</span>
            <PriceTag amountPoisha={listing.floorPricePerKg} size="sm" />
          </div>

          {/* Outcome Section */}
          {isSold && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-1 text-xs">
              <div
                data-testid={`winning-price-${listing.id}`}
                className="flex items-baseline justify-between"
              >
                <span className="font-semibold text-blue-900">
                  {t("cropBidding.sold.winningPrice", "Winning Price:")}
                </span>
                <PriceTag
                  amountPoisha={listing.currentBidPerKg ?? listing.floorPricePerKg}
                  size="md"
                />
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-blue-200/60 text-[11px] text-blue-800">
                <span>{t("cropBidding.acceptDialog.totalLabel", "Total Payout Value:")}</span>
                <span className="font-bold">
                  {formatPoisha(
                    (listing.currentBidPerKg ?? listing.floorPricePerKg) *
                      listing.quantityKg,
                  )}
                </span>
              </div>
            </div>
          )}

          {isUnsold && (
            <div
              data-testid={`unsold-notice-${listing.id}`}
              className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-1.5 text-xs text-amber-950"
            >
              <p className="font-bold">
                {t(
                  "cropBidding.unsold.message",
                  "Not sold. Sell at your local market, or relist.",
                )}
              </p>
              <p className="text-[11px] text-amber-800 leading-snug">
                {t(
                  "cropBidding.unsold.fallbackHint",
                  "You can still sell this crop at your local market with zero platform risk, or relist with an adjusted floor price.",
                )}
              </p>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
              <p className="font-semibold">
                {t(
                  "cropBidding.cancelled.message",
                  "This auction was cancelled. Stock was returned to inventory.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 pt-0">
        {isSold && (
          <Link
            to="/farmer/orders"
            data-testid={`view-order-link-${listing.id}`}
            className="inline-flex w-full min-h-11 items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            {t("cropBidding.sold.viewOrder", "View Order")} →
          </Link>
        )}

        {isUnsold && (
          <Button
            type="button"
            data-testid={`relist-btn-${listing.id}`}
            onClick={() => onRelistClick(listing)}
            className="w-full bg-primary text-white hover:bg-primary/90 text-xs sm:text-sm font-bold min-h-11"
          >
            {t("cropBidding.actions.relist", "Relist Auction")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Crop Bidding Page
// ---------------------------------------------------------------------------
export function CropBiddingPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<BiddingTab>("LIVE");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Action dialog states
  const [cancelTargetListing, setCancelTargetListing] = useState<FarmerListing | null>(null);
  const [acceptTargetListing, setAcceptTargetListing] = useState<FarmerListing | null>(null);
  const [relistTargetListing, setRelistTargetListing] = useState<FarmerListing | null>(null);

  // Queries and mutations
  const cropsQuery = useCrops();
  const listingsQuery = useMyListings({ page: 1, limit: 50 });

  const cancelMutation = useCancelListing();
  const acceptMutation = useAcceptCurrentBid();
  const relistMutation = useRelistListing();

  const addToast = (message: string): void => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Forbidden check: only farmers can access
  if (user && user.role !== UserRole.FARMER) {
    return (
      <div
        data-testid="bidding-forbidden"
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-3"
      >
        <h2 className="text-lg font-bold text-red-950">
          {t("cropBidding.forbidden", "Access forbidden. Crop bidding is only accessible to farmers.")}
        </h2>
        <p className="text-sm text-red-800">
          {t("cropBidding.loginAsFarmer", "Please log in with a farmer account.")}
        </p>
      </div>
    );
  }

  // Handle cancel execution
  const handleConfirmCancel = async (): Promise<void> => {
    if (!cancelTargetListing) return;
    try {
      await cancelMutation.mutateAsync(cancelTargetListing.id);
      setCancelTargetListing(null);
    } catch {
      // Errors handled via mutation error state / toast
    }
  };

  // Handle accept execution
  const handleConfirmAccept = async (): Promise<void> => {
    if (!acceptTargetListing) return;
    try {
      await acceptMutation.mutateAsync(acceptTargetListing.id);
      setAcceptTargetListing(null);
    } catch {
      // Errors handled via mutation error state / toast
    }
  };

  // Handle relist execution
  const handleConfirmRelist = async (data: {
    floorPricePerKg: number;
    durationMinutes: number;
    pickupNote?: string;
  }): Promise<void> => {
    if (!relistTargetListing) return;
    try {
      await relistMutation.mutateAsync({
        id: relistTargetListing.id,
        input: data,
      });
      setRelistTargetListing(null);
      setActiveTab("LIVE");
    } catch {
      // Errors handled via mutation error state
    }
  };

  const crops = cropsQuery.data ?? [];
  const allListings = listingsQuery.data?.data ?? [];

  const liveListings = allListings.filter((l) => l.status === ListingStatus.ACTIVE);
  const endedListings = allListings.filter((l) => l.status !== ListingStatus.ACTIVE);

  const displayedListings = activeTab === "LIVE" ? liveListings : endedListings;

  return (
    <div data-testid="crop-bidding-page" className="space-y-6">
      {/* Toast Notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t("cropBidding.title", "Crop Bidding")}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {t(
              "cropBidding.subtitle",
              "Manage your live produce auctions and review bidding results.",
            )}
          </p>
        </div>

        <Link
          to="/farmer/new-listing"
          data-testid="create-new-listing-btn"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition-all"
        >
          + {t("cropBidding.createNew", "New Listing")}
        </Link>
      </div>

      {/* Tabs for Live and Ended */}
      <div
        data-testid="bidding-tabs"
        role="tablist"
        aria-label="Auction tabs"
        className="flex items-center gap-2 border-b border-stone-200 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "LIVE"}
          data-testid="bidding-tab-live"
          onClick={() => setActiveTab("LIVE")}
          className={`min-h-11 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === "LIVE"
              ? "bg-primary text-white shadow-2xs"
              : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          {t("cropBidding.tabs.live", "Live Auctions")} ({liveListings.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ENDED"}
          data-testid="bidding-tab-ended"
          onClick={() => setActiveTab("ENDED")}
          className={`min-h-11 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === "ENDED"
              ? "bg-primary text-white shadow-2xs"
              : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          {t("cropBidding.tabs.ended", "Ended Auctions")} ({endedListings.length})
        </button>
      </div>

      {/* Loading State */}
      {listingsQuery.isLoading && (
        <div
          role="status"
          data-testid="bidding-loading"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-72 animate-pulse rounded-2xl border border-stone-200 bg-stone-100"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {listingsQuery.isError && (
        <div
          data-testid="bidding-error"
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center space-y-3"
        >
          <p className="text-sm font-bold text-red-950">
            {t(
              "cropBidding.loadError",
              "Could not load bidding data. Check your connection and try again.",
            )}
          </p>
          <Button
            type="button"
            data-testid="bidding-retry-btn"
            className="w-auto inline-flex"
            onClick={() => void listingsQuery.refetch()}
          >
            {t("cropBidding.retry", "Try again")}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!listingsQuery.isLoading && !listingsQuery.isError && displayedListings.length === 0 && (
        <div
          data-testid="bidding-empty"
          className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 sm:p-12 text-center space-y-4"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-2xl">
            {activeTab === "LIVE" ? "⚡" : "📦"}
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {activeTab === "LIVE"
                ? t("cropBidding.emptyLive", "No live auctions")
                : t("cropBidding.emptyEnded", "No ended auctions")}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {activeTab === "LIVE"
                ? t(
                    "cropBidding.emptyLiveDesc",
                    "You don't have any active auctions right now. Create a new listing to start receiving bids.",
                  )
                : t(
                    "cropBidding.emptyEndedDesc",
                    "You don't have any completed or expired auctions yet.",
                  )}
            </p>
          </div>
          {activeTab === "LIVE" && (
            <Link
              to="/farmer/new-listing"
              data-testid="empty-create-listing-btn"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90"
            >
              + {t("cropBidding.createNew", "New Listing")}
            </Link>
          )}
        </div>
      )}

      {/* Cards Grid */}
      {!listingsQuery.isLoading && !listingsQuery.isError && displayedListings.length > 0 && (
        <div
          data-testid="bidding-cards-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayedListings.map((listing) => {
            const crop = crops.find((c) => c.id === listing.cropId);

            if (activeTab === "LIVE") {
              return (
                <LiveListingCard
                  key={listing.id}
                  listing={listing}
                  crop={crop}
                  onCancelClick={(target) => setCancelTargetListing(target)}
                  onAcceptClick={(target) => setAcceptTargetListing(target)}
                  onNewBidToast={addToast}
                />
              );
            }

            return (
              <EndedListingCard
                key={listing.id}
                listing={listing}
                crop={crop}
                onRelistClick={(target) => setRelistTargetListing(target)}
              />
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelTargetListing && (
        <CancelConfirmDialog
          isOpen={Boolean(cancelTargetListing)}
          isPending={cancelMutation.isPending}
          onConfirm={() => void handleConfirmCancel()}
          onClose={() => setCancelTargetListing(null)}
        />
      )}

      {/* Accept Confirmation Dialog */}
      {acceptTargetListing && (
        <AcceptConfirmDialog
          listing={acceptTargetListing}
          isOpen={Boolean(acceptTargetListing)}
          isPending={acceptMutation.isPending}
          onConfirm={() => void handleConfirmAccept()}
          onClose={() => setAcceptTargetListing(null)}
        />
      )}

      {/* Relist Dialog */}
      {relistTargetListing && (
        <RelistDialog
          listing={relistTargetListing}
          cropName={(() : string => {
            const c = crops.find((cr) => cr.id === relistTargetListing.cropId);
            return c
              ? i18n.language === "bn"
                ? c.nameBn
                : c.nameEn
              : "Crop";
          })()}
          isOpen={Boolean(relistTargetListing)}
          isPending={relistMutation.isPending}
          onConfirm={(data) => void handleConfirmRelist(data)}
          onClose={() => setRelistTargetListing(null)}
        />
      )}
    </div>
  );
}

export default CropBiddingPage;
