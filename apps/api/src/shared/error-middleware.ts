import type { ErrorRequestHandler } from "express";

import { AppError } from "./errors.js";
import { logger } from "./logger.js";
import { redactSensitiveObject, redactSensitiveText } from "./redact.js";

export const errorMiddleware: ErrorRequestHandler = (error: unknown, _req, res, next): void => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: redactSensitiveText(error.message),
        ...(error.details !== undefined ? { details: redactSensitiveObject(error.details) } : {}),
      },
    });
    return;
  }
  logger.error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: { code: "INTERNAL", message: "An unexpected error occurred" } });
};
