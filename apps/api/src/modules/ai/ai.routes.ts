import { Router } from "express";
import rateLimit from "express-rate-limit";
import { UserRole, predictPriceRequestSchema } from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import {
  requireAuthentication,
  requireRole,
  type AuthenticatedLocals,
} from "../auth/auth.middleware.js";
import { uploadImagesMiddleware } from "../storage/upload.middleware.js";
import {
  assessQualityController,
  predictPriceController,
} from "./ai.controller.js";

export const aiRouter = Router();

export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (_request, response): string => {
    const user = (response.locals as AuthenticatedLocals | undefined)?.currentUser;
    return user ? user.id : "anonymous";
  },
  handler: (_request, response): void => {
    response.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "AI rate limit exceeded. Maximum 10 requests per minute per user.",
      },
    });
  },
});

aiRouter.post(
  "/assess-quality",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  aiRateLimit,
  uploadImagesMiddleware,
  assessQualityController,
);

aiRouter.post(
  "/predict-price",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  aiRateLimit,
  validateBody(predictPriceRequestSchema),
  predictPriceController,
);
