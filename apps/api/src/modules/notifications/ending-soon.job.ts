import { ObjectId } from "bson";
import {
  ListingStatus,
  NotificationType,
  buildNotificationDedupeKey,
  getEndingSoonWindowMs,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { type Clock, getClock } from "../../shared/clock.js";
import { logger } from "../../shared/logger.js";
import { Bid } from "../bids/bid.model.js";
import { Listing } from "../listings/listing.model.js";
import { WatchlistItem } from "../watchlist/watchlist.model.js";
import { createOrCoalesceNotification } from "./notification.service.js";


export interface EndingSoonJobOptions {
  clock?: Clock;
  isDemoMode?: boolean;
}

export interface EndingSoonJobSummary {
  checkedAt: Date;
  foundListings: number;
  notifiedCount: number;
  failedCount: number;
  durationMs: number;
}

/**
 * Scheduler job pass (Task 8.3 / ARCHITECTURE §6 / Decision D-33).
 *
 * Finds ACTIVE listings entering the ending-soon window (15 minutes; 30 seconds in demo mode)
 * and creates ENDING_SOON notifications for:
 * 1. The farmer (owner)
 * 2. Every buyer who has bid on the listing
 * 3. Watchers (if watchlist items exist)
 *
 * DEDUPLICATION GUARANTEE:
 * Uses `dedupeKey = ENDING_SOON:${listingId}` so repeated ticks, anti-sniping extensions,
 * and server restarts NEVER create duplicate notifications.
 */
export async function runEndingSoonJob(
  options?: EndingSoonJobOptions,
): Promise<EndingSoonJobSummary> {
  const startTime = Date.now();
  const clock = options?.clock ?? getClock();
  const now = clock.now();
  const isDemo = options?.isDemoMode ?? env.DEMO_MODE;
  const windowMs = getEndingSoonWindowMs(isDemo);
  const windowThreshold = new Date(now.getTime() + windowMs);

  let notifiedCount = 0;
  let failedCount = 0;

  let listings: Array<InstanceType<typeof Listing>>;
  try {
    listings = await Listing.find({
      status: ListingStatus.ACTIVE,
      endsAt: { $gt: now, $lte: windowThreshold },
    }).populate("cropId");
  } catch (err: unknown) {
    logger.error({ err }, "Failed to query active listings entering ending-soon window");
    return {
      checkedAt: now,
      foundListings: 0,
      notifiedCount: 0,
      failedCount: 1,
      durationMs: Date.now() - startTime,
    };
  }

  for (const listing of listings) {
    const listingIdStr = listing._id.toString();
    try {
      const crop = listing.cropId as unknown as { slug?: string; nameEn?: string } | null;
      const cropSlug = crop?.slug ?? "produce";
      const cropName = crop?.nameEn ?? "produce";
      const endsAtIso = listing.endsAt.toISOString();
      const dedupeKey = buildNotificationDedupeKey(NotificationType.ENDING_SOON, {
        listingId: listingIdStr,
      });

      const recipients = new Set<string>();

      // 1. Farmer owner
      if (listing.farmerId) {
        recipients.add(listing.farmerId.toString());
      }

      // 2. Buyers who have bid
      try {
        const bidderIds = await Bid.find({
          listingId: new ObjectId(listingIdStr),
        }).distinct("buyerId");

        for (const bidderId of bidderIds) {
          recipients.add(bidderId.toString());
        }
      } catch (bidErr: unknown) {
        logger.error({ err: bidErr, listingId: listingIdStr }, "Failed to lookup bidders for ending-soon alert");
      }

      // 3. Watchers
      try {
        const watcherIds = await WatchlistItem.find({
          listingId: new ObjectId(listingIdStr),
        }).distinct("userId");

        for (const watcherId of watcherIds) {
          recipients.add(watcherId.toString());
        }
      } catch (watchErr: unknown) {
        logger.debug({ err: watchErr, listingId: listingIdStr }, "No watchlist items found or watchlist query skipped");
      }

      // Create notification for each recipient
      for (const recipientId of recipients) {
        try {
          const isFarmer = recipientId === listing.farmerId?.toString();
          const title = `Auction ending soon for ${cropName}`;
          const body = isFarmer
            ? `Your auction for ${cropName} is ending soon.`
            : `An auction you bid on for ${cropName} is ending soon. Check your bid!`;

          const created = await createOrCoalesceNotification({
            userId: recipientId,
            type: NotificationType.ENDING_SOON,
            title,
            body,
            params: {
              listingId: listingIdStr,
              cropSlug,
              endsAt: endsAtIso,
            },
            entityRef: { kind: "listing", id: listingIdStr },
            dedupeKey,
          });

          if (created) {
            notifiedCount++;
          }
        } catch (itemErr: unknown) {
          logger.error(
            { err: itemErr, listingId: listingIdStr, recipientId },
            "Failed to create ending-soon notification for recipient; isolating error",
          );
        }
      }
    } catch (listingErr: unknown) {
      failedCount++;
      logger.error(
        { err: listingErr, listingId: listingIdStr },
        "Failed processing ending-soon alerts for listing; isolating error",
      );
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    checkedAt: now,
    foundListings: listings.length,
    notifiedCount,
    failedCount,
    durationMs,
  };
}
