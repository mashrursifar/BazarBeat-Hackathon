import { logger } from "../../shared/logger.js";

export interface AiTelemetryUsage {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  totalTokens: number;
  promptTokens: number;
  candidateTokens: number;
}

export interface AiTelemetrySnapshot {
  usage: AiTelemetryUsage;
  lastSuccessTime: string | null;
  lastFailureTime: string | null;
  lastLatencyMs: number | null;
}

export interface RecordAiCallParams {
  provider: string;
  modelVersion: string;
  durationMs: number;
  success: boolean;
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
  sampleCount?: number;
  error?: string;
}

class AiTelemetryTracker {
  private totalRequests = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalTokens = 0;
  private promptTokens = 0;
  private candidateTokens = 0;
  private lastSuccessTime: string | null = null;
  private lastFailureTime: string | null = null;
  private lastLatencyMs: number | null = null;

  public recordCall(params: RecordAiCallParams): void {
    this.totalRequests += 1;
    this.lastLatencyMs = params.durationMs;

    const promptCount = params.promptTokens ?? 0;
    const candidateCount = params.candidateTokens ?? 0;
    const totalCount = params.totalTokens ?? (promptCount + candidateCount);

    this.promptTokens += promptCount;
    this.candidateTokens += candidateCount;
    this.totalTokens += totalCount;

    if (params.success) {
      this.totalSuccesses += 1;
      this.lastSuccessTime = new Date().toISOString();

      logger.info(
        {
          provider: params.provider,
          modelVersion: params.modelVersion,
          durationMs: params.durationMs,
          sampleCount: params.sampleCount,
          tokens: {
            prompt: promptCount,
            candidate: candidateCount,
            total: totalCount,
          },
        },
        "AI operation completed successfully",
      );
    } else {
      this.totalFailures += 1;
      this.lastFailureTime = new Date().toISOString();

      logger.warn(
        {
          provider: params.provider,
          modelVersion: params.modelVersion,
          durationMs: params.durationMs,
          error: params.error,
        },
        "AI operation failed",
      );
    }
  }

  public getSnapshot(): AiTelemetrySnapshot {
    return {
      usage: {
        totalRequests: this.totalRequests,
        totalSuccesses: this.totalSuccesses,
        totalFailures: this.totalFailures,
        totalTokens: this.totalTokens,
        promptTokens: this.promptTokens,
        candidateTokens: this.candidateTokens,
      },
      lastSuccessTime: this.lastSuccessTime,
      lastFailureTime: this.lastFailureTime,
      lastLatencyMs: this.lastLatencyMs,
    };
  }

  public reset(): void {
    this.totalRequests = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.totalTokens = 0;
    this.promptTokens = 0;
    this.candidateTokens = 0;
    this.lastSuccessTime = null;
    this.lastFailureTime = null;
    this.lastLatencyMs = null;
  }
}

const aiTelemetrySingleton = new AiTelemetryTracker();

export function recordAiCall(params: RecordAiCallParams): void {
  aiTelemetrySingleton.recordCall(params);
}

export function getAiTelemetry(): AiTelemetrySnapshot {
  return aiTelemetrySingleton.getSnapshot();
}

export function resetAiTelemetry(): void {
  aiTelemetrySingleton.reset();
}
