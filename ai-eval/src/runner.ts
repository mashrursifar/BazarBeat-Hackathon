import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { GradingProvider } from "../../apps/api/src/modules/ai/interfaces.js";
import { calculateMetrics } from "./metrics.js";
import {
  type DatasetManifest,
  type DatasetSplit,
  type EvaluationItemResult,
  type EvaluationMetrics,
  type ManifestEntry,
  datasetManifestSchema,
} from "./types.js";

export interface EvaluationRunnerOptions {
  split?: DatasetSplit | "all";
  manifestPath?: string;
  datasetDir?: string;
  outputDir?: string;
  writeResults?: boolean;
  providerName?: string;
  onProgress?: (current: number, total: number, result: EvaluationItemResult) => void;
}

export async function loadManifest(manifestPath: string): Promise<DatasetManifest> {
  const content = await fs.readFile(manifestPath, "utf-8");
  const parsed = JSON.parse(content) as unknown;
  return datasetManifestSchema.parse(parsed);
}

export async function evaluateSingleItem(
  provider: GradingProvider,
  entry: ManifestEntry,
  datasetDir: string,
): Promise<EvaluationItemResult> {
  const fullImagePath = path.isAbsolute(entry.imagePath)
    ? entry.imagePath
    : path.resolve(datasetDir, entry.imagePath);

  let imageBuffer: Buffer;
  try {
    imageBuffer = await fs.readFile(fullImagePath);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      entry,
      predictedGrade: null,
      cropMatch: false,
      confidence: 0,
      latencyMs: 0,
      isCorrect: false,
      error: `Failed to read image at ${fullImagePath}: ${errorMsg}`,
    };
  }

  const start = performance.now();
  try {
    const assessment = await provider.assessQuality({
      cropId: entry.crop,
      images: [imageBuffer],
    });
    const latencyMs = performance.now() - start;

    const predictedGrade = assessment.grade ?? null;
    const cropMatch = assessment.cropMatch ?? false;

    // Determine correctness based on ground truth and cropMatch
    let isCorrect = false;
    if (entry.groundTruthGrade === null) {
      // For negative / non-crop samples, success is identifying crop mismatch or unavailable grade
      isCorrect = !cropMatch || predictedGrade === null;
    } else {
      isCorrect = cropMatch && predictedGrade === entry.groundTruthGrade;
    }

    return {
      entry,
      predictedGrade,
      cropMatch,
      confidence: assessment.confidence ?? 0,
      latencyMs,
      isCorrect,
      error: null,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // If an error indicates crop mismatch or rejection, treat as cropMatch = false
    const isMismatchError =
      errorMsg.includes("CROP_MISMATCH") ||
      errorMsg.includes("Crop not found") ||
      errorMsg.includes("VALIDATION_ERROR");

    let isCorrect = false;
    if (entry.groundTruthGrade === null && isMismatchError) {
      isCorrect = true;
    }

    return {
      entry,
      predictedGrade: null,
      cropMatch: false,
      confidence: 0,
      latencyMs,
      isCorrect,
      error: errorMsg,
    };
  }
}

export async function runEvaluation(
  provider: GradingProvider,
  options: EvaluationRunnerOptions = {},
): Promise<{ metrics: EvaluationMetrics; results: EvaluationItemResult[] }> {
  const rootDir = process.cwd();
  const datasetDir = options.datasetDir ?? path.resolve(rootDir, "ai-eval");
  const manifestPath = options.manifestPath ?? path.resolve(datasetDir, "manifest.json");
  const outputDir = options.outputDir ?? path.resolve(datasetDir, "results");
  const split: DatasetSplit | "all" = options.split ?? "dev";
  const writeResults = options.writeResults ?? true;
  const providerName = options.providerName ?? provider.constructor.name;

  if (split === "test") {
    // Audit notice: test split should remain untouched during tuning
    process.stderr.write(
      "[AI-EVAL NOTICE] Evaluating held-out TEST split. Keep this split frozen during prompt tuning.\n",
    );
  }

  const manifest = await loadManifest(manifestPath);

  // Filter items by target split
  const targetEntries = manifest.entries.filter((entry) => {
    if (split === "all") return true;
    return entry.split === split;
  });

  if (targetEntries.length === 0) {
    throw new Error(`No entries found in dataset manifest for split: ${split}`);
  }

  const results: EvaluationItemResult[] = [];
  for (let i = 0; i < targetEntries.length; i++) {
    const entry = targetEntries[i];
    if (!entry) continue;

    const result = await evaluateSingleItem(provider, entry, datasetDir);
    results.push(result);

    if (options.onProgress) {
      options.onProgress(i + 1, targetEntries.length, result);
    }
  }

  const metrics = calculateMetrics(results, providerName, split);

  if (writeResults) {
    await fs.mkdir(outputDir, { recursive: true });
    const safeProviderName = providerName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filename = `${safeProviderName}-${split}-metrics.json`;
    const outputPath = path.resolve(outputDir, filename);

    await fs.writeFile(outputPath, JSON.stringify(metrics, null, 2), "utf-8");
  }

  return { metrics, results };
}
