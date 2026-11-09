import crypto from 'crypto';
import { MarketPriceSource, AIProvider } from '@bazarbeat/shared';
import type { AssessmentResult } from '@bazarbeat/shared';
import { GradingProvider } from './interfaces.js';

/**
 * Simple deterministic mock grader.
 * - Known image hashes can be registered via `registry` for the demo.
 * - Otherwise grade is derived from SHA‑256 hash modulo a distribution:
 *   0‑29 → A (30%)
 *   30‑79 → B (50%)
 *   80‑99 → C (20%)
 */
export class MockGradingProvider implements GradingProvider {
  /** map of hex hash → grade for demo overrides */
  private readonly registry = new Map<string, AssessmentResult['grade']>();

  /** Register a deterministic mapping (used by demo fixtures). */
  public register(hash: string, grade: AssessmentResult['grade']): void {
    this.registry.set(hash, grade);
  }

  private hashBuffer(buf: Buffer): string {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private gradeFromHash(hash: string): AssessmentResult['grade'] {
    const percent = parseInt(hash.slice(0, 2), 16) % 100; // 0‑99
    if (percent < 30) return 'A';
    if (percent < 80) return 'B';
    return 'C';
  }

  public async assessQuality(params: { cropId: string; images: Buffer[] }): Promise<AssessmentResult> {
    // For simplicity we only look at the first image to pick a grade.
    const image = params.images[0] ?? Buffer.alloc(0);
    const hash = this.hashBuffer(image);
    const grade = this.registry.get(hash) ?? this.gradeFromHash(hash);

    const result: AssessmentResult = {
      grade,
      confidence: 0.95,
      classProbabilities: { A: 0.3, B: 0.5, C: 0.2 },
      qualityNotes: [],
      cropMatch: true,
      modelVersion: 'mock-1.0',
      provider: AIProvider.MOCK,
      degraded: false,
      assessedAt: new Date().toISOString(),
      assessmentToken: crypto.randomBytes(16).toString('hex'),
    };
    return result;
  }
}

