import type { RequestHandler } from "express";

import { AppError } from "./errors.js";

export const requireCsrfProtection: RequestHandler = (request, _response, next): void => {
  if (request.get("X-CSRF-Protection") !== "1") {
    next(new AppError(403, "FORBIDDEN", "The CSRF protection header is required"));
    return;
  }
  next();
};
