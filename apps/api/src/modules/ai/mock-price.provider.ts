import type { PredictPriceRequest, PriceGuidance } from "@bazarbeat/shared";
import { PricePredictionProvider } from "./interfaces.js";
import { calculatePriceGuidance } from "./pricing-strategy.js";
import { getRecentMarketPrices } from "../market-prices/market-price.service.js";

/**
 * Mock implementation of price prediction.
 * It pulls recent market rows (seeded data) and applies deterministic factors:
 *   - base = average of recent rows (or a fallback constant)
 *   - grade factor: A +10%, B baseline, C -15%
 *   - seasonal factor based on month (±5% sinusoidal)
 *   - trend factor from recent vs previous week (+/-2%)
 *   - a confidence band that widens when data is sparse
 */
export class MockPricePredictionProvider implements PricePredictionProvider {
  public async predictPrice(
    request: PredictPriceRequest,
    division?: string,
  ): Promise<PriceGuidance> {
    const { cropId, grade } = request;
    // Retrieve recent market rows (up to 60) for division or national if omitted
    const recentRows = await getRecentMarketPrices(cropId, division, 60);
    const baseAvg = recentRows.length
      ? Math.round(recentRows.reduce((sum, r) => sum + r.avgPricePerKg, 0) / recentRows.length)
      : 5_000; // fallback default if no rows

    const month = new Date().getUTCMonth() + 1; // 1‑12
    // Determine trend based on simple moving average comparison if enough rows.
    const trend = (): "UP" | "FLAT" | "DOWN" => {
      if (recentRows.length < 14) return "FLAT";
      const firstHalf = recentRows.slice(0, Math.floor(recentRows.length / 2));
      const secondHalf = recentRows.slice(Math.floor(recentRows.length / 2));
      const avg1 = firstHalf.reduce((sum, r) => sum + r.avgPricePerKg, 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((sum, r) => sum + r.avgPricePerKg, 0) / secondHalf.length;
      if (avg2 > avg1 * 1.02) return "UP";
      if (avg2 < avg1 * 0.98) return "DOWN";
      return "FLAT";
    };

    const guidance = calculatePriceGuidance({
      baseAvg,
      grade,
      month,
      recentRowsCount: recentRows.length,
      trend: trend(),
    });
    return guidance;
  }
}
