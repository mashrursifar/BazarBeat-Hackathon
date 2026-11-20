import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { type PriceEvaluationReport, formatPriceReport, runPriceEvaluation } from "./price-eval.js";

describe("Price Prediction Evaluation Harness (Task G5)", () => {
  it("runs time-based split evaluation and produces valid PriceEvaluationReport", async () => {
    const report: PriceEvaluationReport = await runPriceEvaluation({
      writeResults: false,
    });

    expect(report.methodology).toContain("Strict chronological time-based split");
    expect(report.timeSplit.totalDays).toBe(60);
    expect(report.timeSplit.warmupDays).toBe(45);
    expect(report.timeSplit.testDays).toBe(15);
    expect(report.timeSplit.testObservations).toBe(600); // 5 crops * 8 divisions * 15 days

    // Overall metrics assertions
    expect(report.overall.naive7DayMA.sampleCount).toBe(600);
    expect(report.overall.seasonalBaselineV1.sampleCount).toBe(600);

    // Both models should achieve strong MAPE (~1% on synthetic wholesale telemetry)
    expect(report.overall.naive7DayMA.mapePercent).toBeLessThan(3.0);
    expect(report.overall.seasonalBaselineV1.mapePercent).toBeLessThan(3.0);

    // Baseline provider guarantees interval coverage rate >= 90%
    expect(report.overall.bandCoveragePercent).toBeGreaterThanOrEqual(95.0);

    // Per-crop breakdown covers all 5 crops
    const expectedCrops = ["onion", "green-chilli", "bitter-gourd", "eggplant", "potato"];
    for (const cropSlug of expectedCrops) {
      const crop = report.perCrop[cropSlug];
      expect(crop, `Missing crop: ${cropSlug}`).toBeDefined();
      expect(crop?.sampleCount).toBe(120); // 8 divisions * 15 days
      expect(crop?.naive.maePoisha).toBeGreaterThan(0);
      expect(crop?.baseline.maePoisha).toBeGreaterThan(0);
      expect(crop?.baseline.bandCoveragePercent).toBeGreaterThanOrEqual(95.0);
    }

    // Provenance metadata matches requirements
    expect(report.provenance.dataSource).toContain("Decision D-38");
    expect(report.provenance.decisionReference).toContain("D-105");
  });

  it("formats text summary report cleanly", async () => {
    const report = await runPriceEvaluation({ writeResults: false });
    const formatted = formatPriceReport(report);

    expect(formatted).toContain("BAZARBEAT WHOLESALE PRICE PREDICTION EVALUATION REPORT");
    expect(formatted).toContain("OVERALL MODEL PERFORMANCE COMPARISON");
    expect(formatted).toContain("PER-CROP EVALUATION BREAKDOWN");
    expect(formatted).toContain("onion");
    expect(formatted).toContain("green-chilli");
    expect(formatted).toContain("bitter-gourd");
    expect(formatted).toContain("eggplant");
    expect(formatted).toContain("potato");
  });

  it("committed results file matches report structure", async () => {
    const resultsPath = path.resolve(process.cwd(), "ai-eval/results/price-baseline-metrics.json");
    const raw = await fs.readFile(resultsPath, "utf-8");
    const json = JSON.parse(raw) as PriceEvaluationReport;

    expect(json.overall.seasonalBaselineV1.modelName).toBe("seasonal-baseline-v1");
    expect(json.overall.naive7DayMA.modelName).toBe("naive-7d-ma");
    expect(json.overall.bandCoveragePercent).toBeGreaterThanOrEqual(95.0);
  });
});
