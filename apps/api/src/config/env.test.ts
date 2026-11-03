import { describe, expect, it } from "vitest";

import { envSchema } from "./env.js";

describe("environment validation", () => {
  it("rejects development JWT secrets and a missing cookie domain in production", () => {
    expect(envSchema.safeParse({ NODE_ENV: "production" }).success).toBe(false);
  });

  it("accepts strong production secrets and a configured cookie domain", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(40),
      JWT_REFRESH_SECRET: "b".repeat(40),
      COOKIE_DOMAIN: "bazarbeat.example",
    });

    expect(result.success).toBe(true);
  });
});
