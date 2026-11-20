import pino from "pino";

import { env } from "../config/env.js";
import { redactSensitiveObject } from "./redact.js";

export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "req.headers['x-goog-api-key']",
  "req.headers['x-api-key']",
  "password",
  "token",
  "refreshToken",
  "accessToken",
  "jwt",
  "phone",
  "phoneNumber",
  "secret",
  "AI_SERVICE_KEY",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
  "GEMINI_API_KEY",
  "geminiApiKey",
  "apiKey",
  "*.password",
  "*.token",
  "*.refreshToken",
  "*.accessToken",
  "*.phone",
  "*.phoneNumber",
  "*.secret",
  "*.GEMINI_API_KEY",
  "*.geminiApiKey",
  "*.apiKey",
];

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : env.NODE_ENV === "test" ? "silent" : "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
    log: (obj) => redactSensitiveObject(obj),
  },
  serializers: {
    err: (err) => {
      const serialized = pino.stdSerializers.err(err as Error);
      return redactSensitiveObject(serialized);
    },
  },
});
