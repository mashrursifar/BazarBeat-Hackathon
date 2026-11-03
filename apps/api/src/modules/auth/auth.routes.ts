import { type RequestHandler, Router } from "express";
import rateLimit from "express-rate-limit";

import { loginSchema, refreshCookieSchema, registerSchema } from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { loginController, refreshController, registerController } from "./auth.controller.js";
import { validateBody } from "../../shared/validate-body.js";

const registrationRateLimit = createAuthRateLimit("registration");
const loginRateLimit = createAuthRateLimit("login");
const refreshRateLimit = createAuthRateLimit("refresh");
const requireCsrfHeader: RequestHandler = (request, _response, next): void => {
  if (request.get("X-CSRF-Protection") !== "1") {
    next(new AppError(403, "FORBIDDEN", "The CSRF protection header is required"));
    return;
  }
  next();
};
const validateRefreshCookie: RequestHandler = (request, _response, next): void => {
  const parsed = refreshCookieSchema.safeParse(request.cookies);
  if (!parsed.success) {
    next(new AppError(401, "UNAUTHENTICATED", "Refresh session is missing"));
    return;
  }
  request.cookies = parsed.data;
  next();
};

export const authRouter = Router();
authRouter.post("/register", registrationRateLimit, requireCsrfHeader, validateBody(registerSchema), registerController);
authRouter.post("/login", loginRateLimit, requireCsrfHeader, validateBody(loginSchema), loginController);
authRouter.post("/refresh", refreshRateLimit, requireCsrfHeader, validateRefreshCookie, refreshController);

function createAuthRateLimit(action: string): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response): void => {
      response.status(429).json({
        error: { code: "RATE_LIMITED", message: `Too many ${action} attempts. Try again shortly.` },
      });
    },
  });
}
