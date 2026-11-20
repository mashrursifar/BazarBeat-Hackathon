import {
  type CropGrade,
  type PriceGuidance,
  PriceReasonCode,
  type PriceReasonItem,
  priceGuidanceSchema,
} from "@bazarbeat/shared";

export interface MarketPriceInputRow {
  avgPricePerKg: number;
  date: Date | string;
  division?: string;
  minPricePerKg?: number;
  maxPricePerKg?: number;
  source?: string;
}

export interface BaselinePricingInput {
  cropId: string;
  grade: CropGrade | "A" | "B" | "C";
  division?: string;
  rows: readonly MarketPriceInputRow[];
  nationalRows?: readonly MarketPriceInputRow[];
  fallbackPrice?: number;
  asOf?: Date;
}

export interface DivisionAverageResult {
  average: number;
  sampleCount: number;
  isDivisionSpecific: boolean;
  nationalAverage: number;
  divisionDeviationPercent: number;
}

export interface TrendCalculationResult {
  trend: "UP" | "FLAT" | "DOWN";
  trendFactor: number;
  recent7DayAvg: number | null;
  previous7DayAvg: number | null;
  changePercent: number;
}

export interface SparseBandResult {
  bandWidth: number;
  confidence: number;
  scarcity: number;
}

/**
 * Pure function: calculates sinusoidal seasonal factor for a given date.
 * Bangladeshi wholesale agricultural baseline follows an annual cycle (±500 bps = ±5%).
 * Peak supply / low prices occur post-harvest; lean season creates upward price pressure.
 */
export function calculateSeasonalFactor(date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  const seasonalBasisPoints = Math.round(Math.sin((2 * Math.PI * dayOfYear) / 365) * 500);
  return 1 + seasonalBasisPoints / 10_000;
}

/**
 * Pure function: calculates division average price with national fallback.
 * Also computes percentage deviation between division and national average.
 */
export function calculateDivisionAverage(
  rows: readonly MarketPriceInputRow[],
  targetDivision?: string,
  nationalRows?: readonly MarketPriceInputRow[],
  fallbackPrice = 5_000,
): DivisionAverageResult {
  const normTarget = targetDivision?.trim().toLowerCase();
  const divisionMatchingRows = normTarget
    ? rows.filter((r) => r.division?.trim().toLowerCase() === normTarget)
    : [];

  const nationalPool = nationalRows && nationalRows.length > 0 ? nationalRows : rows;
  const nationalAverage =
    nationalPool.length > 0
      ? Math.round(nationalPool.reduce((sum, r) => sum + r.avgPricePerKg, 0) / nationalPool.length)
      : fallbackPrice;

  if (divisionMatchingRows.length > 0) {
    const average = Math.round(
      divisionMatchingRows.reduce((sum, r) => sum + r.avgPricePerKg, 0) /
        divisionMatchingRows.length,
    );
    const divisionDeviationPercent =
      nationalAverage > 0
        ? Math.round(((average - nationalAverage) / nationalAverage) * 1000) / 10
        : 0;

    return {
      average,
      sampleCount: divisionMatchingRows.length,
      isDivisionSpecific: true,
      nationalAverage,
      divisionDeviationPercent,
    };
  }

  if (rows.length > 0) {
    const average = Math.round(rows.reduce((sum, r) => sum + r.avgPricePerKg, 0) / rows.length);
    return {
      average,
      sampleCount: rows.length,
      isDivisionSpecific: false,
      nationalAverage,
      divisionDeviationPercent: 0,
    };
  }

  return {
    average: fallbackPrice,
    sampleCount: 0,
    isDivisionSpecific: false,
    nationalAverage: fallbackPrice,
    divisionDeviationPercent: 0,
  };
}

/**
 * Pure function: calculates 7-day trend comparing recent 7 days vs previous 7 days.
 * Groups by unique calendar date so multiple intraday observations do not skew the moving average.
 *
 * Thresholds:
 *   >= +2.0% change -> "UP" (trendFactor 1.02)
 *   <= -2.0% change -> "DOWN" (trendFactor 0.98)
 *   otherwise       -> "FLAT" (trendFactor 1.00)
 */
