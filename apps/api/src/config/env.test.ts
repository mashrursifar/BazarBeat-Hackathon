import { describe, expect, it } from "vitest";

import { envSchema, parseTrustProxy } from "./env.js";

describe("environment validation", () => {
  it("defaults to the existing AgriBid database name", () => {
    expect(envSchema.parse({}).MONGODB_URI).toBe("mongodb://127.0.0.1:27017/AgriBid");
  });

  it("rejects development JWT secrets and a missing cookie domain in production", () => {
    expect(envSchema.safeParse({ NODE_ENV: "production" }).success).toBe(false);
  });

  it("rejects placeholder and identical JWT secrets in production", () => {
    const identical = envSchema.safeParse({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(40),
      JWT_REFRESH_SECRET: "a".repeat(40),
      COOKIE_DOMAIN: "AgriBid.example",
    });
    expect(identical.success).toBe(false);

    const placeholder = envSchema.safeParse({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "replace-with-a-very-long-secret-key-12345",
      JWT_REFRESH_SECRET: "b".repeat(40),
      COOKIE_DOMAIN: "AgriBid.example",
    });
    expect(placeholder.success).toBe(false);
  });

  it("rejects missing cloud storage credentials in production when STORAGE_PROVIDER=cloud", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(40),
      JWT_REFRESH_SECRET: "b".repeat(40),
      COOKIE_DOMAIN: "AgriBid.example",
      STORAGE_PROVIDER: "cloud",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid S3 cloud storage credentials in production when STORAGE_PROVIDER=cloud", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(40),
      JWT_REFRESH_SECRET: "b".repeat(40),
      COOKIE_DOMAIN: "AgriBid.example",
      STORAGE_PROVIDER: "cloud",
      S3_BUCKET: "bazarbeat-uploads",
      S3_ACCESS_KEY_ID: "sample-access-key",
      S3_SECRET_ACCESS_KEY: "sample-secret-key",
      S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_PUBLIC_URL: "https://pub-sample.r2.dev",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.S3_BUCKET).toBe("bazarbeat-uploads");
      expect(result.data.S3_REGION).toBe("auto");
      expect(result.data.S3_PUBLIC_URL).toBe("https://pub-sample.r2.dev");
    }
  });

  it("accepts strong production secrets and a configured cookie domain", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(40),
      JWT_REFRESH_SECRET: "b".repeat(40),
      COOKIE_DOMAIN: "AgriBid.example",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TRUST_PROXY).toBe("false");
      expect(result.data.RATE_LIMIT_AUTH_PER_MIN).toBe(10);
      expect(result.data.GIT_SHA).toBe("dev");
    }
  });

  describe("AI provider split configuration (Task G1)", () => {
    it("defaults to mock providers and default Gemini parameters", () => {
      const parsed = envSchema.parse({});
      expect(parsed.AI_GRADING_PROVIDER).toBe("mock");
      expect(parsed.AI_PRICE_PROVIDER).toBe("mock");
      expect(parsed.GEMINI_MODEL).toBe("gemini-2.5-flash");
      expect(parsed.GEMINI_GRADE_SAMPLES).toBe(3);
      expect(parsed.GEMINI_TIMEOUT_MS).toBe(10_000);
      expect(parsed.AI_DAILY_ASSESSMENTS_PER_USER).toBe(20);
    });

    it("rejects unknown values for AI_GRADING_PROVIDER", () => {
      const result = envSchema.safeParse({ AI_GRADING_PROVIDER: "http" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("AI_GRADING_PROVIDER");
      }
    });

    it("rejects unknown values for AI_PRICE_PROVIDER", () => {
      const result = envSchema.safeParse({ AI_PRICE_PROVIDER: "gemini" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("AI_PRICE_PROVIDER");
      }
    });

    it("rejects AI_GRADING_PROVIDER=gemini without GEMINI_API_KEY across all environments", () => {
      const devMissing = envSchema.safeParse({
        NODE_ENV: "development",
        AI_GRADING_PROVIDER: "gemini",
      });
      expect(devMissing.success).toBe(false);
      if (!devMissing.success) {
        expect(devMissing.error.issues[0]?.path).toContain("GEMINI_API_KEY");
        expect(devMissing.error.issues[0]?.message).toContain("GEMINI_API_KEY is required");
      }

      const emptyKey = envSchema.safeParse({
        AI_GRADING_PROVIDER: "gemini",
        GEMINI_API_KEY: "   ",
      });
      expect(emptyKey.success).toBe(false);

      const placeholderKey = envSchema.safeParse({
        AI_GRADING_PROVIDER: "gemini",
        GEMINI_API_KEY: "replace-with-your-key",
      });
      expect(placeholderKey.success).toBe(false);
    });

    it("accepts AI_GRADING_PROVIDER=gemini when a valid GEMINI_API_KEY is provided", () => {
      const result = envSchema.safeParse({
        AI_GRADING_PROVIDER: "gemini",
        GEMINI_API_KEY: "AIzaSyValidGeminiKeyForTest1234567890",
        GEMINI_MODEL: "gemini-2.5-flash",
        GEMINI_GRADE_SAMPLES: 4,
        GEMINI_TIMEOUT_MS: 15_000,
        AI_DAILY_ASSESSMENTS_PER_USER: 30,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AI_GRADING_PROVIDER).toBe("gemini");
        expect(result.data.GEMINI_API_KEY).toBe("AIzaSyValidGeminiKeyForTest1234567890");
        expect(result.data.GEMINI_MODEL).toBe("gemini-2.5-flash");
        expect(result.data.GEMINI_GRADE_SAMPLES).toBe(4);
        expect(result.data.GEMINI_TIMEOUT_MS).toBe(15_000);
        expect(result.data.AI_DAILY_ASSESSMENTS_PER_USER).toBe(30);
      }
    });

    it("accepts AI_PRICE_PROVIDER=baseline", () => {
      const result = envSchema.safeParse({
        AI_PRICE_PROVIDER: "baseline",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AI_PRICE_PROVIDER).toBe("baseline");
      }
    });

    it("rejects non-positive sample count, timeout, and daily cap", () => {
      expect(envSchema.safeParse({ GEMINI_GRADE_SAMPLES: 0 }).success).toBe(false);
      expect(envSchema.safeParse({ GEMINI_GRADE_SAMPLES: -1 }).success).toBe(false);
      expect(envSchema.safeParse({ GEMINI_TIMEOUT_MS: 0 }).success).toBe(false);
      expect(envSchema.safeParse({ GEMINI_TIMEOUT_MS: -500 }).success).toBe(false);
      expect(envSchema.safeParse({ AI_DAILY_ASSESSMENTS_PER_USER: 0 }).success).toBe(false);
      expect(envSchema.safeParse({ AI_DAILY_ASSESSMENTS_PER_USER: -5 }).success).toBe(false);
    });
  });

  describe("parseTrustProxy helper", () => {
    it("parses falsy values to boolean false", () => {
      expect(parseTrustProxy(undefined)).toBe(false);
      expect(parseTrustProxy("")).toBe(false);
      expect(parseTrustProxy("false")).toBe(false);
      expect(parseTrustProxy("0")).toBe(false);
    });

    it("parses 'true' to boolean true", () => {
      expect(parseTrustProxy("true")).toBe(true);
    });

    it("parses integer strings to numbers", () => {
      expect(parseTrustProxy("1")).toBe(1);
      expect(parseTrustProxy("2")).toBe(2);
    });

    it("passes through host / subnet strings", () => {
      expect(parseTrustProxy("loopback")).toBe("loopback");
      expect(parseTrustProxy("127.0.0.1, 10.0.0.1")).toBe("127.0.0.1, 10.0.0.1");
    });
  });
});
