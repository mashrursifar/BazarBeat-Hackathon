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
