import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BuyerListingStatus, ListingStatus, formatPoisha } from "@bazarbeat/shared";

import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { DemoAiChip } from "../../components/shared/demo-ai-chip.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { PriceTag } from "../../components/shared/price-tag.js";
import { WatchlistButton } from "../watchlist/components/watchlist-button.js";
import { Button } from "../../components/ui/button.js";
import { formatLocalizedNumber } from "../../lib/format.js";
import { renderGradingReason } from "../ai-reasons/ai-reason-text.js";
import { useListingStream } from "../realtime/use-listing-stream.js";
import { useBuyerListingDetail, useListingBids } from "./api/use-buyer-listing.js";
import { AiMarketRangeVisual } from "./components/ai-market-range-visual.js";
import { AnonymizedBidHistory } from "./components/anonymized-bid-history.js";
import { BidPanel } from "./components/bid-panel.js";
import { PhotoGallery } from "./components/photo-gallery.js";

export function BuyerListingDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const { data: detailResponse, isLoading, isError, refetch } = useBuyerListingDetail(id);

  const { data: bidsResponse, isLoading: isBidsLoading, refetch: refetchBids } = useListingBids(id);

  const listing = detailResponse?.data;

  // Real-time SSE listing stream (the only stream in the buyer app)
  useListingStream({
    listingId: id,
    enabled: listing?.status === ListingStatus.ACTIVE,
    onBidPlaced: (patch) => {
      setLiveAnnouncement(
        t("realtime.newBidPlaced", { amount: `${formatPoisha(patch.amountPerKg)}/kg` }),
      );
      void refetchBids();
      void refetch();
    },
    onAuctionExtended: () => {
      setLiveAnnouncement(t("realtime.auctionExtended"));
    },
    onAuctionClosed: (patch) => {
      setLiveAnnouncement(t("realtime.auctionClosed", { status: patch.status }));
      void refetchBids();
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <main
        data-testid="listing-detail-loading"
        className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6"
      >
        <div className="h-6 w-32 rounded bg-stone-200 animate-pulse" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div className="aspect-4/3 w-full rounded-2xl bg-stone-200 animate-pulse" />
            <div className="h-28 rounded-2xl bg-stone-200 animate-pulse" />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <div className="h-40 rounded-2xl bg-stone-200 animate-pulse" />
            <div className="h-72 rounded-2xl bg-stone-200 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (isError || !listing) {
    return (
      <main
        data-testid="listing-detail-error"
        className="mx-auto max-w-xl p-8 text-center space-y-4 my-16"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl font-bold">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-stone-900">{t("listingDetail.errorTitle")}</h1>
        <p className="text-sm text-stone-600">{t("listingDetail.errorSubtitle")}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={() => void refetch()}>{t("listingDetail.retry")}</Button>
          <Button
            type="button"
            className="bg-stone-100 text-stone-700 hover:bg-stone-200"
            onClick={() => navigate("/buyer/marketplace")}
          >
            {t("listingDetail.backToMarketplace")}
          </Button>
        </div>
      </main>
    );
  }

  const cropName = isBangla ? listing.crop.nameBn : listing.crop.nameEn;
  const isActive = listing.status === ListingStatus.ACTIVE;
  const isSold = listing.status === ListingStatus.SOLD;
  const isExpired = listing.status === ListingStatus.EXPIRED_UNSOLD;
  const isCancelled = listing.status === ListingStatus.CANCELLED;
  const isWon = listing.myStatus === BuyerListingStatus.WON;

  const scrollToBidPanel = (): void => {
    const el = document.getElementById("bid-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      const input = el.querySelector<HTMLInputElement>("input[type='text']");
      input?.focus();
    }
  };

  return (
    <main
      data-testid="buyer-listing-detail-page"
      className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6 pb-24 md:pb-8"
    >
      {/* Polite Live Region for Price Updates (Screen Reader Accessibility) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="live-price-polite-announcement"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/buyer/marketplace"
          data-testid="back-to-marketplace-link"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <span aria-hidden="true">←</span>
          <span>{t("listingDetail.backToMarketplace")}</span>
        </Link>

        <div className="flex items-center gap-2">
          <WatchlistButton
            listingId={listing.id}
            initialIsWatched={Boolean(listing.isWatched)}
            showLabel={true}
            size="md"
            className="border border-stone-200 px-3 bg-white"
          />
          <DemoAiChip size="md" provider={listing.provider} degraded={listing.degraded} />
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Left Column: Visuals, AI Grade, Range, Bid History */}
        <section className="lg:col-span-7 space-y-6">
          {/* Photo Gallery */}
          <PhotoGallery images={listing.images} cropName={cropName} />

          {/* AI Quality Assessment Card */}
          <div
            data-testid="ai-quality-card"
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                <GradeBadge grade={listing.grade} size="lg" />

                {/* AI-assessed Tooltip */}
                <div
                  data-testid="ai-assessed-tooltip"
                  title={
                    listing.provider?.toLowerCase() === "gemini" && !listing.degraded
                      ? t("listingDetail.aiAssessedTooltipGemini")
                      : t("listingDetail.aiAssessedTooltip")
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700 cursor-help select-none"
                >
                  <span>✨</span>
                  <span>
                    {listing.provider?.toLowerCase() === "gemini" && !listing.degraded
                      ? t("listingDetail.aiAssessedGemini")
                      : t("listingDetail.aiAssessed")}
                  </span>
                </div>
              </div>

              {/* Confidence Band */}
              {listing.confidenceBand && (
                <span
                  data-testid="confidence-band-badge"
                  className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800"
                >
                  {listing.confidenceBand === "HIGH" && t("listingDetail.confidenceHigh")}
                  {listing.confidenceBand === "MEDIUM" && t("listingDetail.confidenceMedium")}
                  {listing.confidenceBand === "LOW" && t("listingDetail.confidenceLow")}
                </span>
              )}
            </div>

            {/* Quality Observations & Reasons */}
            {listing.reasons.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  {t("listingDetail.reasonsTitle")}
                </h4>
                <div data-testid="quality-reasons-list" className="flex flex-wrap gap-2">
                  {listing.reasons.map((reason, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800"
                    >
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{renderGradingReason(reason, t)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Offline degraded model notice if applicable */}
            {listing.degraded && (
              <div
                data-testid="degraded-mode-notice"
                className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 font-medium"
              >
                {t("listingDetail.degradedMode")}
              </div>
            )}
          </div>

          {/* AI Market Guidance Visual */}
          <AiMarketRangeVisual
            snapshot={listing.aiPriceSnapshot}
            currentPricePerKg={listing.displayPricePerKg}
            floorPricePerKg={listing.floorPricePerKg}
            hasBids={listing.bidCount > 0}
          />

          {/* Anonymized Bid History */}
          <AnonymizedBidHistory bids={bidsResponse?.data ?? []} isLoading={isBidsLoading} />
        </section>

        {/* Right Column: Pricing, Countdown, Lot Details, Bid Panel / Result State */}
        <section className="lg:col-span-5 space-y-6">
          {/* Main Price & Countdown Card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            {/* Header: Crop Title & Location */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {cropName}
              </span>
              <h1 className="text-2xl font-extrabold text-stone-900 sm:text-3xl mt-0.5">
                {cropName}
              </h1>
              <p
                data-testid="farmer-region-text"
                className="text-sm text-stone-500 font-medium mt-1 flex items-center gap-1"
              >
                <span>📍</span>
                <span className="capitalize">{listing.location.district}</span>,{" "}
                <span className="capitalize">{listing.location.division}</span>
              </p>
            </div>

            {/* Countdown Timer with Phase 4 states */}
            <div className="flex items-center justify-between border-y border-stone-100 py-3">
              <span className="text-xs font-semibold text-stone-600">
                {t("listingDetail.timeRemaining")}
              </span>
              <CountdownTimer
                endsAt={listing.endsAt}
                status={listing.status}
                size="lg"
                showIcon
                showLabel
              />
            </div>

            {/* Dynamic Price Section with aria-live="polite" */}
            <div
              aria-live="polite"
              data-testid="live-price-container"
              className="rounded-xl bg-stone-50 p-4 border border-stone-200 space-y-1"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-stone-600">
                  {listing.bidCount > 0
                    ? t("listingDetail.currentHighestBid")
                    : t("listingDetail.openingFloor")}
                </span>
                <span
                  data-testid="bid-count-indicator"
                  className="text-xs font-bold text-stone-600"
                >
                  {t("listingDetail.bidsCount", { count: listing.bidCount })}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <PriceTag
                  amountPoisha={listing.displayPricePerKg}
                  unit="kg"
                  size="lg"
                  className="font-extrabold"
                />
              </div>

              <div className="text-xs text-stone-500 font-medium pt-1">
                {t("bidPanel.totalCostPreview", { quantity: listing.quantityKg })}{" "}
                <strong className="font-mono text-stone-800 font-bold">
                  {formatPoisha(listing.displayTotalCost)}
                </strong>
              </div>
            </div>

            {/* Key Lot Attributes Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <span className="text-stone-500 block">{t("listingDetail.lotQuantity")}</span>
                <strong
                  data-testid="lot-quantity-text"
                  className="text-stone-900 font-bold text-sm block mt-0.5"
                >
                  {formatLocalizedNumber(listing.quantityKg, isBangla)} kg
                </strong>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <span className="text-stone-500 block">{t("listingDetail.minIncrement")}</span>
                <strong className="text-stone-900 font-bold text-sm font-mono block mt-0.5">
                  {formatPoisha(listing.minIncrementPerKg)}/kg
                </strong>
              </div>
            </div>
          </div>

          {/* Auction Result State (When closed) */}
          {!isActive && (
            <div
              data-testid="auction-result-card"
              className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
            >
              {isSold && isWon && (
                <div
                  data-testid="result-won-state"
                  className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎉</span>
                    <h3 className="text-base font-bold text-emerald-900">
                      {t("listingDetail.results.wonTitle")}
                    </h3>
                  </div>
                  <p className="text-xs text-emerald-800">
                    {t("listingDetail.results.wonSubtitle")}
                  </p>
                  <div className="pt-2">
                    <Button
                      type="button"
                      data-testid="view-won-order-btn"
                      onClick={() => navigate("/buyer/orders")}
                      className="bg-emerald-700 text-white hover:bg-emerald-800"
                    >
                      {t("listingDetail.results.viewOrder")}
                    </Button>
                  </div>
                </div>
              )}

              {isSold && !isWon && (
                <div
                  data-testid="result-sold-state"
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-stone-800 space-y-1"
                >
                  <h3 className="text-base font-bold text-stone-900">
                    {t("listingDetail.results.soldTitle")}
                  </h3>
                  <p className="text-xs text-stone-600">
                    {t("listingDetail.results.soldSubtitle")}
                  </p>
                  <div className="mt-2 text-xs font-mono">
                    <span>{t("listingDetail.results.winningPrice")} </span>
                    <strong className="text-stone-900">
                      {formatPoisha(listing.displayPricePerKg)}/kg
                    </strong>
                  </div>
                </div>
              )}

              {isExpired && (
                <div
                  data-testid="result-unsold-state"
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-stone-800 space-y-1"
                >
                  <h3 className="text-base font-bold text-stone-900">
                    {t("listingDetail.results.unsoldTitle")}
                  </h3>
                  <p className="text-xs text-stone-600">
                    {t("listingDetail.results.unsoldSubtitle")}
                  </p>
                </div>
              )}

              {isCancelled && (
                <div
                  data-testid="result-cancelled-state"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 space-y-1"
                >
                  <h3 className="text-base font-bold text-red-900">
                    {t("listingDetail.results.cancelledTitle")}
                  </h3>
                  <p className="text-xs text-red-700">
                    {t("listingDetail.results.cancelledSubtitle")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bid Panel (Active Auction) */}
          {isActive && (
            <BidPanel
              listing={listing}
              onBidSuccess={() => {
                void refetch();
                void refetchBids();
              }}
            />
          )}
        </section>
      </div>

      {/* Mobile Sticky Bid Bar (Works at 360px viewport) */}
      <aside
        data-testid="sticky-bid-bar"
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-stone-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md md:hidden"
      >
        <div>
          <span className="block text-[11px] font-semibold text-stone-500">
            {isActive
              ? listing.bidCount > 0
                ? t("listingDetail.currentHighestBid")
                : t("listingDetail.openingFloor")
              : t("listingDetail.stickyBidBar.auctionEnded")}
          </span>
          <div className="font-mono text-base font-extrabold text-stone-900">
            {formatPoisha(listing.displayPricePerKg)}
            <span className="text-xs font-normal text-stone-500">/kg</span>
          </div>
        </div>

        {isActive ? (
          <Button
            type="button"
            data-testid="sticky-bid-btn"
            onClick={scrollToBidPanel}
            className="w-auto px-5 py-2.5 bg-primary text-white font-bold text-sm shadow-sm"
          >
            {t("listingDetail.stickyBidBar.bidNow")}
          </Button>
        ) : (
          <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
            {t("listingDetail.stickyBidBar.auctionEnded")}
          </span>
        )}
      </aside>
    </main>
  );
}

export default BuyerListingDetailPage;
