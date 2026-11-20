import { describe, expect, it } from "vitest";

import {
  createGradingProvider,
  createPricePredictionProvider,
} from "./provider.factory.js";
import { MockGradingProvider } from "./mock-grading.provider.js";
import { MockPricePredictionProvider } from "./mock-price.provider.js";
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

    it("throws a clear error when 'gemini' is selected (scaffolded for Task G3)", () => {
      expect(() => createGradingProvider("gemini")).toThrowError(
        /Unsupported AI_GRADING_PROVIDER "gemini" – provider implementation arrives in Task G3/,
      );
    });

    it("throws a clear error when an unsupported grading provider is requested", () => {
      expect(() => createGradingProvider("unsupported-grader")).toThrowError(
        /Unsupported AI_GRADING_PROVIDER "unsupported-grader"/,
      );
    });

    it("defaults to mock provider in default environment", () => {
      const provider = createGradingProvider();
      expect(provider).toBeInstanceOf(MockGradingProvider);
    });
  });

  describe("createPricePredictionProvider", () => {
    it("returns a MockPricePredictionProvider when provider is 'mock'", () => {
      const provider = createPricePredictionProvider("mock");
      expect(provider).toBeInstanceOf(MockPricePredictionProvider);
    });

    it("throws a clear error when 'baseline' is selected (scaffolded for Task G5)", () => {
      expect(() => createPricePredictionProvider("baseline")).toThrowError(
        /Unsupported AI_PRICE_PROVIDER "baseline" – provider implementation arrives in Task G5/,
      );
    });

    it("throws a clear error when an unsupported price provider is requested", () => {
      expect(() => createPricePredictionProvider("unsupported-pricer")).toThrowError(
        /Unsupported AI_PRICE_PROVIDER "unsupported-pricer"/,
      );
    });

    it("defaults to mock provider in default environment", () => {
      const provider = createPricePredictionProvider();
      expect(provider).toBeInstanceOf(MockPricePredictionProvider);
    });
  });
});
