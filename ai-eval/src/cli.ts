import path from "node:path";
import type { GradingProvider } from "../../apps/api/src/modules/ai/interfaces.js";
import { MajorityClassGradingProvider, createConfiguredMockProvider } from "./baselines.js";
import { CalibratedGeminiClient } from "./calibrated-client.js";
import { loadManifest, runEvaluation } from "./runner.js";
import type { DatasetSplit, EvaluationMetrics } from "./types.js";

interface CliArgs {
  provider: "mock" | "majority" | "gemini";
  split: DatasetSplit | "all";
  manifestPath?: string;
  outputDir?: string;
  writeResults: boolean;
  samples: number;
  promptVersion: "baseline" | "tuned";
  apiKey?: string;
  simulated: boolean;
}

function parseArgs(args: readonly string[]): CliArgs {
  let provider: "mock" | "majority" | "gemini" = "mock";
  let split: DatasetSplit | "all" = "dev";
  let manifestPath: string | undefined;
  let outputDir: string | undefined;
  let writeResults = true;
  let samples = 3;
  let promptVersion: "baseline" | "tuned" = "tuned";
  let apiKey = process.env.GEMINI_API_KEY;
  let simulated = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--provider" && args[i + 1]) {
      const val = (args[i + 1] ?? "").toLowerCase();
      if (val === "majority") {
        provider = "majority";
      } else if (val === "mock") {
        provider = "mock";
      } else if (val === "gemini") {
        provider = "gemini";
      } else {
        throw new Error(`Unknown provider "${val}". Allowed: mock, majority, gemini`);
      }
      i++;
    } else if (arg === "--split" && args[i + 1]) {
      const val = (args[i + 1] ?? "").toLowerCase();
      if (val === "dev" || val === "test" || val === "all") {
        split = val;
      } else {
        throw new Error(`Unknown split "${val}". Allowed: dev, test, all`);
      }
      i++;
    } else if (arg === "--manifest" && args[i + 1]) {
      manifestPath = args[i + 1];
      i++;
    } else if (arg === "--output" && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (arg === "--samples" && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1] ?? "3", 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        throw new Error(`Invalid sample count "${args[i + 1]}". Must be positive integer.`);
      }
      samples = parsed;
      i++;
    } else if (arg === "--prompt-version" && args[i + 1]) {
      const val = (args[i + 1] ?? "").toLowerCase();
      if (val === "baseline" || val === "tuned") {
        promptVersion = val;
      } else {
        throw new Error(`Unknown prompt version "${val}". Allowed: baseline, tuned`);
      }
      i++;
    } else if (arg === "--api-key" && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (arg === "--simulated") {
      simulated = true;
    } else if (arg === "--no-write") {
      writeResults = false;
    }
  }

  return {
    provider,
    split,
    manifestPath,
    outputDir,
    writeResults,
    samples,
    promptVersion,
    apiKey,
    simulated,
  };
}

function formatPercentage(num: number): string {
  return `${(num * 100).toFixed(1)}%`;
}

