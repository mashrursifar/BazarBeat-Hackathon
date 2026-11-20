import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { type CropGrade } from "@bazarbeat/shared";
import { loadManifest } from "./runner.js";
import { CalibratedGeminiClient } from "./calibrated-client.js";
import { GeminiGradingProvider } from "../../apps/api/src/modules/ai/gemini-grading.provider.js";

const CROPS = ["potato", "onion", "green-chilli", "bitter-gourd", "eggplant"] as const;
const GRADES = ["A", "B", "C"] as const;

export interface CuratedPhotoResult {
  crop: string;
  grade: "A" | "B" | "C";
  sourcePath: string;
  fixtureName: string;
  gradeAssessed: string;
  confidence: number;
  confidenceBand: string;
  cropMatch: boolean;
  sha256: string;
}

export async function curateDemoPhotos(): Promise<CuratedPhotoResult[]> {
  const rootDir = process.cwd();
  const datasetDir = path.resolve(rootDir, "ai-eval");
  const manifestPath = path.resolve(datasetDir, "manifest.json");
  const manifest = await loadManifest(manifestPath);

  // Initialize CalibratedGeminiClient with tuned prompt
  const calibratedClient = await CalibratedGeminiClient.create(manifest.entries, datasetDir, {
    promptVersion: "tuned",
  });

  const provider = new GeminiGradingProvider({
    apiKey: "calibrated-offline-gemini-key",
    client: calibratedClient,
    sampleCount: 3,
    promptVersion: "tuned",
  });

  const fixturesDir = path.resolve(rootDir, "e2e/fixtures");
  await fs.mkdir(fixturesDir, { recursive: true });

  const curatedResults: CuratedPhotoResult[] = [];
  const fixtureRegistry: Record<string, CropGrade> = {};

  for (const crop of CROPS) {
    for (const grade of GRADES) {
      // Find candidate photos in manifest that match this crop, grade, and are not negative
      const candidates = manifest.entries.filter(
        (e) =>
          e.crop === crop &&
          e.groundTruthGrade === grade &&
          !e.tags.includes("negative") &&
          !e.tags.includes("adversarial"),
      );

      let selectedCandidate: (typeof candidates)[number] | null = null;
      let selectedAssessment: {
        grade: string;
        confidence: number;
        confidenceBand: string;
        cropMatch: boolean;
      } | null = null;

      for (const candidate of candidates) {
        const fullImagePath = path.isAbsolute(candidate.imagePath)
          ? candidate.imagePath
          : path.resolve(datasetDir, candidate.imagePath);

        try {
          const imageBuffer = await fs.readFile(fullImagePath);
          const assessment = await provider.assessQuality({
            cropId: crop,
            images: [imageBuffer],
          });

          // Selection criterion: must correctly match crop, match ground-truth grade, and have HIGH confidence
          if (
            assessment.cropMatch &&
            assessment.grade === grade &&
            assessment.confidenceBand === "HIGH" &&
            assessment.confidence >= 0.8
          ) {
            selectedCandidate = candidate;
            selectedAssessment = {
              grade: assessment.grade,
              confidence: assessment.confidence,
              confidenceBand: assessment.confidenceBand,
              cropMatch: assessment.cropMatch,
            };
            break;
          }
        } catch {
          // Continue searching candidates
        }
      }

      if (!selectedCandidate || !selectedAssessment) {
        throw new Error(
          `Unable to find a reliably High-confidence photo for crop "${crop}" and grade "${grade}"`,
        );
      }

      const sourceImagePath = path.isAbsolute(selectedCandidate.imagePath)
        ? selectedCandidate.imagePath
        : path.resolve(datasetDir, selectedCandidate.imagePath);

      const rawBuffer = await fs.readFile(sourceImagePath);
      const rawHash = crypto.createHash("sha256").update(rawBuffer).digest("hex");

      // Save to e2e/fixtures as <crop>-grade-<grade>.jpg
      const fixtureName = `${crop}-grade-${grade.toLowerCase()}.jpg`;
      const fixtureDest = path.join(fixturesDir, fixtureName);
      await fs.writeFile(fixtureDest, rawBuffer);

      // Compute processed hash (matching downscale/sharp pipeline)
      try {
        const processedBuffer = await sharp(rawBuffer)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const processedHash = crypto.createHash("sha256").update(processedBuffer).digest("hex");
        fixtureRegistry[processedHash] = grade;
      } catch {
        // Fallback
      }

      fixtureRegistry[rawHash] = grade;

      // Also ensure apps/api/src/seed/assets/samples/<crop>/<grade>.jpg has this verified image
      const seedCropDir = path.resolve(rootDir, `apps/api/src/seed/assets/samples/${crop}`);
      await fs.mkdir(seedCropDir, { recursive: true });
      const seedDest = path.join(seedCropDir, `${grade}.jpg`);
      await fs.writeFile(seedDest, rawBuffer);

      // If bitter-gourd, mirror to bitter-groud alias folder
      if (crop === "bitter-gourd") {
        const aliasDir = path.resolve(rootDir, "apps/api/src/seed/assets/samples/bitter-groud");
        await fs.mkdir(aliasDir, { recursive: true });
        await fs.writeFile(path.join(aliasDir, `${grade}.jpg`), rawBuffer);
      }

      curatedResults.push({
        crop,
        grade,
        sourcePath: selectedCandidate.imagePath,
        fixtureName,
        gradeAssessed: selectedAssessment.grade,
        confidence: selectedAssessment.confidence,
        confidenceBand: selectedAssessment.confidenceBand,
        cropMatch: selectedAssessment.cropMatch,
        sha256: rawHash,
      });
    }
  }

  // Update apps/api/src/modules/ai/demo-fixtures.ts with full curated registry
  const demoFixturesContent = `// Auto-generated demo fixtures registry (Task G7 Curation)
import type { CropGrade } from "@bazarbeat/shared";

/** SHA-256 hash to grade mapping for deterministic mock fallback and E2E testing */
export const DEMO_SAMPLE_HASHES: Record<string, CropGrade> = ${JSON.stringify(fixtureRegistry, null, 2)};
`;

  const demoFixturesPath = path.resolve(rootDir, "apps/api/src/modules/ai/demo-fixtures.ts");
  await fs.writeFile(demoFixturesPath, demoFixturesContent, "utf-8");

  return curatedResults;
}

async function main(): Promise<void> {
  process.stdout.write("Running Task G7 Demo Photo Curation with Gemini grading...\n");
  const results = await curateDemoPhotos();
  process.stdout.write(
    `Successfully curated and saved ${results.length} photos across all crops:\n`,
  );
  for (const r of results) {
    process.stdout.write(
      `  • ${r.crop.padEnd(14)} Grade ${r.grade}: ${r.fixtureName} (Confidence: ${(r.confidence * 100).toFixed(0)}% ${r.confidenceBand})\n`,
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))
) {
  void main();
}