export function calculate7DayTrend(rows: readonly MarketPriceInputRow[]): TrendCalculationResult {
  if (rows.length === 0) {
    return {
      trend: "FLAT",
      trendFactor: 1.0,
      recent7DayAvg: null,
      previous7DayAvg: null,
      changePercent: 0,
    };
  }

  // Aggregate daily averages to establish uniform daily time points
  const dailyMap = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const d = new Date(row.date);
    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const cur = dailyMap.get(dateKey) ?? { sum: 0, count: 0 };
    cur.sum += row.avgPricePerKg;
    cur.count += 1;
    dailyMap.set(dateKey, cur);
  }

  const dailyAverages = Array.from(dailyMap.entries())
    .map(([dateKey, { sum, count }]) => ({ dateKey, avg: Math.round(sum / count) }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey)); // Most recent first

  if (dailyAverages.length < 7) {
    return {
      trend: "FLAT",
      trendFactor: 1.0,
      recent7DayAvg: dailyAverages.length > 0 ? (dailyAverages[0]?.avg ?? null) : null,
      previous7DayAvg: null,
      changePercent: 0,
    };
  }

  const recent7Slice = dailyAverages.slice(0, 7);
  const recent7DayAvg = Math.round(
    recent7Slice.reduce((sum, item) => sum + item.avg, 0) / recent7Slice.length,
  );

  const prevSlice = dailyAverages.slice(7, 14);
  if (prevSlice.length < 3) {
    // Insufficient previous window data for a robust trend comparison
    return {
      trend: "FLAT",
      trendFactor: 1.0,
      recent7DayAvg,
      previous7DayAvg: null,
      changePercent: 0,
    };
  }

  const previous7DayAvg = Math.round(
    prevSlice.reduce((sum, item) => sum + item.avg, 0) / prevSlice.length,
  );

  if (previous7DayAvg === 0) {
    return {
      trend: "FLAT",
      trendFactor: 1.0,
      recent7DayAvg,
      previous7DayAvg,
      changePercent: 0,
    };
  }

  const ratio = recent7DayAvg / previous7DayAvg;
  const changePercent = Math.round((ratio - 1) * 1000) / 10;

  if (ratio >= 1.02) {
    return {
      trend: "UP",
      trendFactor: 1.02,
      recent7DayAvg,
      previous7DayAvg,
      changePercent,
    };
  }

  if (ratio <= 0.98) {
    return {
      trend: "DOWN",
      trendFactor: 0.98,
      recent7DayAvg,
      previous7DayAvg,
      changePercent,
    };
  }

  return {
    trend: "FLAT",
    trendFactor: 1.0,
    recent7DayAvg,
    previous7DayAvg,
    changePercent,
  };
}

/**
 * Pure function: returns quality grade multiplier.
 * Grade A: 1.10 (+10% export / premium)
 * Grade B: 1.00 (standard commercial benchmark)
 * Grade C: 0.85 (-15% commercial discount)
 */
export function getGradeMultiplier(grade: string): number {
  switch (grade) {
    case "A":
      return 1.1;
    case "C":
      return 0.85;
    case "B":
    default:
      return 1.0;
  }
}

/**
 * Pure function: calculates confidence band width on sparse data.
 * Base band: 5% (±0.05).
 * Widens up to 15% (±0.15) when observations are sparse (< 60 daily records).
 * Confidence: 0.95 with full history down to 0.60 with 0 history.
 */
export function calculateSparseBandWidth(sampleCount: number, maxSamples = 60): SparseBandResult {
  const scarcity = Math.max(0, Math.min(1, (maxSamples - sampleCount) / maxSamples));
  const bandWidth = Math.round(50 + 100 * scarcity) / 1000;
  const confidence = Math.round(95 - 35 * scarcity) / 100;
  return { bandWidth, confidence, scarcity };
}

/**
 * Pure function: constructs structured PriceReasonItem objects according to contract.
 */
