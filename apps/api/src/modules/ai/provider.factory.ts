import { env } from "../../config/env.js";
import type { GradingProvider, PricePredictionProvider } from "./interfaces.js";
import { MockGradingProvider } from "./mock-grading.provider.js";
import { MockPricePredictionProvider } from "./mock-price.provider.js";

export function createGradingProvider(): GradingProvider {
  if (env.AI_PROVIDER === "mock") {
    return new MockGradingProvider();
  }
  // In production we would import RealGradingProvider, but it's not built yet.
  throw new Error(`Unsupported AI_PROVIDER "${env.AI_PROVIDER}" – only "mock" is available`);
}

export function createPricePredictionProvider(): PricePredictionProvider {
  if (env.AI_PROVIDER === "mock") {
    return new MockPricePredictionProvider();
  }
  throw new Error(`Unsupported AI_PROVIDER "${env.AI_PROVIDER}" – only "mock" is available`);
}
