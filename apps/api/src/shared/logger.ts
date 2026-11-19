import pino from "pino";

import { env } from "../config/env.js";

export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
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
  "*.password",
  "*.token",
  "*.refreshToken",
  "*.accessToken",
  "*.phone",
  "*.phoneNumber",
  "*.secret",
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
  },
});
