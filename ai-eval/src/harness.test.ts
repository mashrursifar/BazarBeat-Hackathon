import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MajorityClassGradingProvider,
  createConfiguredMockProvider,
  determineMajorityClass,
} from "./baselines.js";
import {
  buildConfusionMatrix,
  calculateAdversarialPassRate,
  calculateCropMismatchDetection,
  calculateLatencyMetrics,
  calculateMacroF1,
  calculatePerClassMetrics,
} from "./metrics.js";
import { loadManifest, runEvaluation } from "./runner.js";
import { type EvaluationItemResult, type ManifestEntry, datasetManifestSchema } from "./types.js";

const EVAL_DIR = path.resolve(process.cwd(), "ai-eval");
const MANIFEST_PATH = path.resolve(EVAL_DIR, "manifest.json");

describe("AI Evaluation Manifest & Dataset Integrity", () => {
  it("manifest file exists and strictly parses against datasetManifestSchema", async () => {
    const rawContent = await fs.promises.readFile(MANIFEST_PATH, "utf-8");
    const json = JSON.parse(rawContent) as unknown;
    const parsed = datasetManifestSchema.parse(json);

    expect(parsed.version).toBe("1.0.0");
    expect(parsed.entries.length).toBeGreaterThanOrEqual(50);
  });

  it("all images listed in manifest physically exist on disk and are readable", async () => {
    const manifest = await loadManifest(MANIFEST_PATH);

    for (const entry of manifest.entries) {
      const fullPath = path.resolve(EVAL_DIR, entry.imagePath);
      expect(fs.existsSync(fullPath), `Missing image file: ${entry.imagePath}`).toBe(true);
      const stat = await fs.promises.stat(fullPath);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it("manifest maintains strict isolation between dev and test splits", async () => {
    const manifest = await loadManifest(MANIFEST_PATH);

    const devEntries = manifest.entries.filter((e) => e.split === "dev");
    const testEntries = manifest.entries.filter((e) => e.split === "test");

    expect(devEntries.length).toBeGreaterThan(0);
    expect(testEntries.length).toBeGreaterThan(0);

    const devIds = new Set(devEntries.map((e) => e.id));
    const testIds = new Set(testEntries.map((e) => e.id));

    // No ID overlap between splits
    for (const id of devIds) {
      expect(testIds.has(id)).toBe(false);
    }

    const devPaths = new Set(devEntries.map((e) => e.imagePath));
    const testPaths = new Set(testEntries.map((e) => e.imagePath));

    // No image file overlap between splits
    for (const p of devPaths) {
      expect(testPaths.has(p)).toBe(false);
    }
  });

  it("manifest contains required tags, negative items, and adversarial items", async () => {
    const manifest = await loadManifest(MANIFEST_PATH);

    const negativeItems = manifest.entries.filter((e) => e.tags.includes("negative"));
    const adversarialItems = manifest.entries.filter((e) => e.tags.includes("adversarial"));

    expect(negativeItems.length).toBeGreaterThanOrEqual(15);
    expect(adversarialItems.length).toBeGreaterThanOrEqual(4);

    // Negative items have null groundTruthGrade
    for (const item of negativeItems) {
      expect(item.groundTruthGrade).toBeNull();
    }

    // Adversarial items have non-null groundTruthGrade and text_in_image tag
    for (const item of adversarialItems) {
      expect(item.groundTruthGrade).not.toBeNull();
      expect(item.tags).toContain("text_in_image");
    }
  });

  it("manifest covers all 5 catalog crops across grades A, B, and C in both splits", async () => {
    const manifest = await loadManifest(MANIFEST_PATH);
    const catalogCrops = ["onion", "green-chilli", "bitter-gourd", "eggplant", "potato"];

    for (const split of ["dev", "test"] as const) {
      for (const crop of catalogCrops) {
        for (const grade of ["A", "B", "C"] as const) {
          const matching = manifest.entries.filter(
            (e) =>
              e.split === split &&
              e.crop === crop &&
              e.groundTruthGrade === grade &&
              e.tags.includes("standard"),
          );
          expect(
            matching.length,
            `Expected at least one standard ${grade} ${crop} sample in ${split} split`,
          ).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("Metrics Calculation Math & Edge Cases", () => {
  it("correctly computes confusion matrix, per-class precision, recall, and F1", () => {
    const mockResults: EvaluationItemResult[] = [
      // 2 A's: 1 predicted A, 1 predicted B
      {
        entry: {
          id: "1",
          imagePath: "p1",
          crop: "onion",
          groundTruthGrade: "A",
          source: "test",
          license: "test",
          split: "dev",
          tags: ["standard"],
        },
        predictedGrade: "A",
        cropMatch: true,
        confidence: 0.9,
        latencyMs: 10,
        isCorrect: true,
        error: null,
      },
      {
        entry: {
          id: "2",
          imagePath: "p2",
          crop: "onion",
          groundTruthGrade: "A",
          source: "test",
          license: "test",
          split: "dev",
          tags: ["standard"],
        },
        predictedGrade: "B",
        cropMatch: true,
        confidence: 0.8,
        latencyMs: 12,
        isCorrect: false,
        error: null,
      },
      // 2 B's: 2 predicted B
      {
        entry: {
          id: "3",
          imagePath: "p3",
          crop: "onion",
          groundTruthGrade: "B",
          source: "test",
          license: "test",
          split: "dev",
          tags: ["standard"],
        },
        predictedGrade: "B",
        cropMatch: true,
        confidence: 0.85,
        latencyMs: 15,
        isCorrect: true,
        error: null,
      },
      {
        entry: {
          id: "4",
          imagePath: "p4",
          crop: "onion",
          groundTruthGrade: "B",
          source: "test",
          license: "test",
          split: "dev",
          tags: ["standard"],
        },
        predictedGrade: "B",
        cropMatch: true,
        confidence: 0.85,
        latencyMs: 11,
        isCorrect: true,
        error: null,
      },
      // 1 C: 1 predicted C
      {
        entry: {
          id: "5",
          imagePath: "p5",
          crop: "onion",
          groundTruthGrade: "C",
          source: "test",
          license: "test",
          split: "dev",
          tags: ["standard"],
        },
        predictedGrade: "C",
        cropMatch: true,
        confidence: 0.95,
        latencyMs: 8,
        isCorrect: true,
        error: null,
      },
    ];

    const matrix = buildConfusionMatrix(mockResults);
    expect(matrix.A).toEqual({ A: 1, B: 1, C: 0, otherOrNull: 0 });
    expect(matrix.B).toEqual({ A: 0, B: 2, C: 0, otherOrNull: 0 });
    expect(matrix.C).toEqual({ A: 0, B: 0, C: 1, otherOrNull: 0 });

    const perClass = calculatePerClassMetrics(matrix);

    // Class A: TP=1, FP=0, FN=1 -> Precision=1.0, Recall=0.5, F1 = 2*(1*0.5)/1.5 = 0.6667
    expect(perClass.A.precision).toBe(1);
    expect(perClass.A.recall).toBe(0.5);
    expect(perClass.A.f1).toBe(0.6667);
    expect(perClass.A.support).toBe(2);

    // Class B: TP=2, FP=1 (from A), FN=0 -> Precision=2/3=0.6667, Recall=1.0, F1 = 2*(2/3*1)/(5/3) = 0.8
    expect(perClass.B.precision).toBe(0.6667);
    expect(perClass.B.recall).toBe(1);
    expect(perClass.B.f1).toBe(0.8);
    expect(perClass.B.support).toBe(2);

    // Class C: TP=1, FP=0, FN=0 -> Precision=1.0, Recall=1.0, F1=1.0
    expect(perClass.C.precision).toBe(1);
    expect(perClass.C.recall).toBe(1);
    expect(perClass.C.f1).toBe(1);
    expect(perClass.C.support).toBe(1);

    const macroF1 = calculateMacroF1(perClass);
    // (0.6667 + 0.8 + 1.0) / 3 = 2.4667 / 3 = 0.8222
    expect(macroF1).toBe(0.8222);
  });

  it("handles zero support and zero division gracefully without NaN", () => {
    const emptyMatrix = {
      A: { A: 0, B: 0, C: 0, otherOrNull: 0 },
      B: { A: 0, B: 0, C: 0, otherOrNull: 0 },
      C: { A: 0, B: 0, C: 0, otherOrNull: 0 },
    };

    const perClass = calculatePerClassMetrics(emptyMatrix);
    expect(perClass.A.precision).toBe(0);
    expect(perClass.A.recall).toBe(0);
    expect(perClass.A.f1).toBe(0);

    const macroF1 = calculateMacroF1(perClass);
    expect(macroF1).toBe(0);
  });

  it("calculates crop mismatch detection rate and adversarial pass rate correctly", () => {
    const results: EvaluationItemResult[] = [
      // 2 negative items: 1 detected mismatch, 1 failed to detect
      {
        entry: {
          id: "neg1",
          imagePath: "neg1",
          crop: "banana",
          groundTruthGrade: null,
          source: "t",
          license: "t",
          split: "dev",
          tags: ["negative"],
        },
        predictedGrade: null,
        cropMatch: false,
        confidence: 0,
        latencyMs: 5,
        isCorrect: true,
        error: null,
      },
      {
        entry: {
          id: "neg2",
          imagePath: "neg2",
          crop: "tool",
          groundTruthGrade: null,
          source: "t",
          license: "t",
          split: "dev",
          tags: ["negative"],
        },
        predictedGrade: "A",
        cropMatch: true,
        confidence: 0.9,
        latencyMs: 5,
        isCorrect: false,
        error: null,
      },
      // 2 adversarial items: 1 passed (correct grade C), 1 failed (fooled to predict A)
      {
        entry: {
          id: "adv1",
          imagePath: "adv1",
          crop: "onion",
          groundTruthGrade: "C",
          source: "t",
          license: "t",
          split: "dev",
          tags: ["adversarial"],
        },
        predictedGrade: "C",
        cropMatch: true,
        confidence: 0.8,
        latencyMs: 5,
        isCorrect: true,
        error: null,
      },
      {
        entry: {
          id: "adv2",
          imagePath: "adv2",
          crop: "onion",
          groundTruthGrade: "C",
          source: "t",
          license: "t",
          split: "dev",
          tags: ["adversarial"],
        },
        predictedGrade: "A",
        cropMatch: true,
        confidence: 0.9,
        latencyMs: 5,
        isCorrect: false,
        error: null,
      },
    ];

    const mismatchRate = calculateCropMismatchDetection(results);
    expect(mismatchRate).toBe(0.5);

    const advRate = calculateAdversarialPassRate(results);
    expect(advRate).toBe(0.5);
  });

  it("computes latency statistics accurately", () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const stats = calculateLatencyMetrics(latencies);

    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(100);
    expect(stats.meanMs).toBe(55);
    expect(stats.medianMs).toBe(55);
    expect(stats.p95Ms).toBe(100);
  });
});

describe("Baselines & Evaluation Runner Integration", () => {
  it("determines majority class from entries accurately", () => {
    const entries: ManifestEntry[] = [
      {
        id: "1",
        imagePath: "p1",
        crop: "onion",
        groundTruthGrade: "B",
        source: "t",
        license: "t",
        split: "dev",
        tags: [],
      },
      {
        id: "2",
        imagePath: "p2",
        crop: "onion",
        groundTruthGrade: "B",
        source: "t",
        license: "t",
        split: "dev",
        tags: [],
      },
      {
        id: "3",
        imagePath: "p3",
        crop: "onion",
        groundTruthGrade: "A",
        source: "t",
        license: "t",
        split: "dev",
        tags: [],
      },
    ];

    expect(determineMajorityClass(entries)).toBe("B");
  });

  it("MajorityClassGradingProvider returns valid assessment contract", async () => {
    const provider = new MajorityClassGradingProvider("B");
    const assessment = await provider.assessQuality({
      cropId: "onion",
      images: [Buffer.from("fake-image")],
    });

    expect(assessment.grade).toBe("B");
    expect(assessment.cropMatch).toBe(true);
    expect(assessment.confidenceBand).toBe("MEDIUM");
    expect(assessment.classProbabilities.B).toBe(0.5);
  });

  it("runs evaluation on dev split using MajorityClassBaseline end-to-end", async () => {
    const manifest = await loadManifest(MANIFEST_PATH);
    const devEntries = manifest.entries.filter((e) => e.split === "dev");
    const provider = MajorityClassGradingProvider.fromManifestEntries(devEntries);

    const { metrics, results } = await runEvaluation(provider, {
      split: "dev",
      manifestPath: MANIFEST_PATH,
      writeResults: false,
    });

    expect(metrics.split).toBe("dev");
    expect(metrics.totalSamples).toBe(devEntries.length);
    expect(results.length).toBe(devEntries.length);
    expect(metrics.macroF1).toBeGreaterThanOrEqual(0);
    expect(metrics.overallAccuracy).toBeGreaterThanOrEqual(0);
    expect(metrics.latency.meanMs).toBeGreaterThanOrEqual(0);
  });

  it("runs evaluation on dev split using MockGradingProvider end-to-end", async () => {
    const provider = createConfiguredMockProvider();

    const { metrics, results } = await runEvaluation(provider, {
      split: "dev",
      manifestPath: MANIFEST_PATH,
      writeResults: false,
    });

    expect(metrics.split).toBe("dev");
    expect(metrics.provider).toBe("MockGradingProvider");
    expect(results.length).toBeGreaterThan(0);
    expect(metrics.overallAccuracy).toBeGreaterThan(0);
    expect(
      metrics.confusionMatrix.A.A + metrics.confusionMatrix.A.B + metrics.confusionMatrix.A.C,
    ).toBe(metrics.perClass.A.support);
  });

  it("runner strictly filters by split and does not touch test split when split=dev", async () => {
    const provider = createConfiguredMockProvider();

    const { results } = await runEvaluation(provider, {
      split: "dev",
      manifestPath: MANIFEST_PATH,
      writeResults: false,
    });

    for (const res of results) {
      expect(res.entry.split).toBe("dev");
    }
  });
});
