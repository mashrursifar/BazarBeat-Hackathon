import { createHash, createHmac, randomUUID } from "node:crypto";

import { env } from "../../config/env.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

interface TokenClaims {
  sub: string;
  iat: number;
  exp: number;
  type: "access" | "refresh";
  jti: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function createSessionTokens(userId: string, issuedAt = Math.floor(Date.now() / 1000)): SessionTokens {
  const accessClaims: TokenClaims = {
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
    type: "access",
    jti: randomUUID(),
  };
  const refreshClaims: TokenClaims = {
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + REFRESH_TOKEN_TTL_SECONDS,
    type: "refresh",
    jti: randomUUID(),
  };

  return {
    accessToken: signToken(accessClaims, env.JWT_ACCESS_SECRET),
    refreshToken: signToken(refreshClaims, env.JWT_REFRESH_SECRET),
    refreshExpiresAt: new Date(refreshClaims.exp * 1000),
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signToken(claims: TokenClaims, secret: string): string {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson(claims);
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
