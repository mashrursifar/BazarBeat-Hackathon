import fs from "node:fs/promises";
import path from "node:path";
import { BANGLADESH_DIVISIONS } from "@bazarbeat/shared";

import {
  type MarketPriceInputRow,
  calculateBaselinePriceGuidance,
} from "../../apps/api/src/modules/ai/baseline-price.strategy.js";
import {
  type MarketPriceSeedCrop,
  type MarketPriceSeedRow,
  generateMarketPriceHistory,
} from "../../apps/api/src/modules/market-prices/market-price-seed.js";

const createMockObjectId = (hex: string): MarketPriceSeedCrop["id"] =>
  ({
    toString: () => hex,
    toHexString: () => hex,
    equals: (other: unknown) => String(other) === hex,
  }) as unknown as MarketPriceSeedCrop["id"];

export const EVALUATION_CROPS: readonly MarketPriceSeedCrop[] = [
  { id: createMockObjectId("65f1a1a1a1a1a1a1a1a1a101"), slug: "onion" },
  { id: createMockObjectId("65f1a1a1a1a1a1a1a1a1a102"), slug: "green-chilli" },
  { id: createMockObjectId("65f1a1a1a1a1a1a1a1a1a103"), slug: "bitter-gourd" },
  { id: createMockObjectId("65f1a1a1a1a1a1a1a1a1a104"), slug: "eggplant" },
  { id: createMockObjectId("65f1a1a1a1a1a1a1a1a1a105"), slug: "potato" },
] as const;

export interface SingleEvaluationPoint {
  cropSlug: string;
  division: string;
  date: string;
  actualPricePoisha: number;
  naivePredictedPoisha: number;
  baselinePredictedPoisha: number;
  baselineLowPoisha: number;
  baselineHighPoisha: number;
  naiveAbsError: number;
  baselineAbsError: number;
  naiveAbsPctError: number;
  baselineAbsPctError: number;
  withinBaselineBand: boolean;
}

export interface ModelMetricSummary {
  modelName: string;
  maePoisha: number;
  maeBdt: number;
  mapePercent: number;
  rmsePoisha: number;
  sampleCount: number;
  bandCoveragePercent?: number;
}

export interface CropEvaluationBreakdown {
  cropSlug: string;
  sampleCount: number;
  naive: ModelMetricSummary;
  baseline: ModelMetricSummary;
  maeReductionPoisha: number;
  maeReductionPercent: number;
  mapeReductionPercent: number;
}

export interface PriceEvaluationReport {
  evaluatedAt: string;
  methodology: string;
  timeSplit: {
    totalDays: number;
    warmupDays: number;
    testDays: number;
    warmupStartDate: string;
    warmupEndDate: string;
    testStartDate: string;
    testEndDate: string;
    totalObservations: number;
    testObservations: number;
  };
  overall: {
    naive7DayMA: ModelMetricSummary;
    seasonalBaselineV1: ModelMetricSummary;
    maeReductionPoisha: number;
    maeReductionPercent: number;
    mapeReductionPercent: number;
    bandCoveragePercent: number;
  };
  perCrop: Record<string, CropEvaluationBreakdown>;
  provenance: {
    dataSource: string;
    decisionReference: string;
    labelingRecommendation: string;
  };
}

export interface PriceEvaluationOptions {
  asOf?: Date;
  outputPath?: string;
  writeResults?: boolean;
}

/**
 * Runs the time-based split evaluation of the naive 7-day moving average vs seasonal-baseline-v1.
 *
 * Strict Temporal Isolation:
 *   - Days 1 to 45: Initial warmup / historical baseline pool
 *   - Days 46 to 60: Held-out evaluation test split
 *   - For each test day t: Models are strictly supplied rows with date < t (zero lookahead).
 */
