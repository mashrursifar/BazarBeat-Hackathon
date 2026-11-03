import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "./errors.js";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next): void => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Request body is invalid"));
      return;
    }
    request.body = parsed.data;
    next();
  };
}
