import { type CropGrade, z } from "@bazarbeat/shared";

export const cropGradeOrNullSchema = z.enum(["A", "B", "C"]).nullable();
export type CropGradeOrNull = z.infer<typeof cropGradeOrNullSchema>;

export const datasetSplitSchema = z.enum(["dev", "test"]);
export type DatasetSplit = z.infer<typeof datasetSplitSchema>;

export const manifestEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    imagePath: z.string().trim().min(1),
    crop: z.string().trim().min(1),
    groundTruthGrade: cropGradeOrNullSchema,
    source: z.string().trim().min(1),
    license: z.string().trim().min(1),
    split: datasetSplitSchema,
    tags: z.array(z.string().trim().min(1)),
    notes: z.string().trim().optional(),
  })
  .strict();

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;

export const datasetManifestSchema = z
  .object({
    version: z.string().trim().min(1),
    description: z.string().trim().min(1),
    entries: z.array(manifestEntrySchema),
  })
  .strict();

export type DatasetManifest = z.infer<typeof datasetManifestSchema>;

export interface ConfusionMatrixRow {
  A: number;
  B: number;
  C: number;
  otherOrNull: number;
}

export interface ConfusionMatrix {
  A: ConfusionMatrixRow;
  B: ConfusionMatrixRow;
  C: ConfusionMatrixRow;
}

export interface PerClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface CropEvaluationMetrics {
  crop: string;
  total: number;
  correct: number;
  accuracy: number;
  macroF1: number;
}

export interface LatencyMetrics {
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
}

export interface EvaluationMetrics {
  provider: string;
  split: DatasetSplit | "all";
  evaluatedAt: string;
  totalSamples: number;
  standardSamplesCount: number;
  negativeSamplesCount: number;
  adversarialSamplesCount: number;
  overallAccuracy: number;
  macroF1: number;
  perClass: {
    A: PerClassMetrics;
    B: PerClassMetrics;
    C: PerClassMetrics;
  };
  confusionMatrix: ConfusionMatrix;
  perCrop: Record<string, CropEvaluationMetrics>;
  cropMismatchDetectionRate: number;
  adversarialPassRate: number;
  latency: LatencyMetrics;
}

export interface EvaluationItemResult {
  entry: ManifestEntry;
  predictedGrade: CropGrade | null;
  cropMatch: boolean;
  confidence: number;
  latencyMs: number;
  isCorrect: boolean;
  error: string | null;
}