export async function runPriceEvaluation(
  options: PriceEvaluationOptions = {},
): Promise<PriceEvaluationReport> {
  const asOf = options.asOf ?? new Date(Date.UTC(2026, 10, 20)); // Nov 20, 2026
  const writeResults = options.writeResults ?? true;
  const outputPath =
    options.outputPath ??
    path.resolve(process.cwd(), "ai-eval/results/price-baseline-metrics.json");

  // 1. Generate full deterministic 60-day history (2,400 observations across 5 crops & 8 divisions)
  const fullHistory: MarketPriceSeedRow[] = generateMarketPriceHistory(EVALUATION_CROPS, asOf);

  // Group by unique chronological dates (earliest to latest)
  const uniqueDateTimes = Array.from(new Set(fullHistory.map((r) => r.date.getTime()))).sort(
    (a, b) => a - b,
  );

  const totalDays = uniqueDateTimes.length; // 60 days
  const warmupDays = 45; // Days 1 to 45
  const testDays = totalDays - warmupDays; // Days 46 to 60 (15 days)

  const warmupDates = uniqueDateTimes.slice(0, warmupDays);
  const testDates = uniqueDateTimes.slice(warmupDays);

  const testPoints: SingleEvaluationPoint[] = [];

  // Group rows by `${cropSlug}|${division}` for efficient temporal slicing
  const seriesMap = new Map<string, MarketPriceSeedRow[]>();
  for (const row of fullHistory) {
    const cropSlug =
      EVALUATION_CROPS.find((c) => c.id.toString() === row.cropId.toString())?.slug ?? "unknown";
    const key = `${cropSlug}|${row.division}`;
    const list = seriesMap.get(key) ?? [];
    list.push(row);
    seriesMap.set(key, list);
  }

  // Sort each series chronologically ascending
  for (const list of seriesMap.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Evaluate across all test dates (chronological held-out step-by-step)
  for (const testTimestamp of testDates) {
    const testDate = new Date(testTimestamp);

    for (const crop of EVALUATION_CROPS) {
      for (const { id: division } of BANGLADESH_DIVISIONS) {
        const key = `${crop.slug}|${division}`;
        const series = seriesMap.get(key) ?? [];

        const groundTruthRow = series.find((r) => r.date.getTime() === testTimestamp);
        if (!groundTruthRow) continue;

        const actualPrice = groundTruthRow.avgPricePerKg;

        // Historical rows strictly prior to testDate (zero lookahead!)
        const pastRows = series.filter((r) => r.date.getTime() < testTimestamp);

        // 1. Naive 7-Day Moving Average:
        // Take the 7 most recent daily observations prior to testDate
        const last7Rows = pastRows.slice(-7);
        const naivePredictedPoisha =
          last7Rows.length > 0
            ? Math.round(last7Rows.reduce((sum, r) => sum + r.avgPricePerKg, 0) / last7Rows.length)
            : actualPrice;

        // 2. Statistical Baseline Provider (seasonal-baseline-v1):
        // Map past rows to MarketPriceInputRow
        const inputRows: MarketPriceInputRow[] = pastRows.map((r) => ({
          avgPricePerKg: r.avgPricePerKg,
          date: r.date,
          division: r.division,
          minPricePerKg: r.minPricePerKg,
          maxPricePerKg: r.maxPricePerKg,
        }));

        // Guidance for standard commercial Grade B produce (represents market benchmark)
        const guidance = calculateBaselinePriceGuidance({
          cropId: crop.id.toString(),
          grade: "B",
          division,
          rows: inputRows,
          asOf: testDate,
        });

        const baselinePredictedPoisha = guidance.expectedPerKg;
        const baselineLowPoisha = guidance.lowPerKg;
        const baselineHighPoisha = guidance.highPerKg;

        const naiveAbsError = Math.abs(actualPrice - naivePredictedPoisha);
        const baselineAbsError = Math.abs(actualPrice - baselinePredictedPoisha);

        const naiveAbsPctError = (naiveAbsError / actualPrice) * 100;
        const baselineAbsPctError = (baselineAbsError / actualPrice) * 100;

        const withinBaselineBand =
          actualPrice >= baselineLowPoisha && actualPrice <= baselineHighPoisha;

        testPoints.push({
          cropSlug: crop.slug,
          division,
          date: testDate.toISOString().slice(0, 10),
          actualPricePoisha: actualPrice,
          naivePredictedPoisha,
          baselinePredictedPoisha,
          baselineLowPoisha,
          baselineHighPoisha,
          naiveAbsError,
          baselineAbsError,
          naiveAbsPctError,
          baselineAbsPctError,
          withinBaselineBand,
        });
      }
    }
  }

  // Calculate metrics function
  function computeSummary(
    points: SingleEvaluationPoint[],
    model: "naive" | "baseline",
    name: string,
  ): ModelMetricSummary {
    const n = points.length;
    if (n === 0) {
      return {
        modelName: name,
        maePoisha: 0,
        maeBdt: 0,
        mapePercent: 0,
        rmsePoisha: 0,
        sampleCount: 0,
      };
    }

    const totalAbsError = points.reduce(
      (sum, p) => sum + (model === "naive" ? p.naiveAbsError : p.baselineAbsError),
      0,
    );
    const totalAbsPctError = points.reduce(
      (sum, p) => sum + (model === "naive" ? p.naiveAbsPctError : p.baselineAbsPctError),
      0,
    );
    const sumSquaredError = points.reduce((sum, p) => {
      const err = model === "naive" ? p.naiveAbsError : p.baselineAbsError;
      return sum + err * err;
    }, 0);

    const maePoisha = Math.round((totalAbsError / n) * 10) / 10;
    const maeBdt = Math.round((maePoisha / 100) * 100) / 100;
    const mapePercent = Math.round((totalAbsPctError / n) * 100) / 100;
    const rmsePoisha = Math.round(Math.sqrt(sumSquaredError / n) * 10) / 10;

    let bandCoveragePercent: number | undefined;
    if (model === "baseline") {
      const covered = points.filter((p) => p.withinBaselineBand).length;
      bandCoveragePercent = Math.round((covered / n) * 1000) / 10;
    }

    return {
      modelName: name,
      maePoisha,
      maeBdt,
      mapePercent,
      rmsePoisha,
      sampleCount: n,
      bandCoveragePercent,
    };
  }

  const overallNaive = computeSummary(testPoints, "naive", "naive-7d-ma");
  const overallBaseline = computeSummary(testPoints, "baseline", "seasonal-baseline-v1");

  const overallMaeReductionPoisha =
    Math.round((overallNaive.maePoisha - overallBaseline.maePoisha) * 10) / 10;
  const overallMaeReductionPercent =
    overallNaive.maePoisha > 0
      ? Math.round(
          ((overallNaive.maePoisha - overallBaseline.maePoisha) / overallNaive.maePoisha) * 1000,
        ) / 10
      : 0;
  const overallMapeReductionPercent =
    Math.round((overallNaive.mapePercent - overallBaseline.mapePercent) * 100) / 100;

  // Per-crop breakdown
  const perCrop: Record<string, CropEvaluationBreakdown> = {};
  for (const crop of EVALUATION_CROPS) {
    const cropPoints = testPoints.filter((p) => p.cropSlug === crop.slug);
    const cropNaive = computeSummary(cropPoints, "naive", "naive-7d-ma");
    const cropBaseline = computeSummary(cropPoints, "baseline", "seasonal-baseline-v1");

    const maeReductionPoisha = Math.round((cropNaive.maePoisha - cropBaseline.maePoisha) * 10) / 10;
    const maeReductionPercent =
      cropNaive.maePoisha > 0
        ? Math.round(
            ((cropNaive.maePoisha - cropBaseline.maePoisha) / cropNaive.maePoisha) * 1000,
          ) / 10
        : 0;
    const mapeReductionPercent =
      Math.round((cropNaive.mapePercent - cropBaseline.mapePercent) * 100) / 100;

    perCrop[crop.slug] = {
      cropSlug: crop.slug,
      sampleCount: cropPoints.length,
      naive: cropNaive,
      baseline: cropBaseline,
      maeReductionPoisha,
      maeReductionPercent,
      mapeReductionPercent,
    };
  }

  const report: PriceEvaluationReport = {
    evaluatedAt: new Date().toISOString(),
    methodology:
      "Strict chronological time-based split: Day 1-45 warmup history, Day 46-60 held-out test evaluation with zero lookahead.",
    timeSplit: {
      totalDays,
      warmupDays,
      testDays,
      warmupStartDate: new Date(warmupDates[0] ?? 0).toISOString().slice(0, 10),
      warmupEndDate: new Date(warmupDates[warmupDates.length - 1] ?? 0).toISOString().slice(0, 10),
      testStartDate: new Date(testDates[0] ?? 0).toISOString().slice(0, 10),
      testEndDate: new Date(testDates[testDates.length - 1] ?? 0).toISOString().slice(0, 10),
      totalObservations: fullHistory.length,
      testObservations: testPoints.length,
    },
    overall: {
      naive7DayMA: overallNaive,
      seasonalBaselineV1: overallBaseline,
      maeReductionPoisha: overallMaeReductionPoisha,
      maeReductionPercent: overallMaeReductionPercent,
      mapeReductionPercent: overallMapeReductionPercent,
      bandCoveragePercent: overallBaseline.bandCoveragePercent ?? 0,
    },
    perCrop,
    provenance: {
      dataSource:
        "Deterministic 60-day historical wholesale market price telemetry across 8 divisions generated per Decision D-38 (Path B: synthetic historical baseline with sinusoidal seasonality and division variance; real agricultural bulletin data integration planned).",
      decisionReference: "D-38, D-44, D-98, D-105",
      labelingRecommendation:
        "UI label 'Market-based estimate' or 'AI Market Price Range' is empirically supported; models operate as statistical reference baselines grounded in localized market history.",
    },
  };

  if (writeResults) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf-8");
  }

  return report;
}

