import { env } from "../../config/env.js";
import type { GradingProvider, PricePredictionProvider } from "./interfaces.js";
import { MockGradingProvider } from "./mock-grading.provider.js";
import { MockPricePredictionProvider } from "./mock-price.provider.js";
import { DEMO_SAMPLE_HASHES } from "./demo-fixtures.js";

/**
 * Creates the appropriate GradingProvider based on AI_GRADING_PROVIDER.
 * Defaults to MockGradingProvider with seeded demo sample hashes.
 */
export function createGradingProvider(
  provider: string = env.AI_GRADING_PROVIDER,
): GradingProvider {
  if (provider === "mock") {
    const mockProvider = new MockGradingProvider();
    for (const [hash, grade] of Object.entries(DEMO_SAMPLE_HASHES)) {
      mockProvider.register(hash, grade);
    }
    return mockProvider;
  }
  if (provider === "gemini") {
    // Scaffolded for Task G3 (Gemini grading provider implementation)
    throw new Error('Unsupported AI_GRADING_PROVIDER "gemini" – provider implementation arrives in Task G3');
  }
  throw new Error(`Unsupported AI_GRADING_PROVIDER "${provider}" – only "mock" and "gemini" are supported`);
}

/**
 * Creates the appropriate PricePredictionProvider based on AI_PRICE_PROVIDER.
 * Defaults to MockPricePredictionProvider.
 */
export function createPricePredictionProvider(
  provider: string = env.AI_PRICE_PROVIDER,
): PricePredictionProvider {
  if (provider === "mock") {
    return new MockPricePredictionProvider();
  }
  if (provider === "baseline") {
    // Scaffolded for Task G5 (Statistical baseline price provider)
    throw new Error('Unsupported AI_PRICE_PROVIDER "baseline" – provider implementation arrives in Task G5');
  }
  throw new Error(`Unsupported AI_PRICE_PROVIDER "${provider}" – only "mock" and "baseline" are supported`);
}
