import crypto from "node:crypto";
import {
  AIProvider,
  type AssessmentResult,
  type CropGrade,
  GradingReasonCode,
} from "@bazarbeat/shared";
import { MockGradingProvider } from "../../apps/api/src/modules/ai/mock-grading.provider.js";
import { DEMO_SAMPLE_HASHES } from "../../apps/api/src/modules/ai/demo-fixtures.js";
import type { GradingProvider } from "../../apps/api/src/modules/ai/interfaces.js";
import type { ManifestEntry } from "./types.js";

/**
 * Determines the majority class from a collection of manifest entries.
 * Defaults to "B" if no gradeable entries exist or in the event of a tie.
 */
export function determineMajorityClass(entries: readonly ManifestEntry[]): CropGrade {
  const counts: Record<CropGrade, number> = { A: 0, B: 0, C: 0 };
  for (const entry of entries) {
    if (
      entry.groundTruthGrade === "A" ||
      entry.groundTruthGrade === "B" ||
      entry.groundTruthGrade === "C"
    ) {
      counts[entry.groundTruthGrade] += 1;
    }
  }

  let maxGrade: CropGrade = "B";
  let maxCount = -1;

  for (const grade of ["B", "A", "C"] as const) {
    if (counts[grade] > maxCount) {
      maxCount = counts[grade];
      maxGrade = grade;
    }
  }

  return maxGrade;
}

/**
 * Naive majority-class baseline grading provider.
 * Always predicts the majority class observed in the dev dataset.
 */
export class MajorityClassGradingProvider implements GradingProvider {
  public readonly majorityGrade: CropGrade;
  public readonly modelVersion = "majority-class-baseline-v1";

  public constructor(majorityGrade: CropGrade = "B") {
    this.majorityGrade = majorityGrade;
  }

  public static fromManifestEntries(
    entries: readonly ManifestEntry[],
  ): MajorityClassGradingProvider {
    const majority = determineMajorityClass(entries);
    return new MajorityClassGradingProvider(majority);
  }

  public async assessQuality(params: {
    cropId: string;
    images: Buffer[];
  }): Promise<AssessmentResult> {
    void params;
    const probabilities =
      this.majorityGrade === "A"
        ? { A: 0.6, B: 0.25, C: 0.15 }
        : this.majorityGrade === "B"
          ? { A: 0.25, B: 0.5, C: 0.25 }
          : { A: 0.15, B: 0.25, C: 0.6 };

    return {
      grade: this.majorityGrade,
      confidence: 0.5,
      confidenceBand: "MEDIUM",
      classProbabilities: probabilities,
      qualityNotes: [{ code: GradingReasonCode.VISUAL_AI_EVALUATED }],
      cropMatch: true,
      modelVersion: this.modelVersion,
      provider: AIProvider.MOCK,
      degraded: false,
      assessedAt: new Date().toISOString(),
      assessmentToken: crypto.randomBytes(16).toString("hex"),
    };
  }
}

/**
 * Creates and configures the standard MockGradingProvider with demo fixture hashes registered.
 */
export function createConfiguredMockProvider(): MockGradingProvider {
  const mockProvider = new MockGradingProvider();
  for (const [hash, grade] of Object.entries(DEMO_SAMPLE_HASHES)) {
    mockProvider.register(hash, grade);
  }
  return mockProvider;
}

export { MockGradingProvider };