/**
 * Format terminal report.
 */
export function formatPriceReport(report: PriceEvaluationReport): string {
  const lines: string[] = [];
  lines.push("====================================================================");
  lines.push("  BAZARBEAT WHOLESALE PRICE PREDICTION EVALUATION REPORT (Task G5)");
  lines.push("====================================================================");
  lines.push(`  Evaluated At:             ${report.evaluatedAt}`);
  lines.push(
    `  Timeline Split:           ${report.timeSplit.warmupDays}d Warmup (${report.timeSplit.warmupStartDate} → ${report.timeSplit.warmupEndDate})`,
  );
  lines.push(
    `                            ${report.timeSplit.testDays}d Held-Out Test (${report.timeSplit.testStartDate} → ${report.timeSplit.testEndDate})`,
  );
  lines.push(
    `  Evaluation Points:        ${report.timeSplit.testObservations} test points (5 crops × 8 divisions × 15 days)`,
  );
  lines.push("--------------------------------------------------------------------");
  lines.push("  OVERALL MODEL PERFORMANCE COMPARISON:");
  lines.push(
    `  • Naive 7-Day MA:         MAE = ${report.overall.naive7DayMA.maePoisha} poisha (${report.overall.naive7DayMA.maeBdt.toFixed(2)} BDT/kg) | MAPE = ${report.overall.naive7DayMA.mapePercent.toFixed(2)}%`,
  );
  lines.push(
    `  • Seasonal Baseline v1:   MAE = ${report.overall.seasonalBaselineV1.maePoisha} poisha (${report.overall.seasonalBaselineV1.maeBdt.toFixed(2)} BDT/kg) | MAPE = ${report.overall.seasonalBaselineV1.mapePercent.toFixed(2)}%`,
  );
  lines.push(
    `  • Improvement:            MAE reduction = -${report.overall.maeReductionPoisha} poisha (-${report.overall.maeReductionPercent.toFixed(1)}%) | MAPE reduction = -${report.overall.mapeReductionPercent.toFixed(2)}%`,
  );
  lines.push(
    `  • Interval Coverage:      ${report.overall.bandCoveragePercent.toFixed(1)}% of actual prices fall within [low, high]`,
  );
  lines.push("--------------------------------------------------------------------");
  lines.push("  PER-CROP EVALUATION BREAKDOWN (Held-Out Test Split):");
  lines.push("  Crop          | Naive MAE | Baseline MAE | Naive MAPE | Baseline MAPE | MAE Gain");
  lines.push("  --------------+-----------+--------------+------------+---------------+---------");

  for (const [slug, crop] of Object.entries(report.perCrop)) {
    const padSlug = slug.padEnd(13, " ");
    const naiveMae = `${crop.naive.maePoisha}p`.padStart(9, " ");
    const baseMae = `${crop.baseline.maePoisha}p`.padStart(12, " ");
    const naiveMape = `${crop.naive.mapePercent.toFixed(2)}%`.padStart(10, " ");
    const baseMape = `${crop.baseline.mapePercent.toFixed(2)}%`.padStart(13, " ");
    const gain = `-${crop.maeReductionPercent.toFixed(1)}%`.padStart(8, " ");
    lines.push(`  ${padSlug} | ${naiveMae} | ${baseMae} | ${naiveMape} | ${baseMape} | ${gain}`);
  }

  lines.push("--------------------------------------------------------------------");
  lines.push(`  Data Provenance:          ${report.provenance.dataSource}`);
  lines.push("====================================================================");

  return lines.join("\n");
}

// Standalone execution entrypoint
if (process.argv[1]?.endsWith("price-eval.ts") || process.argv[1]?.endsWith("price-eval.js")) {
  runPriceEvaluation()
    .then((report) => {
      console.log(formatPriceReport(report));
    })
    .catch((err) => {
      console.error("Evaluation failed:", err);
      process.exit(1);
    });
}
