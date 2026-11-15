import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  type MyBidsRow,
  formatPoisha,
} from "@bazarbeat/shared";

import { CountdownTimer } from "../../components/shared/countdown-timer.js";
import { GradeBadge } from "../../components/shared/grade-badge.js";
import { PriceTag } from "../../components/shared/price-tag.js";
import { toBanglaDigits } from "../../lib/format.js";
import { useMyBidsGrouped } from "./api/use-my-bids.js";

export type MyBidsTab = "active" | "won" | "lost";

interface MyBidRowItemProps {
  row: MyBidsRow;
  tab: MyBidsTab;
}

export function MyBidRowItem({ row, tab }: MyBidRowItemProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";
  const cropName = isBangla ? row.cropNameBn : row.cropNameEn;
  const quantityFormatted = isBangla
    ? toBanglaDigits(row.quantityKg.toLocaleString())
    : row.quantityKg.toLocaleString();

  return (
    <article
      data-testid={`my-bid-row-${row.listingId}`}
      className="group rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-2xs hover:border-stone-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      {/* Left: Thumbnail & Main Info */}
      <div className="flex items-start gap-3.5 min-w-0">
        {row.thumbnailUrl ? (
          <img
            src={row.thumbnailUrl}
            alt={cropName}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover border border-stone-200 shrink-0 bg-stone-100"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-2xl shrink-0"
            aria-hidden="true"
          >
            🌾
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-stone-900 truncate">
              {cropName}
            </h3>
            <GradeBadge grade={row.grade} size="sm" />

            {/* Status Badge */}
            {row.status === "WINNING" && (
              <span
                data-testid="bid-status-winning"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("myBids.status.winning")}
              </span>
            )}
            {row.status === "OUTBID" && (
              <span
                data-testid="bid-status-outbid"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t("myBids.status.outbid")}
              </span>
            )}
            {row.status === "WON" && (
              <span
                data-testid="bid-status-won"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800"
              >
                {t("myBids.status.won")}
              </span>
            )}
            {row.status === "LOST" && (
              <span
                data-testid="bid-status-lost"
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700"
              >
                {t("myBids.status.lost")}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t("myBids.quantity", { quantity: quantityFormatted })}</span>
            <span aria-hidden="true">•</span>
            <span>{t("myBids.bidsCount", { count: row.bidCount })}</span>
          </p>

          {/* Pricing & Gap Block */}
          {tab === "active" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs sm:text-sm">
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground font-medium">{t("myBids.yourBid")}</span>
                <PriceTag amountPoisha={row.myBidPerKg} size="sm" />
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground font-medium">{t("myBids.currentPrice")}</span>
                <PriceTag amountPoisha={row.currentBidPerKg} size="sm" />
              </div>

              {row.status === "OUTBID" && (row.gapToCurrentPerKg || row.gap) ? (
                <div
                  data-testid="outbid-gap"
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-xs font-bold text-amber-900"
                >
                  {t("myBids.gapBehind", {
                    amount: formatPoisha(row.gapToCurrentPerKg ?? row.gap ?? 0),
                  })}
                </div>
              ) : null}
            </div>
          )}

          {tab === "won" && (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1 text-xs sm:text-sm">
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground font-medium">{t("myBids.finalPrice")}</span>
                <PriceTag amountPoisha={row.currentBidPerKg} size="sm" />
              </div>
              <span className="text-xs text-stone-600 font-medium">
                {t("myBids.total", { amount: formatPoisha(row.currentTotalAmount) })}
              </span>
            </div>
          )}

          {tab === "lost" && (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1 text-xs sm:text-sm">
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground font-medium">{t("myBids.finalPrice")}</span>
                <PriceTag amountPoisha={row.currentBidPerKg} size="sm" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground font-medium">{t("myBids.yourBid")}</span>
                <PriceTag amountPoisha={row.myBidPerKg} size="sm" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Countdown & Actions */}
      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
        {tab === "active" && (
          <>
            <div className="flex items-center">
              <CountdownTimer endsAt={row.endsAt} size="sm" />
            </div>
            <Link
              to={`/buyer/listings/${row.listingId}`}
              data-testid="raise-bid-button"
              className="inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all text-center"
            >
              {t("myBids.raiseBid")}
            </Link>
          </>
        )}

        {tab === "won" && (
          <Link
            to={row.orderId ? `/buyer/orders/${row.orderId}` : "/buyer/orders"}
            data-testid="view-order-link"
            className="inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 transition-all text-center"
          >
            {t("myBids.viewOrder")}
          </Link>
        )}

        {tab === "lost" && (
          <Link
            to={`/buyer/listings/${row.listingId}`}
            data-testid="view-listing-link"
            className="inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all text-center"
          >
            {t("myBids.viewListing")}
          </Link>
        )}
      </div>
    </article>
  );
}

export function MyBidsPage(): ReactElement {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const initialTab: MyBidsTab =
    tabParam === "won" || tabParam === "lost" || tabParam === "active" ? tabParam : "active";
  const [activeTab, setActiveTab] = useState<MyBidsTab>(initialTab);

  const handleTabChange = (tab: MyBidsTab): void => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const bidsQuery = useMyBidsGrouped();

  const activeBids = bidsQuery.data?.data.active ?? [];
  const wonBids = bidsQuery.data?.data.won ?? [];
  const lostBids = bidsQuery.data?.data.lost ?? [];

  const currentList =
    activeTab === "active" ? activeBids : activeTab === "won" ? wonBids : lostBids;

  return (
    <main className="mx-auto max-w-5xl px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
          {t("myBids.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("myBids.subtitle")}</p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("myBids.title")}
        className="flex items-center gap-2 border-b border-stone-200 pb-3 overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "active"}
          data-testid="tab-active"
          onClick={() => handleTabChange("active")}
          className={`min-h-[44px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === "active"
              ? "bg-primary text-white shadow-2xs"
              : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          {t("myBids.tabs.active")}
          {bidsQuery.data ? ` (${activeBids.length})` : ""}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "won"}
          data-testid="tab-won"
          onClick={() => handleTabChange("won")}
          className={`min-h-[44px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === "won"
              ? "bg-primary text-white shadow-2xs"
              : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          {t("myBids.tabs.won")}
          {bidsQuery.data ? ` (${wonBids.length})` : ""}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "lost"}
          data-testid="tab-lost"
          onClick={() => handleTabChange("lost")}
          className={`min-h-[44px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === "lost"
              ? "bg-primary text-white shadow-2xs"
              : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          {t("myBids.tabs.lost")}
          {bidsQuery.data ? ` (${lostBids.length})` : ""}
        </button>
      </div>

      {/* Loading Skeleton */}
      {bidsQuery.isLoading && !bidsQuery.data && (
        <div role="status" data-testid="bids-loading" className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-2xs animate-pulse flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 flex-1">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-stone-200 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-40 rounded bg-stone-200" />
                  <div className="h-4 w-28 rounded bg-stone-200" />
                  <div className="h-4 w-48 rounded bg-stone-200" />
                </div>
              </div>
              <div className="h-11 w-32 rounded-xl bg-stone-200 shrink-0 self-end sm:self-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {bidsQuery.isError && !bidsQuery.data && (
        <div
          role="alert"
          data-testid="bids-error"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center space-y-3"
        >
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-600"
            aria-hidden="true"
          >
            ⚠️
          </div>
          <p className="text-base font-bold text-red-900">{t("myBids.loadError")}</p>
          <button
            type="button"
            onClick={() => void bidsQuery.refetch()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-2xs hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 transition-all"
          >
            {t("myBids.retry")}
          </button>
        </div>
      )}

      {/* Populated List */}
      {!bidsQuery.isLoading && !bidsQuery.isError && currentList.length > 0 && (
        <div
          role="tabpanel"
          aria-label={t(`myBids.tabs.${activeTab}`)}
          data-testid="my-bids-list"
          className="space-y-4"
        >
          {currentList.map((row) => (
            <MyBidRowItem key={row.listingId} row={row} tab={activeTab} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!bidsQuery.isLoading && !bidsQuery.isError && currentList.length === 0 && (
        <div
          role="tabpanel"
          aria-label={t(`myBids.tabs.${activeTab}`)}
          data-testid={`bids-empty-${activeTab}`}
          className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 sm:p-12 text-center space-y-4"
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-2xl"
            aria-hidden="true"
          >
            {activeTab === "active" ? "🏷️" : activeTab === "won" ? "🏆" : "📦"}
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              {activeTab === "active"
                ? t("myBids.emptyActiveTitle")
                : activeTab === "won"
                ? t("myBids.emptyWonTitle")
                : t("myBids.emptyLostTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              {activeTab === "active"
                ? t("myBids.emptyActiveDesc")
                : activeTab === "won"
                ? t("myBids.emptyWonDesc")
                : t("myBids.emptyLostDesc")}
            </p>
          </div>

          <div>
            <Link
              to="/buyer/marketplace"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-2xs hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all"
            >
              {t("myBids.exploreMarketplace")}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default MyBidsPage;
