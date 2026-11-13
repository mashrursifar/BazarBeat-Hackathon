export interface PricingStrategyParams {
  baseAvg: number; // poisha per kg, integer
  grade: string; // "A"|"B"|"C"
  month: number; // 1‑12
  recentRowsCount: number; // number of market rows used
  trend: 'UP' | 'FLAT' | 'DOWN';
}

/**
 * Pure function that computes low, expected, high price guidance.
 * Formula (from docs):
 *   expected = baseAvg * gradeFactor * seasonalFactor * trendFactor
 *   low  = expected * (1 - bandWidth)
 *   high = expected * (1 + bandWidth)
 *   bandWidth = 0.05 + 0.10 * max(0, (60 - recentRowsCount) / 60)
 * Grade factors: A +10% (1.10), B baseline (1.00), C -15% (0.85)
 * Seasonal factor: sinusoidal +/-5% based on month (peak in month 6).
 * Trend factor: UP +2% (1.02), DOWN -2% (0.98), FLAT 1.00.
 */
export function calculatePriceGuidance(params: PricingStrategyParams) {
  const { baseAvg, grade, month, recentRowsCount, trend } = params;
  // grade factor
  const gradeFactor = grade === 'A' ? 1.10 : grade === 'C' ? 0.85 : 1.0;
  // seasonal +/-5% sinusoidal (peak at month 6)
  const seasonalFactor = 1 + 0.05 * Math.sin(((month - 6) * Math.PI) / 6);
  // trend factor
  const trendFactor = trend === 'UP' ? 1.02 : trend === 'DOWN' ? 0.98 : 1.0;

  const expected = Math.round(baseAvg * gradeFactor * seasonalFactor * trendFactor);

  // band widens when data is sparse: 5% base + up to +10% when no rows.
  const scarcity = Math.max(0, (60 - recentRowsCount) / 60);
  const band = 0.05 + 0.10 * scarcity;
  const low = Math.round(expected * (1 - band));
  const high = Math.round(expected * (1 + band));

  return {
    lowPerKg: low,
    expectedPerKg: expected,
    highPerKg: high,
    trend,
    confidence: 1 - scarcity * 0.5, // simple confidence reduction when sparse
    explanation: [`Recent market prices analyzed for grade ${grade}`],
    modelVersion: 'mock-price-1.0',
    provider: 'mock' as const,
    degraded: false,
    generatedAt: new Date().toISOString(),
    suggestedFloorPerKg: low,
  };
}

