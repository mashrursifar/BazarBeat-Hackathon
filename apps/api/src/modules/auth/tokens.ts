import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

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

export interface RefreshTokenClaims {
  sub: string;
  iat: number;
  exp: number;
  type: "refresh";
  jti: string;
}

const tokenHeaderSchema = z.object({ alg: z.literal("HS256"), typ: z.literal("JWT") });
const tokenClaimsSchema = z.object({
  sub: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  type: z.enum(["access", "refresh"]),
  jti: z.string().uuid(),
});

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

export function verifyRefreshToken(token: string, now = Math.floor(Date.now() / 1000)): RefreshTokenClaims | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  if (encodedHeader === undefined || encodedClaims === undefined || encodedSignature === undefined) return null;

  const header = tokenHeaderSchema.safeParse(parseJson(encodedHeader));
  const claims = tokenClaimsSchema.safeParse(parseJson(encodedClaims));
  if (!header.success || !claims.success || claims.data.type !== "refresh" || claims.data.exp <= now) return null;

  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const expectedSignature = createHmac("sha256", env.JWT_REFRESH_SECRET).update(signingInput).digest();
  const receivedSignature = Buffer.from(encodedSignature, "base64url");
  if (receivedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(receivedSignature, expectedSignature)) return null;
  return { ...claims.data, type: "refresh" };
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

function parseJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString());
  } catch {
    return null;
  }
}
