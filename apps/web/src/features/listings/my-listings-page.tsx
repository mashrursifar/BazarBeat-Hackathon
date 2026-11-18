import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  type CropResponse,
  type ListingStatus,
  formatPoisha,
} from "@bazarbeat/shared";

import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { PriceTag } from "../../components/shared/price-tag.js";
import { Button } from "../../components/ui/button.js";
import { useCrops, useListingDetail, useMyListings } from "./api/use-listing-wizard-api.js";

type StatusTab = ListingStatus | "ALL";

const STATUS_TABS: readonly { id: StatusTab; key: string }[] = [
  { id: "ALL", key: "filterAll" },
  { id: "ACTIVE", key: "filterActive" },
  { id: "SOLD", key: "filterSold" },
  { id: "EXPIRED_UNSOLD", key: "filterExpired" },
  { id: "CANCELLED", key: "filterCancelled" },
];

function StatusBadge({ status }: { status: ListingStatus }): ReactElement {
  const { t } = useTranslation();

  const STYLES: Record<ListingStatus, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-300",
    SOLD: "bg-blue-100 text-blue-800 border-blue-300",
    EXPIRED_UNSOLD: "bg-stone-100 text-stone-700 border-stone-300",
    CANCELLED: "bg-red-100 text-red-800 border-red-300",
    DRAFT: "bg-amber-100 text-amber-800 border-amber-300",
  };

  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${STYLES[status] ?? "bg-stone-100 text-stone-700 border-stone-300"}`}
    >
      {t(`listings.status.${status}`, status)}
    </span>
  );
}

export function ListingDetailDrawer({
  listingId,
  crops,
  onClose,
}: {
  listingId: string;
  crops: CropResponse[];
  onClose: () => void;
}): ReactElement {
  const { t, i18n } = useTranslation();
  const detailQuery = useListingDetail(listingId);

  const dateFormatter = new Intl.DateTimeFormat(
    i18n.language === "bn" ? "bn-BD" : "en-BD",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    },
  );

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs transition-opacity"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-drawer-title"
        data-testid="listing-detail-drawer"
        className="flex h-full w-full max-w-lg flex-col justify-between bg-white p-5 shadow-2xl sm:p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Drawer Header */}
          <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <h2
                id="listing-drawer-title"
                className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
              >
                {t("listings.drawerTitle", "Listing Details")}
              </h2>
              {detailQuery.data && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    ID: {detailQuery.data.data.id}
                  </span>
                  <StatusBadge status={detailQuery.data.data.status} />
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="close-drawer-btn"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t("listings.drawerClose", "Close")}
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          {detailQuery.isLoading && (
            <div data-testid="drawer-loading" role="status" className="space-y-4 py-8">
              <div className="h-48 w-full animate-pulse rounded-xl bg-stone-200" />
              <div className="h-6 w-36 animate-pulse rounded bg-stone-200" />
              <div className="h-20 w-full animate-pulse rounded-xl bg-stone-200" />
            </div>
          )}

          {detailQuery.isError && (
            <div
              data-testid="drawer-error"
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 space-y-3"
            >
              <p>{t("listings.loadError", "Could not load listing details.")}</p>
              <Button type="button" onClick={() => void detailQuery.refetch()}>
                {t("auth.retry", "Try again")}
              </Button>
            </div>
          )}

          {detailQuery.data && (
            <div className="space-y-5">
              {/* Crop & Main Info */}
              {(() : ReactElement => {
                const listing = detailQuery.data.data;
                const crop = crops.find((c) => c.id === listing.cropId);
                const cropName = crop
                  ? i18n.language === "bn"
                    ? crop.nameBn
                    : crop.nameEn
                  : "Crop";

                return (
                  <>
                    {/* Photos Gallery */}
                    <div data-testid="drawer-images" className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {listing.images.map((img, idx) => (
                          <div
                            key={idx}
                            className="aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 border border-stone-200"
                          >
                            <img
                              src={img.url}
                              alt={`${cropName} photo ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quality Assessment */}
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("wizard.summaryGrade", "AI Quality Grade")}
                        </span>
                        <GradeBadge grade={listing.aiAssessment.grade} size="sm" />
                      </div>

                      <div className="text-xs text-stone-700 space-y-1">
                        <span className="font-semibold block">
                          {t("wizard.confidenceLevel", "Confidence")}:{" "}
                          {Math.round(listing.aiAssessment.confidence * 100)}%
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-stone-600">
                          {listing.aiAssessment.qualityNotes.map((note, idx) => (
                            <li key={idx}>
                              {typeof note === "string" ? note : t(`ai.gradingReasons.${note.code}`, note.code)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quantity & Bidding Details */}
                    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 shadow-2xs">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="block text-xs font-medium text-muted-foreground">
                            {t("listings.quantity", "Quantity:")}
                          </span>
                          <span className="text-base font-bold text-foreground">
                            {listing.quantityKg} kg
                          </span>
                        </div>

                        <div>
                          <span className="block text-xs font-medium text-muted-foreground">
                            {t("listings.floorPrice", "Floor:")}
                          </span>
                          <PriceTag amountPoisha={listing.floorPricePerKg} size="md" />
                        </div>

                        <div>
                          <span className="block text-xs font-medium text-muted-foreground">
                            {t("wizard.summaryTotalFloorValue", "Minimum Total Value")}
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {formatPoisha(listing.floorPricePerKg * listing.quantityKg)}
                          </span>
                        </div>

                        <div>
                          <span className="block text-xs font-medium text-muted-foreground">
                            {t("listings.currentBid", "Highest bid:")}
                          </span>
                          {listing.currentBidPerKg ? (
                            <span className="flex items-baseline gap-1">
                              <PriceTag amountPoisha={listing.currentBidPerKg} size="sm" />
                              <span className="text-xs text-muted-foreground">
                                ({listing.bidCount})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">
                              {t("listings.noBidsYet", "No bids yet")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Auction Timings */}
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2 text-xs">
                      <span className="block font-bold text-foreground uppercase tracking-wider text-[11px]">
                        {t("listings.auctionTimings", "Auction Timings")}
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-stone-600">
                        <div>
                          <span className="block text-muted-foreground">
                            {t("listings.startedAt", "Started:")}
                          </span>
                          <span>{dateFormatter.format(new Date(listing.startsAt))}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground">
                            {t("listings.endsAt", "Closes:")}
                          </span>
                          <span>{dateFormatter.format(new Date(listing.endsAt))}</span>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="font-semibold text-stone-700">
                          {t("listings.timeLeft", "Time left:")}
                        </span>
                        <CountdownTimer
                          endsAt={listing.endsAt}
                          status={listing.status}
                          size="sm"
                          showIcon={true}
                        />
                      </div>
                    </div>

                    {/* Pickup note if provided */}
                    {listing.pickupNote && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs">
                        <span className="font-bold text-foreground block">
                          {t("listings.pickupNote", "Pickup note:")}
                        </span>
                        <p className="mt-1 text-stone-600 italic">{listing.pickupNote}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="pt-4 border-t border-stone-200 mt-6">
          <Button
            type="button"
            onClick={onClose}
            className="w-full bg-white text-stone-700 border border-stone-300 hover:bg-stone-50"
          >
            {t("listings.drawerClose", "Close")}
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function MyListingsPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState<StatusTab>("ALL");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  const queryStatus = selectedStatus === "ALL" ? undefined : selectedStatus;
  const listingsQuery = useMyListings({ status: queryStatus, page: 1, limit: 30 });
  const cropsQuery = useCrops();

  const crops = cropsQuery.data ?? [];
  const listings = listingsQuery.data?.data ?? [];

  return (
    <div data-testid="my-listings-page" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t("listings.title", "My Listings")}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {t("listings.subtitle", "Track and manage your produce auctions.")}
          </p>
        </div>

        <Link
          to="/farmer/new-listing"
          data-testid="create-new-listing-btn"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition-all"
        >
          + {t("listings.createNew", "New Listing")}
        </Link>
      </div>

      {/* Filter Tabs */}
      <div
        data-testid="status-filter-tabs"
        className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3"
        role="tablist"
        aria-label={t("listings.statusFilter", "Filter by status")}
      >
        {STATUS_TABS.map((tab) => {
          const isSelected = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isSelected}
              data-testid={`status-tab-${tab.id.toLowerCase()}`}
              onClick={() => setSelectedStatus(tab.id)}
              className={`min-h-10 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? "bg-primary text-white shadow-2xs"
                  : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              {t(`listings.${tab.key}`)}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {listingsQuery.isLoading && (
        <div
          role="status"
          data-testid="my-listings-loading"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-64 animate-pulse rounded-2xl border border-stone-200 bg-stone-100"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {listingsQuery.isError && (
        <div
          data-testid="my-listings-error"
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center space-y-3"
        >
          <p className="text-sm font-bold text-red-950">
            {t("listings.loadError", "Could not load listings. Please check your connection.")}
          </p>
          <Button
            type="button"
            className="w-auto inline-flex"
            onClick={() => void listingsQuery.refetch()}
          >
            {t("auth.retry", "Try again")}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!listingsQuery.isLoading && !listingsQuery.isError && listings.length === 0 && (
        <div
          data-testid="my-listings-empty"
          className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 sm:p-12 text-center space-y-4"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-2xl">
            🧺
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {t("listings.noListings", "No listings found")}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {t(
                "listings.noListingsDesc",
                "You haven't listed any crops with this status yet.",
              )}
            </p>
          </div>
          <Link
            to="/farmer/new-listing"
            data-testid="empty-create-listing-btn"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90"
          >
            + {t("listings.createNew", "New Listing")}
          </Link>
        </div>
      )}

      {/* Listings Cards Grid */}
      {!listingsQuery.isLoading && !listingsQuery.isError && listings.length > 0 && (
        <div
          data-testid="listings-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {listings.map((listing) => {
            const crop = crops.find((c) => c.id === listing.cropId);
            const cropName = crop
              ? i18n.language === "bn"
                ? crop.nameBn
                : crop.nameEn
              : "Crop";
            const firstImage = listing.images[0]?.url || crop?.imageUrl || "/images/crops/bitter-gourd.svg";

            return (
              <div
                key={listing.id}
                data-testid={`listing-card-${listing.id}`}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  {/* Photo & Badges */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                    <img
                      src={firstImage}
                      alt={cropName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <StatusBadge status={listing.status} />
                    </div>
                    <div className="absolute bottom-2.5 left-2.5">
                      <GradeBadge grade={listing.aiAssessment.grade} size="sm" />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                        {cropName}
                      </h3>
                      <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">
                        {listing.quantityKg} kg
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm pt-1 border-t border-stone-100">
                      <div>
                        <span className="block text-[11px] text-muted-foreground uppercase tracking-wider">
                          {t("listings.floorPrice", "Floor:")}
                        </span>
                        <PriceTag amountPoisha={listing.floorPricePerKg} size="sm" />
                      </div>

                      <div className="text-right">
                        <span className="block text-[11px] text-muted-foreground uppercase tracking-wider">
                          {t("listings.currentBid", "Highest bid:")}
                        </span>
                        {listing.currentBidPerKg ? (
                          <PriceTag amountPoisha={listing.currentBidPerKg} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">
                            {t("listings.noBidsYet", "No bids yet")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time left (using shared countdown) */}
                    <div
                      data-testid={`time-left-${listing.id}`}
                      className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-600 flex items-center justify-between"
                    >
                      <span className="text-muted-foreground">{t("listings.timeLeft", "Time left:")}</span>
                      <CountdownTimer
                        endsAt={listing.endsAt}
                        status={listing.status}
                        size="sm"
                        showIcon={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="p-4 pt-0">
                  <button
                    type="button"
                    data-testid={`view-details-${listing.id}`}
                    onClick={() => setSelectedListingId(listing.id)}
                    className="w-full min-h-10 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {t("listings.viewDetails", "View details")} →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedListingId && (
        <ListingDetailDrawer
          listingId={selectedListingId}
          crops={crops}
          onClose={() => setSelectedListingId(null)}
        />
      )}
    </div>
  );
}

export default MyListingsPage;
