import { describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { createGradingProvider, createPricePredictionProvider } from "./provider.factory.js";
import { MockGradingProvider } from "./mock-grading.provider.js";
import { MockPricePredictionProvider } from "./mock-price.provider.js";
import { BaselinePricePredictionProvider } from "./baseline-price.provider.js";
import { GeminiGradingProvider } from "./gemini-grading.provider.js";
import { DEMO_SAMPLE_HASHES } from "./demo-fixtures.js";

describe("AI Provider Factory Selection", () => {
  describe("createGradingProvider", () => {
    it("returns a configured MockGradingProvider when provider is 'mock'", () => {
      const provider = createGradingProvider("mock");
      expect(provider).toBeInstanceOf(MockGradingProvider);

      // Verify sample hashes were registered
      for (const [hash, expectedGrade] of Object.entries(DEMO_SAMPLE_HASHES)) {
        const mockInstance = provider as MockGradingProvider;
        expect(mockInstance.getRegisteredGrade(hash)).toBe(expectedGrade);
      }
    });

    it("returns a GeminiGradingProvider when 'gemini' is selected and API key is present", () => {
      const originalKey = env.GEMINI_API_KEY;
      try {
        (env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY = "test-gemini-api-key";
        const provider = createGradingProvider("gemini");
        expect(provider).toBeInstanceOf(GeminiGradingProvider);
      } finally {
        (env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY = originalKey;
      }
    });

    it("throws a clear error when 'gemini' is selected without a valid GEMINI_API_KEY", () => {
      const originalKey = env.GEMINI_API_KEY;
      try {
        (env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY = "";
        expect(() => createGradingProvider("gemini")).toThrowError(
          /GEMINI_API_KEY is required to initialize GeminiGradingProvider/,
        );
      } finally {
        (env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY = originalKey;
      }
    });

    it("throws a clear error when an unsupported grading provider is requested", () => {
      expect(() => createGradingProvider("unsupported-grader")).toThrowError(
        /Unsupported AI_GRADING_PROVIDER "unsupported-grader"/,
      );
    });

    it("defaults to mock provider when AI_GRADING_PROVIDER is 'mock'", () => {
      const original = env.AI_GRADING_PROVIDER;
      try {
        (env as { AI_GRADING_PROVIDER: string }).AI_GRADING_PROVIDER = "mock";
        const provider = createGradingProvider();
        expect(provider).toBeInstanceOf(MockGradingProvider);
      } finally {
        (env as { AI_GRADING_PROVIDER: string }).AI_GRADING_PROVIDER = original;
      }
    });
  });

  describe("createPricePredictionProvider", () => {
    it("returns a MockPricePredictionProvider when provider is 'mock'", () => {
      const provider = createPricePredictionProvider("mock");
      expect(provider).toBeInstanceOf(MockPricePredictionProvider);
    });

    it("returns a BaselinePricePredictionProvider when provider is 'baseline'", () => {
      const provider = createPricePredictionProvider("baseline");
      expect(provider).toBeInstanceOf(BaselinePricePredictionProvider);
    });

    it("throws a clear error when an unsupported price provider is requested", () => {
      expect(() => createPricePredictionProvider("unsupported-pricer")).toThrowError(
        /Unsupported AI_PRICE_PROVIDER "unsupported-pricer"/,
      );
    });

    it("defaults to mock provider when AI_PRICE_PROVIDER is 'mock'", () => {
      const original = env.AI_PRICE_PROVIDER;
      try {
        (env as { AI_PRICE_PROVIDER: string }).AI_PRICE_PROVIDER = "mock";
        const provider = createPricePredictionProvider();
        expect(provider).toBeInstanceOf(MockPricePredictionProvider);
      } finally {
        (env as { AI_PRICE_PROVIDER: string }).AI_PRICE_PROVIDER = original;
      }
    });
  });
});
