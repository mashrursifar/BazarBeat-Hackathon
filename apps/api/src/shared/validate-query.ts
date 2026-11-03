import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "./errors.js";

export interface QueryValidationLocals<T> {
  validatedQuery: T;
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (request, response, next): void => {
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Query parameters are invalid"));
      return;
    }
    response.locals.validatedQuery = parsed.data;
    next();
  };
}
