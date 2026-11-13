import type { Types } from 'mongoose';
import { AIProvider, CropGrade } from '@bazarbeat/shared';
import type { PredictPriceRequest, PriceGuidance } from '@bazarbeat/shared';
import { GradingProvider, PricePredictionProvider } from './interfaces.js';
import { calculatePriceGuidance } from './pricing-strategy.js';
import { getRecentMarketPrices } from '../market-prices/market-price.service.js';

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
  public async predictPrice(request: PredictPriceRequest, division?: string): Promise<PriceGuidance> {
    const { cropId, grade, quantityKg } = request;
    // Retrieve recent market rows (up to 60)
    const recentRows = await getRecentMarketPrices(cropId, division ?? 'dhaka', 60);
    const baseAvg = recentRows.length
      ? Math.round(
          recentRows.reduce((sum, r) => sum + r.avgPricePerKg, 0) / recentRows.length,
        )
      : 5_000; // fallback default if no rows

    const month = new Date().getUTCMonth() + 1; // 1‑12
    // Determine trend based on simple moving average comparison if enough rows.
    const trend = (() => {
      if (recentRows.length < 14) return 'FLAT' as const;
      const firstHalf = recentRows.slice(0, Math.floor(recentRows.length / 2));
      const secondHalf = recentRows.slice(Math.floor(recentRows.length / 2));
      const avg1 =
        firstHalf.reduce((s, r) => s + r.avgPricePerKg, 0) / firstHalf.length;
      const avg2 =
        secondHalf.reduce((s, r) => s + r.avgPricePerKg, 0) / secondHalf.length;
      if (avg2 > avg1 * 1.02) return 'UP' as const;
      if (avg2 < avg1 * 0.98) return 'DOWN' as const;
      return 'FLAT' as const;
    })();

    const guidance = calculatePriceGuidance({
      baseAvg,
      grade,
      month,
      recentRowsCount: recentRows.length,
      trend,
    });
    return guidance;
  }
}

