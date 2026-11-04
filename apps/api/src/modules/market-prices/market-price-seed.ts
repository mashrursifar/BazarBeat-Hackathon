import type { Types } from "mongoose";

import { BANGLADESH_DIVISIONS, MarketPriceSource } from "@bazarbeat/shared";

import { MarketPrice } from "./market-price.model.js";

export const MARKET_PRICE_HISTORY_DAYS = 60;

export const MARKET_PRICE_BASE_PRICES = {
  onion: 6_000,
  "green-chilli": 14_000,
  "bitter-gourd": 8_000,
  eggplant: 6_000,
  potato: 4_000,
} as const;

export interface MarketPriceSeedCrop {
  id: Types.ObjectId;
  slug: string;
}

export interface MarketPriceSeedRow {
  cropId: Types.ObjectId;
  division: string;
  date: Date;
  avgPricePerKg: number;
  minPricePerKg: number;
  maxPricePerKg: number;
  source: typeof MarketPriceSource.SEED;
}

function getDailyNoiseBasisPoints(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
  }
  return (hash % 401) - 200;
}

function applyBasisPointFactor(price: number, basisPoints: number): number {
  return Math.floor((price * basisPoints + 5_000) / 10_000);
}

function getSeasonalBasisPoints(date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  return Math.round(Math.sin((2 * Math.PI * dayOfYear) / 365) * 500);
}

export function generateMarketPriceHistory(
  crops: readonly MarketPriceSeedCrop[],
  asOf: Date,
): MarketPriceSeedRow[] {
  if (crops.length === 0) throw new Error("At least one crop is required to seed market prices");

  const endDate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const rows: MarketPriceSeedRow[] = [];

  for (const crop of crops) {
    const basePrice = Object.entries(MARKET_PRICE_BASE_PRICES).find(
      ([slug]) => slug === crop.slug,
    )?.[1];
    if (basePrice === undefined)
      throw new Error(`Missing base market price for crop: ${crop.slug}`);

    for (const [divisionIndex, { id: division }] of BANGLADESH_DIVISIONS.entries()) {
      for (let dayOffset = MARKET_PRICE_HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
        const date = new Date(endDate);
        date.setUTCDate(date.getUTCDate() - dayOffset);
        const regionalBasisPoints = divisionIndex * 60 - 210;
        const dailyNoise = getDailyNoiseBasisPoints(
          `${crop.slug}|${division}|${date.toISOString()}`,
        );
        const averagePrice = applyBasisPointFactor(
          basePrice,
          10_000 + getSeasonalBasisPoints(date) + regionalBasisPoints + dailyNoise,
        );

        rows.push({
          cropId: crop.id,
          division,
          date,
          avgPricePerKg: averagePrice,
          minPricePerKg: applyBasisPointFactor(averagePrice, 9_500),
          maxPricePerKg: applyBasisPointFactor(averagePrice, 10_500),
          source: MarketPriceSource.SEED,
        });
      }
    }
  }

  return rows;
}

export async function seedMarketPriceHistory(
  crops: readonly MarketPriceSeedCrop[],
  asOf: Date,
): Promise<number> {
  const rows = generateMarketPriceHistory(crops, asOf);
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  if (firstRow === undefined || lastRow === undefined)
    throw new Error("Market price seed generated no rows");

  const operations = rows.map((row) => ({
    updateOne: {
      filter: {
        cropId: row.cropId,
        division: row.division,
        date: row.date,
        source: row.source,
      },
      update: { $set: row },
      upsert: true,
    },
  }));
  await MarketPrice.bulkWrite(operations, { ordered: false });
  await MarketPrice.deleteMany({
    cropId: { $in: crops.map(({ id }) => id) },
    source: MarketPriceSource.SEED,
    $or: [{ date: { $lt: firstRow.date } }, { date: { $gt: lastRow.date } }],
  });

  return rows.length;
}