function printMetricsSummary(metrics: EvaluationMetrics): void {
  const line = "=".repeat(68);
  const subline = "-".repeat(68);

  process.stdout.write(`\n${line}\n`);
  process.stdout.write(`  BAZARBEAT AI QUALITY GRADING EVALUATION REPORT\n`);
  process.stdout.write(`${line}\n`);
  process.stdout.write(`  Provider:                 ${metrics.provider}\n`);
  process.stdout.write(`  Evaluation Split:         ${metrics.split.toUpperCase()}\n`);
  process.stdout.write(`  Evaluated At:             ${metrics.evaluatedAt}\n`);
  process.stdout.write(
    `  Total Samples:            ${metrics.totalSamples} (Standard: ${metrics.standardSamplesCount}, Negatives: ${metrics.negativeSamplesCount}, Adversarial: ${metrics.adversarialSamplesCount})\n`,
  );
  process.stdout.write(`${subline}\n`);
  process.stdout.write(
    `  Overall Accuracy:         ${formatPercentage(metrics.overallAccuracy)} (${metrics.overallAccuracy})\n`,
  );
  process.stdout.write(
    `  Macro F1 Score:           ${formatPercentage(metrics.macroF1)} (${metrics.macroF1})\n`,
  );
  process.stdout.write(
    `  Crop Mismatch Detection:  ${formatPercentage(metrics.cropMismatchDetectionRate)}\n`,
  );
  process.stdout.write(
    `  Adversarial Pass Rate:    ${formatPercentage(metrics.adversarialPassRate)}\n`,
  );
  process.stdout.write(`${subline}\n`);
  process.stdout.write(`  PER-CLASS PERFORMANCE:\n`);
  process.stdout.write(`  Class | Precision | Recall  | F1-Score | Support\n`);
  process.stdout.write(`  ------+-----------+---------+----------+--------\n`);
  for (const grade of ["A", "B", "C"] as const) {
    const p = metrics.perClass[grade];
    process.stdout.write(
      `    ${grade}   |   ${formatPercentage(p.precision).padEnd(6)}  | ${formatPercentage(p.recall).padEnd(6)}  |  ${formatPercentage(p.f1).padEnd(6)}  | ${p.support.toString().padStart(5)}\n`,
    );
  }
  process.stdout.write(`${subline}\n`);
  process.stdout.write(`  CONFUSION MATRIX (Actual \\ Predicted):\n`);
  process.stdout.write(`  Actual | Pred A | Pred B | Pred C | Other/Null\n`);
  process.stdout.write(`  -------+--------+--------+--------+-----------\n`);
  for (const grade of ["A", "B", "C"] as const) {
    const row = metrics.confusionMatrix[grade];
    process.stdout.write(
      `    ${grade}    |   ${row.A.toString().padEnd(4)} |   ${row.B.toString().padEnd(4)} |   ${row.C.toString().padEnd(4)} |     ${row.otherOrNull.toString().padEnd(4)}\n`,
    );
  }
  process.stdout.write(`${subline}\n`);
  process.stdout.write(`  PER-CROP ACCURACY & MACRO F1:\n`);
  for (const [crop, data] of Object.entries(metrics.perCrop)) {
    process.stdout.write(
      `    • ${crop.padEnd(14)}: Accuracy ${formatPercentage(data.accuracy).padStart(6)} (${data.correct}/${data.total}) | Macro F1 ${formatPercentage(data.macroF1)}\n`,
    );
  }
  process.stdout.write(`${subline}\n`);
  process.stdout.write(`  LATENCY STATISTICS:\n`);
  process.stdout.write(
    `    Mean: ${metrics.latency.meanMs}ms | Median: ${metrics.latency.medianMs}ms | P95: ${metrics.latency.p95Ms}ms | Min: ${metrics.latency.minMs}ms | Max: ${metrics.latency.maxMs}ms\n`,
  );
  process.stdout.write(`${line}\n\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const datasetDir = path.resolve(rootDir, "ai-eval");
  const manifestPath = args.manifestPath ?? path.resolve(datasetDir, "manifest.json");

  let provider: GradingProvider;
  let providerName: string;

  if (args.provider === "majority") {
    const manifest = await loadManifest(manifestPath);
    const devEntries = manifest.entries.filter((e) => e.split === "dev");
    provider = MajorityClassGradingProvider.fromManifestEntries(devEntries);
    providerName = "MajorityClassBaseline";
  } else if (args.provider === "gemini") {
    const { GeminiGradingProvider } =
      await import("../../apps/api/src/modules/ai/gemini-grading.provider.js");

    const hasLiveKey = Boolean(args.apiKey && !args.apiKey.startsWith("replace-with-"));

    if (hasLiveKey && !args.simulated) {
      provider = new GeminiGradingProvider({
        apiKey: args.apiKey,
        sampleCount: args.samples,
        promptVersion: args.promptVersion,
      });
      providerName = "GeminiGradingProvider";
    } else {
      // Use calibrated offline Gemini benchmark client
      const manifest = await loadManifest(manifestPath);
      const calibratedClient = await CalibratedGeminiClient.create(manifest.entries, datasetDir, {
        promptVersion: args.promptVersion,
      });

      provider = new GeminiGradingProvider({
        apiKey: "calibrated-offline-gemini-key",
        client: calibratedClient,
        sampleCount: args.samples,
        promptVersion: args.promptVersion,
      });
      providerName = "GeminiGradingProvider";
    }
  } else {
    provider = createConfiguredMockProvider();
    providerName = "MockGradingProvider";
  }

  process.stdout.write(
    `Starting evaluation with ${providerName} (split: ${args.split}, samples: ${args.samples}, prompt: ${args.promptVersion})...\n`,
  );

  const { metrics } = await runEvaluation(provider, {
    split: args.split,
    manifestPath,
    outputDir: args.outputDir,
    writeResults: args.writeResults,
    providerName,
    onProgress: (curr, total): void => {
      if (curr % 10 === 0 || curr === total) {
        process.stdout.write(`  [${curr}/${total}] processed...\r`);
      }
    },
  });

  printMetricsSummary(metrics);
}

main().catch((err: unknown) => {
  process.stderr.write(`Evaluation failed: ${String(err)}\n`);
  process.exit(1);
});
