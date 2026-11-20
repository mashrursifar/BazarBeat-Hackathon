import path from "node:path";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/AgriBid"),
  JWT_ACCESS_SECRET: z.string().default("local-development-access-secret-change-before-deploy"),
  JWT_REFRESH_SECRET: z.string().default("local-development-refresh-secret-change-before-deploy"),
  COOKIE_DOMAIN: z.string().default(""),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  // AI Provider split configuration (Task G1: Phase 9 Gemini alternative)
  AI_GRADING_PROVIDER: z.enum(["mock", "gemini"]).default("mock"),
  AI_PRICE_PROVIDER: z.enum(["mock", "baseline"]).default("mock"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.1-flash-lite"),
  GEMINI_GRADE_SAMPLES: z.coerce.number().int().positive().default(3),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  AI_DAILY_ASSESSMENTS_PER_USER: z.coerce.number().int().positive().default(20),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  AI_SERVICE_KEY: z.string().default("local-mock-key"),
  STORAGE_PROVIDER: z.enum(["local", "cloud"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  // S3-compatible cloud storage configuration (Task 9.2: Cloudflare R2, AWS S3, Backblaze B2, MinIO)
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_PUBLIC_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  DEMO_MODE: z.stringbool().default(false),
  ALLOW_DEMO_SEED: z.stringbool().default(false),
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(200),
  // Production hardening & environment configuration (Task 9.1)
  TRUST_PROXY: z.string().default("false"),
  SERVE_WEB: z.stringbool().default(false),
  WEB_DIST_PATH: z.string().optional(),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(10),
  GIT_SHA: z.string().default("dev"),
}).superRefine((values, context) => {
  // Validation (Task G1): Boot fails if gemini is selected without an API key
  if (values.AI_GRADING_PROVIDER === "gemini") {
    if (
      !values.GEMINI_API_KEY ||
      values.GEMINI_API_KEY.trim().length === 0 ||
      values.GEMINI_API_KEY.startsWith("replace-with-")
    ) {
      context.addIssue({
        code: "custom",
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required when AI_GRADING_PROVIDER is 'gemini'",
      });
    }
  }

  if (values.NODE_ENV !== "production") return;
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    const secret = values[key];
    if (secret.length < 32) {
      context.addIssue({ code: "custom", path: [key], message: "Production JWT secrets must be at least 32 characters" });
    } else if (
      secret.startsWith("local-development-") ||
      secret.startsWith("replace-with-") ||
      secret.includes("change-before-deploy")
    ) {
      context.addIssue({ code: "custom", path: [key], message: "Production JWT secrets must not use default or placeholder values" });
    }
  }
  if (values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) {
    context.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "Access and refresh secrets must be distinct" });
  }
  if (values.COOKIE_DOMAIN.length === 0 || values.COOKIE_DOMAIN === "localhost") {
    context.addIssue({ code: "custom", path: ["COOKIE_DOMAIN"], message: "Production must configure COOKIE_DOMAIN" });
  }
  if (values.STORAGE_PROVIDER === "cloud") {
    const hasS3Config = Boolean(
      values.S3_BUCKET && values.S3_ACCESS_KEY_ID && values.S3_SECRET_ACCESS_KEY,
    );
    const hasCloudinaryUrl = Boolean(values.CLOUDINARY_URL);
    const hasCloudinaryKeys = Boolean(
      values.CLOUDINARY_CLOUD_NAME && values.CLOUDINARY_API_KEY && values.CLOUDINARY_API_SECRET,
    );
    if (!hasS3Config && !hasCloudinaryUrl && !hasCloudinaryKeys) {
      context.addIssue({
        code: "custom",
        path: ["STORAGE_PROVIDER"],
        message:
          "Production cloud storage requires S3 credentials (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) or Cloudinary credentials",
      });
    }
  }
});

/**
 * Parses the TRUST_PROXY environment value into the type expected by Express app.set('trust proxy', ...)
 */
export function parseTrustProxy(val?: string): boolean | number | string {
  if (!val || val === "false" || val === "0") return false;
  if (val === "true") return true;
  const num = Number(val);
  if (!Number.isNaN(num) && Number.isInteger(num)) return num;
  return val;
}

export const env = envSchema.parse(process.env);
