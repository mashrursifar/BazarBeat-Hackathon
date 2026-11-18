import {
  GradingReasonCode,
  PriceReasonCode,
  aiAssessmentSchema,
  priceGuidanceSchema,
} from "@bazarbeat/shared";
import { describe, expect, it } from "vitest";

import { i18n } from "../../lib/i18n.js";
import {
  renderGradingReason,
  renderPriceReason,
} from "./ai-reason-text.js";

describe("AI Reason Codes & Translations (Task 8.8)", () => {
  const enResources = i18n.getResourceBundle("en", "translation") as Record<string, unknown>;
  const bnResources = i18n.getResourceBundle("bn", "translation") as Record<string, unknown>;

  const enGrading = (enResources?.aiReasons as { grading: Record<string, string> })?.grading ?? {};
  const enPrice = (enResources?.aiReasons as { price: Record<string, string> })?.price ?? {};
  const bnGrading = (bnResources?.aiReasons as { grading: Record<string, string> })?.grading ?? {};
  const bnPrice = (bnResources?.aiReasons as { price: Record<string, string> })?.price ?? {};

  describe("GradingReasonCode i18n key coverage", () => {
    it.each(Object.values(GradingReasonCode))(
      "every GradingReasonCode '%s' has a non-empty English i18n key",
      (code) => {
        expect(enGrading[code]).toBeDefined();
        expect(typeof enGrading[code]).toBe("string");
        expect(enGrading[code]?.trim().length).toBeGreaterThan(0);
      },
    );

    it.each(Object.values(GradingReasonCode))(
      "every GradingReasonCode '%s' has a non-empty Bangla i18n key",
      (code) => {
        expect(bnGrading[code]).toBeDefined();
        expect(typeof bnGrading[code]).toBe("string");
        expect(bnGrading[code]?.trim().length).toBeGreaterThan(0);
      },
    );

    it("fails if a code has no i18n key in English", () => {
      const allEnumCodes = Object.values(GradingReasonCode);
      for (const code of allEnumCodes) {
        const key = `aiReasons.grading.${code}`;
        const translated = i18n.t(key, { lng: "en" });
        expect(translated).not.toBe(key);
        expect(translated).not.toBe("");
      }
    });
  });

  describe("PriceReasonCode i18n key coverage", () => {
    it.each(Object.values(PriceReasonCode))(
      "every PriceReasonCode '%s' has a non-empty English i18n key",
      (code) => {
        expect(enPrice[code]).toBeDefined();
        expect(typeof enPrice[code]).toBe("string");
        expect(enPrice[code]?.trim().length).toBeGreaterThan(0);
      },
    );

    it.each(Object.values(PriceReasonCode))(
      "every PriceReasonCode '%s' has a non-empty Bangla i18n key",
      (code) => {
        expect(bnPrice[code]).toBeDefined();
        expect(typeof bnPrice[code]).toBe("string");
        expect(bnPrice[code]?.trim().length).toBeGreaterThan(0);
      },
    );

    it("fails if a price reason code has no i18n key in English", () => {
      const allEnumCodes = Object.values(PriceReasonCode);
      for (const code of allEnumCodes) {
        const key = `aiReasons.price.${code}`;
        const translated = i18n.t(key, { lng: "en", grade: "A" });
        expect(translated).not.toBe(key);
        expect(translated).not.toBe("");
      }
    });
  });

  describe("renderGradingReason & renderPriceReason helpers", () => {
    it("renders English translation for structured grading reason object", () => {
      const result = renderGradingReason(
        { code: GradingReasonCode.COLOR_UNIFORM },
        i18n.t.bind(i18n),
      );
      expect(result).toBe("Consistent color");
    });

    it("renders Bangla translation for structured grading reason when language is bn", async () => {
      await i18n.changeLanguage("bn");
      const result = renderGradingReason(
        { code: GradingReasonCode.COLOR_UNIFORM },
        i18n.t.bind(i18n),
      );
      expect(result).toBe("একই রকম রঙ");
      await i18n.changeLanguage("en");
    });

    it("renders legacy string quality note as-is", () => {
      const legacyNote = "Hand-picked firm harvest";
      const result = renderGradingReason(legacyNote, i18n.t.bind(i18n));
      expect(result).toBe(legacyNote);
    });

    it("renders English translation for price reason code with interpolation", () => {
      const result = renderPriceReason(
        { code: PriceReasonCode.HISTORICAL_BENCHMARK, params: { grade: "A" } },
        i18n.t.bind(i18n),
      );
      expect(result).toBe("Historical price benchmark for Grade A");
    });

    it("renders Bangla translation for price reason code with interpolation", async () => {
      await i18n.changeLanguage("bn");
      const result = renderPriceReason(
        { code: PriceReasonCode.HISTORICAL_BENCHMARK, params: { grade: "A" } },
        i18n.t.bind(i18n),
      );
      expect(result).toBe("গ্রেড A-এর জন্য ঐতিহাসিক বেঞ্চমার্ক দর");
      await i18n.changeLanguage("en");
    });
  });

  describe("Shared schema compatibility with structured reasons", () => {
    it("validates aiAssessmentSchema with structured grading reason items", () => {
      const sample = {
        grade: "A",
        confidence: 0.95,
        confidenceBand: "HIGH",
        classProbabilities: { A: 0.8, B: 0.15, C: 0.05 },
        qualityNotes: [
          { code: GradingReasonCode.COLOR_UNIFORM },
          { code: GradingReasonCode.SKIN_INTACT },
        ],
        cropMatch: true,
        modelVersion: "mock-1.0",
        provider: "mock",
        degraded: false,
        assessedAt: new Date().toISOString(),
      };

      const parsed = aiAssessmentSchema.safeParse(sample);
      expect(parsed.success).toBe(true);
    });

    it("validates priceGuidanceSchema with structured price reason items", () => {
      const sample = {
        lowPerKg: 3000,
        expectedPerKg: 3500,
        highPerKg: 4000,
        trend: "UP",
        confidence: 0.9,
        explanation: [
          { code: PriceReasonCode.HISTORICAL_BENCHMARK, params: { grade: "A" } },
          { code: PriceReasonCode.TREND_UP },
        ],
        modelVersion: "mock-price-1.0",
        provider: "mock",
        degraded: false,
        generatedAt: new Date().toISOString(),
        suggestedFloorPerKg: 3000,
      };

      const parsed = priceGuidanceSchema.safeParse(sample);
      expect(parsed.success).toBe(true);
    });
  });
});