export function generatePriceReasonItems(params: {
  grade: string;
  trend: "UP" | "FLAT" | "DOWN";
  sampleCount: number;
  changePercent?: number;
  division?: string;
  divisionDeviationPercent?: number;
}): PriceReasonItem[] {
  const reasons: PriceReasonItem[] = [];

  // 1. Historical benchmark with sample count parameter
  reasons.push({
    code: PriceReasonCode.HISTORICAL_BENCHMARK,
    params: {
      grade: params.grade,
      samples: params.sampleCount,
    },
  });

  // 2. Trend observation
  if (params.trend === "UP") {
    reasons.push({
      code: PriceReasonCode.TREND_UP,
      params:
        params.changePercent !== undefined ? { changePercent: params.changePercent } : undefined,
    });
  } else if (params.trend === "DOWN") {
    reasons.push({
      code: PriceReasonCode.TREND_DOWN,
      params:
        params.changePercent !== undefined ? { changePercent: params.changePercent } : undefined,
    });
  } else {
    reasons.push({
      code: PriceReasonCode.TREND_FLAT,
    });
  }

  // 3. Grade premium for Grade A
  if (params.grade === "A") {
    reasons.push({
      code: PriceReasonCode.GRADE_PREMIUM,
      params: { grade: "A", premiumPercent: 10 },
    });
  }

  // 4. Regional division price deviation (if division specific and deviation >= 1.0%)
  if (
    params.division &&
    params.divisionDeviationPercent !== undefined &&
    Math.abs(params.divisionDeviationPercent) >= 1.0
  ) {
    reasons.push({
      code: PriceReasonCode.DIVISION_PREMIUM,
      params: {
        division: params.division,
        diffPercent: params.divisionDeviationPercent,
      },
    });
  }

  // 5. Market wholesale demand signal
  if (params.trend === "UP") {
    reasons.push({ code: PriceReasonCode.DEMAND_HIGH });
  } else {
    reasons.push({ code: PriceReasonCode.DEMAND_STABLE });
  }

  return reasons;
}

/**
 * Pure function: computes expected, low, and high price guidance using:
 *   expected = round(divisionAvg * seasonalFactor * trendFactor * gradeMultiplier)
 *   low = max(1, round(expected * (1 - bandWidth)))
 *   high = max(expected, round(expected * (1 + bandWidth)))
 *   suggestedFloor = low
 *
 * Guarantees schema validation and low <= expected <= high.
 */
export function calculateBaselinePriceGuidance(input: BaselinePricingInput): PriceGuidance {
  const asOf = input.asOf ?? new Date();
  const seasonalFactor = calculateSeasonalFactor(asOf);
  const divResult = calculateDivisionAverage(
    input.rows,
    input.division,
    input.nationalRows,
    input.fallbackPrice,
  );

  const normTarget = input.division?.trim().toLowerCase();
  const hasDivisionRows =
    Boolean(normTarget) && input.rows.some((r) => r.division?.trim().toLowerCase() === normTarget);

  const trendRows = hasDivisionRows
    ? input.rows.filter((r) => r.division?.trim().toLowerCase() === normTarget)
    : input.nationalRows && input.nationalRows.length > 0
      ? input.nationalRows
      : input.rows;

  const trendResult = calculate7DayTrend(trendRows);
  const gradeMultiplier = getGradeMultiplier(input.grade);

  // Compute seasonal division baseline: combines recent moving average with seasonal division level
  const seasonalDivisionAvg =
    trendResult.recent7DayAvg !== null
      ? 0.85 * trendResult.recent7DayAvg + 0.15 * (divResult.average * seasonalFactor)
      : divResult.average * seasonalFactor;

  const rawExpected = seasonalDivisionAvg * trendResult.trendFactor * gradeMultiplier;
  const expectedPerKg = Math.max(1, Math.round(rawExpected));

  const { bandWidth, confidence } = calculateSparseBandWidth(divResult.sampleCount);
  const lowPerKg = Math.max(
    1,
    Math.min(expectedPerKg, Math.round(expectedPerKg * (1 - bandWidth))),
  );
  const highPerKg = Math.max(expectedPerKg, Math.round(expectedPerKg * (1 + bandWidth)));

  const explanation = generatePriceReasonItems({
    grade: input.grade,
    trend: trendResult.trend,
    sampleCount: divResult.sampleCount,
    changePercent: trendResult.changePercent,
    division: input.division,
    divisionDeviationPercent: divResult.divisionDeviationPercent,
  });

  const guidance: PriceGuidance = {
    lowPerKg,
    expectedPerKg,
    highPerKg,
    trend: trendResult.trend,
    confidence,
    explanation,
    modelVersion: "seasonal-baseline-v1",
    provider: "baseline",
    degraded: false,
    generatedAt: asOf.toISOString(),
    suggestedFloorPerKg: lowPerKg,
  };

  return priceGuidanceSchema.parse(guidance);
}
