import crypto from "node:crypto";
import sharp from "sharp";
import { GoogleGenAI, Type } from "@google/genai";
import {
  AIProvider,
  type AssessmentResult,
  type ConfidenceBand,
  GradingReasonCode,
  type GradingReasonItem,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import type { GradingProvider } from "./interfaces.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { MockGradingProvider } from "./mock-grading.provider.js";
import { DEMO_SAMPLE_HASHES } from "./demo-fixtures.js";
import {
  type CropRubricInfo,
  type GeminiSampleOutput,
  buildGradingSystemInstruction,
  buildGradingUserPrompt,
  cleanJsonText,
  geminiSampleOutputSchema,
  resolveCropRubric,
} from "./gemini-prompt.js";

export interface GeminiModelClient {
  generateContent(params: {
    model: string;
    contents: unknown[];
    config?: {
      systemInstruction?: string;
      temperature?: number;
      responseMimeType?: string;
      responseSchema?: unknown;
      abortSignal?: AbortSignal;
    };
  }): Promise<{ text?: string | (() => string) } | unknown>;
}

export interface GenAIClientLike {
  models: GeminiModelClient;
}

export interface GeminiGradingProviderOptions {
  apiKey?: string;
  model?: string;
  sampleCount?: number;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreaker;
  fallbackProvider?: GradingProvider;
  client?: GenAIClientLike;
  backoffMs?: number;
  maxRetries?: number;
  promptVersion?: "baseline" | "tuned";
}

export interface DownscaledImagePart {
  data: string;
  mimeType: string;
}

/**
 * Downscales an image buffer to modest dimensions before sending to Gemini (gap 6).
 * Resizes within 768x768 to keep payload size small and latency low.
 * Falls back safely to raw base64 if sharp encounters non-image/mock buffers in unit tests.
 */
export async function downscaleImageForGemini(
  buffer: Buffer,
  maxDimension = 768,
  quality = 80,
): Promise<DownscaledImagePart> {
  try {
    const resizedBuffer = await sharp(buffer)
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer();

    return {
      data: resizedBuffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch {
    // Graceful fallback for synthetic/mock buffers in tests
    return {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  }
}

/**
 * Inspects an error to determine whether it is retryable (429, 5xx, timeout, socket reset).
 */
export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as Record<string, unknown>;

  const status =
    typeof anyErr.status === "number"
      ? anyErr.status
      : typeof anyErr.statusCode === "number"
        ? anyErr.statusCode
        : typeof anyErr.code === "number"
          ? anyErr.code
          : null;

  if (status === 429) return true;
  if (status && status >= 500 && status < 600) return true;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("resource exhausted") ||
      msg.includes("quota")
    ) {
      return true;
    }
    if (
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("service unavailable") ||
      msg.includes("overloaded")
    ) {
      return true;
    }
    if (
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("socket") ||
      msg.includes("abort")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Gemini Grading Provider (Task G3 / Phase 9 Gemini alternative).
 * Features:
 * - Multimodal produce inspection against catalog rubrics
 * - Strict adversarial text rejection
 * - Image downscaling before payload dispatch
 * - Schema-constrained structured JSON output
 * - Agreement-based confidence across parallel samples (D-45)
 * - Resilience (D-42): retries on 429/5xx, circuit breaker, and degraded fallback to mock
 * - Strict credential hygiene: never logs API keys or raw image buffers
 */
export class GeminiGradingProvider implements GradingProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly sampleCount: number;
  private readonly timeoutMs: number;
  private readonly backoffMs: number;
  private readonly maxRetries: number;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly fallbackProvider: GradingProvider;
  private readonly promptVersion: "baseline" | "tuned";
  private client: GenAIClientLike;

  constructor(options: GeminiGradingProviderOptions = {}) {
    this.apiKey = options.apiKey ?? env.GEMINI_API_KEY ?? "";
    this.model = options.model ?? env.GEMINI_MODEL ?? "gemini-2.5-flash";
    this.sampleCount = options.sampleCount ?? env.GEMINI_GRADE_SAMPLES ?? 3;
    this.timeoutMs = options.timeoutMs ?? env.GEMINI_TIMEOUT_MS ?? 10_000;
    this.backoffMs = options.backoffMs ?? 500;
    this.maxRetries = options.maxRetries ?? 1;
    this.promptVersion = options.promptVersion ?? "tuned";

    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker();

    if (options.fallbackProvider) {
      this.fallbackProvider = options.fallbackProvider;
    } else {
      const mock = new MockGradingProvider();
      for (const [hash, grade] of Object.entries(DEMO_SAMPLE_HASHES)) {
        mock.register(hash, grade);
      }
      this.fallbackProvider = mock;
    }

    if (options.client) {
      this.client = options.client;
    } else {
      if (
        !this.apiKey ||
        this.apiKey.trim().length === 0 ||
        this.apiKey.startsWith("replace-with-")
      ) {
        throw new Error("GEMINI_API_KEY is required to initialize GeminiGradingProvider");
      }
      this.client = new GoogleGenAI({ apiKey: this.apiKey }) as unknown as GenAIClientLike;
    }
  }

  public getModel(): string {
    return this.model;
  }

  public getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  public getFallbackProvider(): GradingProvider {
    return this.fallbackProvider;
  }

  /**
   * Defines schema for Gemini structured JSON output.
   */
  private getGenAIResponseSchema(): unknown {
    return {
      type: Type.OBJECT,
      properties: {
        cropMatch: {
          type: Type.BOOLEAN,
          description:
            "True if produce matches requested crop; false if other produce or non-produce",
        },
        imageQualityUsable: {
          type: Type.BOOLEAN,
          description:
            "True if image clarity is sufficient to inspect; false if dark, blurry, or obscured",
        },
        grade: {
          type: Type.STRING,
          enum: ["A", "B", "C"],
          description: "Visual agricultural quality grade",
        },
        scores: {
          type: Type.OBJECT,
          properties: {
            A: { type: Type.NUMBER, description: "Grade A probability score (0.0 to 1.0)" },
            B: { type: Type.NUMBER, description: "Grade B probability score (0.0 to 1.0)" },
            C: { type: Type.NUMBER, description: "Grade C probability score (0.0 to 1.0)" },
          },
          required: ["A", "B", "C"],
        },
        reasons: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: {
                type: Type.STRING,
                enum: Object.values(GradingReasonCode),
              },
              params: {
                type: Type.OBJECT,
              },
            },
            required: ["code"],
          },
        },
        summary: {
          type: Type.STRING,
          description: "Short visual rationale of the grade assessment",
        },
      },
      required: ["cropMatch", "imageQualityUsable", "grade", "scores", "reasons"],
    };
  }

  /**
   * Executes a single Gemini sample with timeout and 1 retry on 429/5xx.
   */
  private async executeSampleWithRetry(
    sampleIndex: number,
    rubric: CropRubricInfo,
    imageParts: DownscaledImagePart[],
  ): Promise<GeminiSampleOutput> {
    let attempt = 0;

    while (true) {
      attempt += 1;
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | null = null;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            abortController.abort();
            reject(new Error(`Gemini API call timed out after ${this.timeoutMs}ms`));
          }, this.timeoutMs);
        });

        const callPromise = this.client.models.generateContent({
          model: this.model,
          contents: [
            ...imageParts.map((p) => ({
              inlineData: {
                mimeType: p.mimeType,
                data: p.data,
              },
            })),
            { text: buildGradingUserPrompt(rubric) },
          ],
          config: {
            systemInstruction: buildGradingSystemInstruction(rubric, this.promptVersion),
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: this.getGenAIResponseSchema(),
            abortSignal: abortController.signal,
          },
        });

        const response = (await Promise.race([callPromise, timeoutPromise])) as {
          text?: string | (() => string);
        };

        if (timeoutId) clearTimeout(timeoutId);

        // Extract response text (supporting property or getter function)
        const rawText =
          typeof response?.text === "function"
            ? response.text()
            : typeof response?.text === "string"
              ? response.text
              : "";

        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Empty response text from Gemini model");
        }

        const cleanedJson = cleanJsonText(rawText);
        let parsed: unknown;
        try {
          parsed = JSON.parse(cleanedJson);
        } catch (jsonErr) {
          throw new Error(
            `Invalid JSON returned by Gemini: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
            { cause: jsonErr },
          );
        }

        const parsedResult = geminiSampleOutputSchema.safeParse(parsed);
        if (!parsedResult.success) {
          throw new Error(
            `Schema violation in Gemini output: ${parsedResult.error.issues.map((i) => i.message).join(", ")}`,
          );
        }

        return parsedResult.data;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);

        const retryable = isRetryableError(err);
        if (attempt <= this.maxRetries && retryable) {
          const delay = this.backoffMs * Math.pow(2, attempt - 1);
          logger.warn(
            {
              sampleIndex,
              attempt,
              delayMs: delay,
              error: err instanceof Error ? err.message : String(err),
            },
            "Gemini sample failed with retryable error; backing off and retrying",
          );
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }

        throw err;
      }
    }
  }

  /**
   * Falls back to mock provider with degraded: true.
   */
  private async fallbackToMock(params: {
    cropId: string;
    images: Buffer[];
  }): Promise<AssessmentResult> {
    const mockResult = await this.fallbackProvider.assessQuality(params);
    return {
      ...mockResult,
      provider: AIProvider.MOCK,
      degraded: true,
      modelVersion: mockResult.modelVersion ?? "mock-fallback",
    };
  }

  /**
   * Main assessment implementation:
   * 1. Check circuit breaker.
   * 2. Downscale images.
   * 3. Run parallel samples.
   * 4. Aggregate agreement-based confidence (D-45).
   * 5. Fallback on outage / errors (D-42).
   */
  public async assessQuality(params: {
    cropId: string;
    images: Buffer[];
  }): Promise<AssessmentResult> {
    // 1. Circuit breaker preflight
    if (this.circuitBreaker.isOpen()) {
      logger.warn(
        {
          circuitState: this.circuitBreaker.getState(),
          consecutiveFailures: this.circuitBreaker.getConsecutiveFailures(),
        },
        "Gemini circuit breaker is OPEN; falling back to mock provider",
      );
      return this.fallbackToMock(params);
    }

    // 2. Resolve crop rubric
    const rubric = await resolveCropRubric(params.cropId);
    if (!rubric) {
      // Unrecognized crop identifier -> mismatch
      return {
        grade: "C",
        confidence: 0.2,
        confidenceBand: "LOW",
        classProbabilities: { A: 0.1, B: 0.2, C: 0.7 },
        qualityNotes: [{ code: GradingReasonCode.VISUAL_AI_EVALUATED }],
        cropMatch: false,
        modelVersion: this.model,
        provider: AIProvider.GEMINI,
        degraded: false,
        assessedAt: new Date().toISOString(),
        assessmentToken: crypto.randomBytes(16).toString("hex"),
      };
    }

    // 3. Downscale images before sending to model
    const imageParts: DownscaledImagePart[] = [];
    for (const buf of params.images) {
      const part = await downscaleImageForGemini(buf);
      imageParts.push(part);
    }

    // 4. Run parallel samples for agreement-based confidence (D-45)
    const startTime = Date.now();
    const samplePromises = Array.from({ length: this.sampleCount }, (_, idx) =>
      this.executeSampleWithRetry(idx, rubric, imageParts),
    );

    const settled = await Promise.allSettled(samplePromises);
    const durationMs = Date.now() - startTime;

    const successfulSamples: GeminiSampleOutput[] = [];
    const sampleErrors: string[] = [];

    for (const res of settled) {
      if (res.status === "fulfilled") {
        successfulSamples.push(res.value);
      } else {
        sampleErrors.push(res.reason instanceof Error ? res.reason.message : String(res.reason));
      }
    }

    // If ALL samples failed: record failure on circuit breaker and fall back to mock
    if (successfulSamples.length === 0) {
      this.circuitBreaker.recordFailure();
      logger.warn(
        {
          durationMs,
          sampleCount: this.sampleCount,
          errors: sampleErrors,
          circuitBreakerState: this.circuitBreaker.getState(),
        },
        "All Gemini grading samples failed; triggering circuit breaker and fallback",
      );
      return this.fallbackToMock(params);
    }

    // Record success on circuit breaker if at least one sample succeeded
    this.circuitBreaker.recordSuccess();

    // 5. Aggregate samples (Agreement-based confidence D-45)
    const totalVotes = successfulSamples.length;

    // Crop Match: majority must agree it is the crop
    const cropMatchCount = successfulSamples.filter((s) => s.cropMatch).length;
    const cropMatch = cropMatchCount >= Math.ceil(totalVotes / 2);

    // Image Usability: majority must agree image is usable
    const usableCount = successfulSamples.filter((s) => s.imageQualityUsable).length;
    const isUsable = usableCount >= Math.ceil(totalVotes / 2);

    // Grade voting counts
    const voteCounts: Record<"A" | "B" | "C", number> = { A: 0, B: 0, C: 0 };
    for (const s of successfulSamples) {
      voteCounts[s.grade] += 1;
    }

    // Determine winning grade
    let winningGrade: "A" | "B" | "C" = "B";
    let maxVotes = -1;
    let tie = false;

    for (const grade of ["A", "B", "C"] as const) {
      const votes = voteCounts[grade];
      if (votes > maxVotes) {
        maxVotes = votes;
        winningGrade = grade;
        tie = false;
      } else if (votes === maxVotes && maxVotes > 0) {
        tie = true;
      }
    }

    const agreementRatio = totalVotes > 0 ? maxVotes / totalVotes : 0;

    // Determine agreement-based confidence and confidenceBand (D-45)
    let confidence: number;
    let confidenceBand: ConfidenceBand;

    if (!cropMatch) {
      confidence = 0.2;
      confidenceBand = "LOW";
    } else if (!isUsable) {
      // Unusable photos (blurry, dark) -> confidence < 0.55 triggers GRADE_UNAVAILABLE
      confidence = 0.4;
      confidenceBand = "LOW";
    } else if (tie || agreementRatio < 0.6) {
      // Split vote without clear majority (e.g. 1/3, 1/3, 1/3) -> GRADE_UNAVAILABLE
      confidence = 0.4;
      confidenceBand = "LOW";
    } else if (agreementRatio === 1.0) {
      // Unanimous agreement across all samples
      confidence = 0.95;
      confidenceBand = "HIGH";
    } else {
      // Clear majority agreement (e.g. 2/3 = 0.67, 3/4 = 0.75)
      confidence = 0.7;
      confidenceBand = "MEDIUM";
    }

    // Calculate averaged class probabilities
    const rawScores = {
      A: successfulSamples.reduce((sum, s) => sum + s.scores.A, 0) / totalVotes,
      B: successfulSamples.reduce((sum, s) => sum + s.scores.B, 0) / totalVotes,
      C: successfulSamples.reduce((sum, s) => sum + s.scores.C, 0) / totalVotes,
    };
    const sumScore = rawScores.A + rawScores.B + rawScores.C || 1;
    const classProbabilities = {
      A: Math.round((rawScores.A / sumScore) * 100) / 100,
      B: Math.round((rawScores.B / sumScore) * 100) / 100,
      C: Math.round((rawScores.C / sumScore) * 100) / 100,
    };

    // Filter and deduplicate reason codes from winning samples
    const reasonsMap = new Map<GradingReasonCode, GradingReasonItem>();
    const winningSamples = successfulSamples.filter((s) => s.grade === winningGrade);
    const targetSamplesForReasons = winningSamples.length > 0 ? winningSamples : successfulSamples;

    for (const sample of targetSamplesForReasons) {
      for (const reason of sample.reasons) {
        if (Object.values(GradingReasonCode).includes(reason.code as GradingReasonCode)) {
          const validCode = reason.code as GradingReasonCode;
          if (!reasonsMap.has(validCode)) {
            reasonsMap.set(validCode, {
              code: validCode,
              ...(reason.params ? { params: reason.params } : {}),
            });
          }
        } else {
          logger.warn(
            { unknownCode: reason.code },
            "Filtered out unrecognized GradingReasonCode from Gemini response",
          );
        }
      }
    }

    let qualityNotes: GradingReasonItem[] = Array.from(reasonsMap.values());
    if (qualityNotes.length === 0) {
      qualityNotes = [{ code: GradingReasonCode.VISUAL_AI_EVALUATED }];
    }

    return {
      grade: winningGrade,
      confidence,
      confidenceBand,
      classProbabilities,
      qualityNotes,
      cropMatch: cropMatch && isUsable,
      modelVersion: this.model,
      provider: AIProvider.GEMINI,
      degraded: false,
      assessedAt: new Date().toISOString(),
      assessmentToken: crypto.randomBytes(16).toString("hex"),
    };
  }
}
