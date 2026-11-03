import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/bazarbeat"),
  JWT_ACCESS_SECRET: z.string().default("local-development-access-secret-change-before-deploy"),
  JWT_REFRESH_SECRET: z.string().default("local-development-refresh-secret-change-before-deploy"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  AI_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  AI_SERVICE_KEY: z.string().default("local-mock-key"),
  STORAGE_PROVIDER: z.enum(["local", "cloud"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  DEMO_MODE: z.stringbool().default(false),
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(200),
});

export const env = envSchema.parse(process.env);
