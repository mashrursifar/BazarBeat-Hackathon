import type mongoose from "mongoose";
import { MarketPriceSource } from "@bazarbeat/shared";

import { MarketPrice, type MarketPriceRecord } from "./market-price.model.js";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function getRecentMarketPrices(
  cropId: string,
  division: string,
  limit = 60,
): Promise<MarketPriceRecord[]> {
  return MarketPrice.find({ cropId, division })
    .sort({ date: -1 })
    .limit(limit)
    .lean<MarketPriceRecord[]>();
}

/**
 * Records or updates a PLATFORM market price record for a completed auction sale.
 * AUCTION_RULES §8 & DATA_MODEL (MarketPrice):
 * Unique on (cropId, division, date, source). Platform-derived rows are written when auctions close.
 */
export async function recordPlatformSalePrice(
  cropId: string,
  division: string,
  pricePerKg: number,
  soldAt: Date,
  session?: mongoose.ClientSession,
): Promise<void> {
  const utcDay = new Date(Date.UTC(soldAt.getUTCFullYear(), soldAt.getUTCMonth(), soldAt.getUTCDate()));
  const normalizedDivision = division.trim().toLowerCase();

  const filter = {
    cropId,
    division: normalizedDivision,
    date: utcDay,
    source: MarketPriceSource.PLATFORM,
  };

  const existing = await MarketPrice.findOne(filter, null, session ? { session } : {});
  if (!existing) {
    try {
      await MarketPrice.create(
        [
          {
            cropId,
            division: normalizedDivision,
            date: utcDay,
            avgPricePerKg: pricePerKg,
            minPricePerKg: pricePerKg,
            maxPricePerKg: pricePerKg,
            source: MarketPriceSource.PLATFORM,
          },
        ],
        session ? { session } : {},
      );
      return;
    } catch (err: unknown) {
      if (!isDuplicateKey(err)) throw err;
      // Concurrent insert or re-run
    }
  }

  const current = existing ?? (await MarketPrice.findOne(filter, null, session ? { session } : {}));
  if (current) {
    const newMin = Math.min(current.minPricePerKg, pricePerKg);
    const newMax = Math.max(current.maxPricePerKg, pricePerKg);
    const newAvg = Math.round((current.avgPricePerKg + pricePerKg) / 2);

    await MarketPrice.updateOne(
      { _id: current._id },
      {
        $set: {
          minPricePerKg: newMin,
          maxPricePerKg: newMax,
          avgPricePerKg: newAvg,
        },
      },
      session ? { session } : {},
    );
  }
}
