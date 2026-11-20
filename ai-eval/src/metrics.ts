import type { CropGrade } from "@bazarbeat/shared";
import type {
  ConfusionMatrix,
  CropEvaluationMetrics,
  DatasetSplit,
  EvaluationItemResult,
  EvaluationMetrics,
  LatencyMetrics,
  PerClassMetrics,
} from "./types.js";

const CLASSES: readonly CropGrade[] = ["A", "B", "C"] as const;

function roundMetric(value: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function buildConfusionMatrix(results: readonly EvaluationItemResult[]): ConfusionMatrix {
  const matrix: ConfusionMatrix = {
    A: { A: 0, B: 0, C: 0, otherOrNull: 0 },
    B: { A: 0, B: 0, C: 0, otherOrNull: 0 },
    C: { A: 0, B: 0, C: 0, otherOrNull: 0 },
  };

  for (const item of results) {
    const actual = item.entry.groundTruthGrade;
    if (!actual || (actual !== "A" && actual !== "B" && actual !== "C")) {
      continue;
    }

    const row = matrix[actual];
    const pred = item.predictedGrade;
    if (pred === "A") {
      row.A += 1;
    } else if (pred === "B") {
      row.B += 1;
    } else if (pred === "C") {
      row.C += 1;
    } else {
      row.otherOrNull += 1;
    }
  }

  return matrix;
}

export function calculatePerClassMetrics(matrix: ConfusionMatrix): {
  A: PerClassMetrics;
  B: PerClassMetrics;
  C: PerClassMetrics;
} {
  const computeClass = (c: CropGrade): PerClassMetrics => {
    const tp = matrix[c][c];

    // False positives: other ground truth classes predicted as c
    let fp = 0;
    for (const otherClass of CLASSES) {
      if (otherClass !== c) {
        fp += matrix[otherClass][c];
      }
    }

    // False negatives: ground truth was c, but predicted as something else
    let fn = 0;
    const row = matrix[c];
    for (const col of CLASSES) {
      if (col !== c) {
        fn += row[col];
      }
    }
    fn += row.otherOrNull;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const support = tp + fn;

    return {
      precision: roundMetric(precision),
      recall: roundMetric(recall),
      f1: roundMetric(f1),
      support,
    };
  };

  return {
    A: computeClass("A"),
    B: computeClass("B"),
    C: computeClass("C"),
  };
}

export function calculateMacroF1(perClass: {
  A: PerClassMetrics;
  B: PerClassMetrics;
  C: PerClassMetrics;
}): number {
  const sum = perClass.A.f1 + perClass.B.f1 + perClass.C.f1;
  return roundMetric(sum / 3);
}

export function calculatePerCropMetrics(
  results: readonly EvaluationItemResult[],
): Record<string, CropEvaluationMetrics> {
  const cropMap = new Map<string, EvaluationItemResult[]>();

  for (const item of results) {
    if (!item.entry.groundTruthGrade) {
      continue;
    }
    const crop = item.entry.crop;
    const list = cropMap.get(crop) ?? [];
    list.push(item);
    cropMap.set(crop, list);
  }

  const record: Record<string, CropEvaluationMetrics> = {};

  for (const [crop, items] of cropMap.entries()) {
    const total = items.length;
    let correct = 0;
    for (const item of items) {
      if (item.isCorrect) {
        correct += 1;
      }
    }
    const accuracy = total > 0 ? roundMetric(correct / total) : 0;

    const matrix = buildConfusionMatrix(items);
    const perClass = calculatePerClassMetrics(matrix);
    const macroF1 = calculateMacroF1(perClass);

    record[crop] = {
      crop,
      total,
      correct,
      accuracy,
      macroF1,
    };
  }

  return record;
}

export function calculateCropMismatchDetection(results: readonly EvaluationItemResult[]): number {
  const negativeItems = results.filter((item) => {
    return (
      item.entry.tags.includes("negative") ||
      item.entry.tags.includes("crop_mismatch") ||
      item.entry.groundTruthGrade === null
    );
  });

  if (negativeItems.length === 0) {
    return 1;
  }

  let detected = 0;
  for (const item of negativeItems) {
    // Successfully detected mismatch if cropMatch is false or grade is null
    if (!item.cropMatch || item.predictedGrade === null) {
      detected += 1;
    }
  }

  return roundMetric(detected / negativeItems.length);
}

export function calculateAdversarialPassRate(results: readonly EvaluationItemResult[]): number {
  const adversarialItems = results.filter((item) => item.entry.tags.includes("adversarial"));

  if (adversarialItems.length === 0) {
    return 1;
  }

  let passed = 0;
  for (const item of adversarialItems) {
    // Model passed adversarial trap if it resisted the adversarial trick and correctly identified ground-truth
    if (item.isCorrect && item.cropMatch) {
      passed += 1;
    }
  }

  return roundMetric(passed / adversarialItems.length);
}

export function calculateLatencyMetrics(latenciesMs: readonly number[]): LatencyMetrics {
  if (latenciesMs.length === 0) {
    return {
      minMs: 0,
      maxMs: 0,
      meanMs: 0,
      medianMs: 0,
      p95Ms: 0,
    };
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const minMs = sorted[0] ?? 0;
  const maxMs = sorted[sorted.length - 1] ?? 0;

  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const meanMs = sum / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 !== 0
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;

  const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
  const p95Ms = sorted[p95Index] ?? 0;

  return {
    minMs: roundMetric(minMs, 2),
    maxMs: roundMetric(maxMs, 2),
    meanMs: roundMetric(meanMs, 2),
    medianMs: roundMetric(medianMs, 2),
    p95Ms: roundMetric(p95Ms, 2),
  };
}

export function calculateMetrics(
  results: readonly EvaluationItemResult[],
  providerName: string,
  split: DatasetSplit | "all",
): EvaluationMetrics {
  const gradeableResults = results.filter((item) => item.entry.groundTruthGrade !== null);
  const standardSamples = results.filter(
    (item) => !item.entry.tags.includes("negative") && !item.entry.tags.includes("adversarial"),
  );
  const negativeSamples = results.filter(
    (item) =>
      item.entry.tags.includes("negative") ||
      item.entry.tags.includes("crop_mismatch") ||
      item.entry.groundTruthGrade === null,
  );
  const adversarialSamples = results.filter((item) => item.entry.tags.includes("adversarial"));

  const confusionMatrix = buildConfusionMatrix(gradeableResults);
  const perClass = calculatePerClassMetrics(confusionMatrix);
  const macroF1 = calculateMacroF1(perClass);

  let correctCount = 0;
  for (const item of gradeableResults) {
    if (item.isCorrect) {
      correctCount += 1;
    }
  }

  const overallAccuracy =
    gradeableResults.length > 0 ? roundMetric(correctCount / gradeableResults.length) : 0;

  const perCrop = calculatePerCropMetrics(gradeableResults);
  const cropMismatchDetectionRate = calculateCropMismatchDetection(results);
  const adversarialPassRate = calculateAdversarialPassRate(results);

  const latencies = results.map((r) => r.latencyMs);
  const latency = calculateLatencyMetrics(latencies);

  return {
    provider: providerName,
    split,
    evaluatedAt: new Date().toISOString(),
    totalSamples: results.length,
    standardSamplesCount: standardSamples.length,
    negativeSamplesCount: negativeSamples.length,
    adversarialSamplesCount: adversarialSamples.length,
    overallAccuracy,
    macroF1,
    perClass,
    confusionMatrix,
    perCrop,
    cropMismatchDetectionRate,
    adversarialPassRate,
    latency,
  };
}
