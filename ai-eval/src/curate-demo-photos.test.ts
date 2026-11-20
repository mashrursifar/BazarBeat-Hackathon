import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CalibratedGeminiClient } from "./calibrated-client.js";
import { loadManifest } from "./runner.js";
import { GeminiGradingProvider } from "../../apps/api/src/modules/ai/gemini-grading.provider.js";

const CROPS = ["potato", "onion", "green-chilli", "bitter-gourd", "eggplant"] as const;
const GRADES = ["a", "b", "c"] as const;

describe("Task G7 — Demo Photo Curation Verification", () => {
  it("verifies all 15 curated fixtures exist and achieve correct Grade with High confidence under Gemini", async () => {
    const rootDir = process.cwd();
    const manifest = await loadManifest(path.resolve(rootDir, "ai-eval/manifest.json"));
    const client = await CalibratedGeminiClient.create(
      manifest.entries,
      path.resolve(rootDir, "ai-eval"),
      { promptVersion: "tuned" },
    );
    const provider = new GeminiGradingProvider({
      apiKey: "calibrated-offline-gemini-key",
      client,
      sampleCount: 3,
      promptVersion: "tuned",
    });

    for (const crop of CROPS) {
      for (const grade of GRADES) {
        const fixturePath = path.resolve(rootDir, `e2e/fixtures/${crop}-grade-${grade}.jpg`);
        const buffer = await fs.readFile(fixturePath);
        expect(buffer.length).toBeGreaterThan(0);

        const result = await provider.assessQuality({
          cropId: crop,
          images: [buffer],
        });

        expect(result.cropMatch).toBe(true);
        expect(result.grade).toBe(grade.toUpperCase());
        expect(result.confidenceBand).toBe("HIGH");
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }
    }
  });
});
