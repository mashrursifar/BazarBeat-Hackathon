import { describe, expect, it } from "vitest";

import { createSessionTokens, hashRefreshToken, verifyRefreshToken } from "./tokens.js";

describe("session tokens", () => {
  it("sets 15-minute and seven-day expirations and hashes refresh tokens", () => {
    const issuedAt = 1_800_000_000;
    const tokens = createSessionTokens("user-id", issuedAt);

    const accessSegments = tokens.accessToken.split(".");
    const refreshSegments = tokens.refreshToken.split(".");
    expect(accessSegments).toHaveLength(3);
    expect(refreshSegments).toHaveLength(3);
    const accessPayload = JSON.parse(Buffer.from(accessSegments[1] ?? "", "base64url").toString()) as unknown;
    const refreshPayload = JSON.parse(Buffer.from(refreshSegments[1] ?? "", "base64url").toString()) as unknown;
    expect(accessPayload).toMatchObject({ sub: "user-id", iat: issuedAt, exp: issuedAt + 15 * 60, type: "access" });
    expect(refreshPayload).toMatchObject({
      sub: "user-id",
      iat: issuedAt,
      exp: issuedAt + 7 * 24 * 60 * 60,
      type: "refresh",
    });
    expect(tokens.refreshExpiresAt).toEqual(new Date((issuedAt + 7 * 24 * 60 * 60) * 1000));
    expect(hashRefreshToken(tokens.refreshToken)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(tokens.refreshToken)).not.toBe(tokens.refreshToken);
    expect(verifyRefreshToken(tokens.refreshToken, issuedAt)).toMatchObject({ sub: "user-id", type: "refresh" });
    expect(verifyRefreshToken(tokens.accessToken, issuedAt)).toBeNull();
    const [header, payload, signature] = tokens.refreshToken.split(".");
    const tamperedToken = `${header}.${payload}.${signature === "x" ? "y" : "x"}`;
    expect(verifyRefreshToken(tamperedToken, issuedAt)).toBeNull();
    expect(verifyRefreshToken(tokens.refreshToken, issuedAt + 7 * 24 * 60 * 60)).toBeNull();
  });
});
