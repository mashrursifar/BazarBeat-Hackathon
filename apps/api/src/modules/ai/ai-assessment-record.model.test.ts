import { describe, expect, it } from "vitest";
import { ObjectId } from "bson";
import { AIProvider } from "@bazarbeat/shared";

import { AiAssessmentRecord } from "./ai-assessment-record.model.js";

describe("AiAssessmentRecord Schema Validation", () => {
  const validBaseData = {
    farmerId: new ObjectId("507f1f77bcf86cd799439011"),
    cropId: new ObjectId("507f1f77bcf86cd799439022"),
    assessmentTokenHash: "abc123hash",
    grade: "A" as const,
    confidence: 0.92,
    confidenceBand: "HIGH" as const,
    classProbabilities: { A: 0.92, B: 0.05, C: 0.03 },
    qualityNotes: [{ code: "GRADE_A_PREMIUM" }],
    cropMatch: true,
    modelVersion: "gemini-3.1-flash-lite",
    degraded: false,
    assessedAt: new Date(),
    images: [{ url: "/uploads/img.jpg", width: 800, height: 600, hash: "imghash" }],
    imageHashes: ["imghash"],
    isConsumed: false,
    expiresAt: new Date(Date.now() + 1800000),
  };

  it("successfully validates when provider is 'gemini'", () => {
    const doc = new AiAssessmentRecord({
      ...validBaseData,
      provider: AIProvider.GEMINI,
    });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it("successfully validates when provider is 'mock'", () => {
    const doc = new AiAssessmentRecord({
      ...validBaseData,
      provider: AIProvider.MOCK,
    });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it("successfully validates when provider is 'http'", () => {
    const doc = new AiAssessmentRecord({
      ...validBaseData,
      provider: AIProvider.HTTP,
    });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it("successfully validates when provider is 'baseline'", () => {
    const doc = new AiAssessmentRecord({
      ...validBaseData,
      provider: AIProvider.BASELINE,
    });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it("rejects invalid provider values", () => {
    const doc = new AiAssessmentRecord({
      ...validBaseData,
      provider: "invalid-provider" as never,
    });
    const error = doc.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors.provider).toBeDefined();
  });
});
