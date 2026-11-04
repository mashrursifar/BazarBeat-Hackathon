import { MarketPrice, type MarketPriceRecord } from "./market-price.model.js";

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
