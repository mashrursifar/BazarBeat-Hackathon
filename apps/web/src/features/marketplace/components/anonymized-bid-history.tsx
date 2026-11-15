import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { type AnonymizedBidHistoryItem, formatPoisha } from "@bazarbeat/shared";

import { cn } from "../../../lib/utils.js";

export interface AnonymizedBidHistoryProps {
  bids: AnonymizedBidHistoryItem[];
  isLoading?: boolean;
  className?: string;
}

export function AnonymizedBidHistory({
  bids,
  isLoading = false,
  className,
}: AnonymizedBidHistoryProps): ReactElement {
  const { t, i18n } = useTranslation();

  return (
    <div
      data-testid="anonymized-bid-history"
      className={cn(
        "rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-stone-900">
            {t("listingDetail.bidHistoryTitle")}
          </h3>
          <span
            data-testid="bid-count-badge"
            className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700"
          >
            {bids.length}
          </span>
        </div>
        <span className="text-xs text-stone-500">
          {t("listingDetail.bidHistorySubtitle")}
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-stone-400">
          {t("listingDetail.loading")}
        </div>
      ) : bids.length === 0 ? (
        <div
          data-testid="no-bids-message"
          className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500"
        >
          {t("listingDetail.noBidsYet")}
        </div>
      ) : (
        <div
          data-testid="bid-history-list"
          className="divide-y divide-stone-100 max-h-80 overflow-y-auto"
        >
          {bids.map((bid) => {
            const isOwnBid = Boolean(bid.isMine || bid.isMyBid);
            const formattedTime = new Date(bid.placedAt).toLocaleTimeString(
              i18n.language === "bn" ? "bn-BD" : "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              },
            );

            return (
              <div
                key={bid.id}
                data-testid={`bid-row-${bid.id}`}
                className={cn(
                  "flex items-center justify-between py-3 px-2 text-sm transition-colors rounded-lg",
                  isOwnBid ? "bg-primary/5 font-medium" : "hover:bg-stone-50",
                )}
              >
                <div className="flex items-center gap-2">
                  {isOwnBid ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        data-testid="you-bidder-tag"
                        className="rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-white shadow-2xs"
                      >
                        {t("listingDetail.youBadge")}
                      </span>
                      <span className="font-semibold text-stone-800">
                        ({bid.bidderLabel})
                      </span>
                    </div>
                  ) : (
                    <span className="text-stone-700">{bid.bidderLabel}</span>
                  )}
                  <span className="text-xs text-stone-400">{formattedTime}</span>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-stone-900">
                    {formatPoisha(bid.amountPerKg)}
                    <span className="text-xs font-normal text-stone-500">/kg</span>
                  </div>
                  <div className="text-xs text-stone-500 font-mono">
                    {formatPoisha(bid.totalAmount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
