import { ObjectId } from "bson";
import {
  type BuyerListingCard,
  ListingStatus,
  WATCHLIST_LIMITS,
  type WatchlistActionResponse,
  type WatchlistResponse,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { AppError } from "../../shared/errors.js";
import {
  type RawMarketplaceListingDoc,
  mapListingToBuyerCard,
} from "../listings/listing.mapper.js";
import { Listing } from "../listings/listing.model.js";
import { WatchlistItem } from "./watchlist.model.js";

function ensureObjectId(id: string, fieldName = "id"): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new AppError(400, "VALIDATION_ERROR", `Invalid ${fieldName} format`);
  }
  return new ObjectId(id);
}

export interface GetWatchlistOptions {
  page?: number;
  limit?: number;
}

/**
 * Adds a listing to the buyer's watchlist (Task 8.5 / Decision D-34).
 *
 * RULES:
 * - Listing must exist (404 NOT_FOUND).
 * - Listing must be ACTIVE (400 LISTING_NOT_ACTIVE).
 * - Buyer's watchlist is capped at 50 items (400 WATCHLIST_CAP_EXCEEDED).
 * - Idempotent: adding an already watched listing succeeds without duplicating.
 */
export async function addToWatchlist(
  userId: string,
  listingId: string,
): Promise<WatchlistActionResponse["data"]> {
  const userObjectId = ensureObjectId(userId, "userId");
  const listingObjectId = ensureObjectId(listingId, "listingId");

  const listing = await Listing.findById(listingObjectId).select("status").lean();
  if (!listing) {
    throw new AppError(404, "NOT_FOUND", "Listing not found");
  }

  if (listing.status !== ListingStatus.ACTIVE) {
    throw new AppError(
      400,
      "LISTING_NOT_ACTIVE",
      "Only active listings can be added to the watchlist",
    );
  }

  const existing = await WatchlistItem.findOne({
    userId: userObjectId,
    listingId: listingObjectId,
  });

  if (existing) {
    return {
      success: true,
      listingId,
      isWatched: true,
    };
  }

  const count = await WatchlistItem.countDocuments({ userId: userObjectId });
  if (count >= WATCHLIST_LIMITS.MAX_ITEMS) {
    throw new AppError(
      400,
      "WATCHLIST_CAP_EXCEEDED",
      `Watchlist cannot exceed ${WATCHLIST_LIMITS.MAX_ITEMS} items`,
    );
  }

  const clock = getClock();
  const now = clock.now();

  try {
    await WatchlistItem.create({
      userId: userObjectId,
      listingId: listingObjectId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: unknown) {
    // If concurrent insert created the document, handle idempotently
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return {
        success: true,
        listingId,
        isWatched: true,
      };
    }
    throw err;
  }

  return {
    success: true,
    listingId,
    isWatched: true,
  };
}

/**
 * Removes a listing from the buyer's watchlist (Task 8.5).
 * Idempotent: succeeds even if the listing was not in the watchlist.
 */
export async function removeFromWatchlist(
  userId: string,
  listingId: string,
): Promise<WatchlistActionResponse["data"]> {
  const userObjectId = ensureObjectId(userId, "userId");
  const listingObjectId = ensureObjectId(listingId, "listingId");

  await WatchlistItem.deleteOne({
    userId: userObjectId,
    listingId: listingObjectId,
  });

  return {
    success: true,
    listingId,
    isWatched: false,
  };
}

/**
 * Checks whether a listing is watched by a specific user.
 */
export async function isListingWatched(userId: string, listingId: string): Promise<boolean> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(listingId)) {
    return false;
  }
  const exists = await WatchlistItem.exists({
    userId: new ObjectId(userId),
    listingId: new ObjectId(listingId),
  });
  return Boolean(exists);
}

/**
 * Returns a Set of listing IDs that are watched by the specified user.
 * Performs a single batch query for optimal page performance (Gap 7).
 */
export async function getWatchedListingIds(
  userId: string,
  listingIds: string[],
): Promise<Set<string>> {
  if (!ObjectId.isValid(userId) || listingIds.length === 0) {
    return new Set();
  }

  const validObjectIds = listingIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  if (validObjectIds.length === 0) {
    return new Set();
  }

  const docs = await WatchlistItem.find(
    {
      userId: new ObjectId(userId),
      listingId: { $in: validObjectIds },
    },
    { listingId: 1 },
  ).lean();

  return new Set(docs.map((doc) => doc.listingId.toString()));
}

/**
 * Returns paginated buyer listing cards for the buyer's watchlist.
 * Shows current status (ACTIVE, SOLD, EXPIRED_UNSOLD, CANCELLED), sorted newest saved first.
 */
export async function getWatchlist(
  userId: string,
  options?: GetWatchlistOptions,
): Promise<WatchlistResponse> {
  const userObjectId = ensureObjectId(userId, "userId");
  const clock = getClock();

  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(WATCHLIST_LIMITS.MAX_ITEMS, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const [watchlistDocs, total] = await Promise.all([
    WatchlistItem.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WatchlistItem.countDocuments({ userId: userObjectId }),
  ]);

  if (watchlistDocs.length === 0) {
    return {
      data: [],
      meta: {
        serverTime: clock.iso(),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  const orderedListingIds = watchlistDocs.map((w) => w.listingId);

  const rawDocs = await Listing.aggregate<RawMarketplaceListingDoc>([
    {
      $match: {
        _id: { $in: orderedListingIds },
      },
    },
    {
      $lookup: {
        from: "crops",
        localField: "cropId",
        foreignField: "_id",
        as: "cropDoc",
      },
    },
    {
      $unwind: "$cropDoc",
    },
  ]);

  // Index raw documents by id string for O(1) retrieval
  const docMap = new Map<string, RawMarketplaceListingDoc>();
  for (const doc of rawDocs) {
    docMap.set(doc._id.toString(), doc);
  }

  // Preserve the saved order (newest saved first) and exclude any deleted listings
  const cards: BuyerListingCard[] = [];
  for (const item of watchlistDocs) {
    const raw = docMap.get(item.listingId.toString());
    if (raw) {
      const card = mapListingToBuyerCard(raw);
      card.isWatched = true;
      cards.push(card);
    }
  }

  return {
    data: cards,
    meta: {
      serverTime: clock.iso(),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
