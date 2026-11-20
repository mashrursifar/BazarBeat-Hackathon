import type { PredictPriceRequest, PriceGuidance } from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { Crop } from "../crops/crop.model.js";
import { getRecentMarketPrices } from "../market-prices/market-price.service.js";
import { MARKET_PRICE_BASE_PRICES } from "../market-prices/market-price-seed.js";
import {
  type MarketPriceInputRow,
  calculateBaselinePriceGuidance,
} from "./baseline-price.strategy.js";
import type { PricePredictionProvider } from "./interfaces.js";

/**
 * Baseline Price Prediction Provider (Task G5: Statistical Baseline).
 *
 * Implements pure functional price guidance over historical MarketPrice telemetry:
 *   - Seasonal division average
 *   - Recent 7-day trend (momentum factor)
 *   - Grade multiplier (A: +10%, B: 1.00, C: -15%)
 *   - Band widening on sparse data (5% base up to 15% when sparse)
 *   - Structured PriceReasonCode items with provider: "baseline" and modelVersion: "seasonal-baseline-v1"
 */
export class BaselinePricePredictionProvider implements PricePredictionProvider {
  public async predictPrice(
    request: PredictPriceRequest,
    division?: string,
  ): Promise<PriceGuidance> {
    const { cropId, grade } = request;
    const normalizedDivision = division?.trim().toLowerCase();

    // 1. Fetch recent market price rows for target division (up to 60 days)
    const divisionRows: MarketPriceInputRow[] = normalizedDivision
      ? await getRecentMarketPrices(cropId, normalizedDivision, 60)
      : [];

    // 2. Fetch national rows if division rows are sparse (< 14 rows) or if division omitted
    const nationalRows: MarketPriceInputRow[] =
      !normalizedDivision || divisionRows.length < 14
        ? await getRecentMarketPrices(cropId, undefined, 60)
        : [];

    // 3. Fallback benchmark price if database has zero historical rows
    let fallbackPrice = 5_000;
    try {
      const crop = await Crop.findById(cropId).lean();
      if (crop?.slug && crop.slug in MARKET_PRICE_BASE_PRICES) {
        fallbackPrice =
          MARKET_PRICE_BASE_PRICES[crop.slug as keyof typeof MARKET_PRICE_BASE_PRICES];
      }
    } catch {
      // In-memory or stub execution fallback
      fallbackPrice = 5_000;
    }

    // 4. Calculate pure functional guidance
    const activeRows = divisionRows.length > 0 ? divisionRows : nationalRows;

    return calculateBaselinePriceGuidance({
      cropId,
      grade,
      division: normalizedDivision,
      rows: activeRows,
      nationalRows,
      fallbackPrice,
      asOf: getClock().now(),
    });
  }
}
