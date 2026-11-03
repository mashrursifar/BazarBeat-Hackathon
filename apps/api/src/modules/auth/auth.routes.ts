import { type RequestHandler, Router } from "express";
import rateLimit from "express-rate-limit";

import { loginSchema, refreshCookieSchema, registerSchema } from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { AppError } from "../../shared/errors.js";
import { requireAuthentication } from "./auth.middleware.js";
import { loginController, logoutController, refreshController, registerController } from "./auth.controller.js";
import { validateBody } from "../../shared/validate-body.js";

const registrationRateLimit = createAuthRateLimit("registration");
const loginRateLimit = createAuthRateLimit("login");
const refreshRateLimit = createAuthRateLimit("refresh");
const logoutRateLimit = createAuthRateLimit("logout");
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
authRouter.post("/register", registrationRateLimit, requireCsrfProtection, validateBody(registerSchema), registerController);
authRouter.post("/login", loginRateLimit, requireCsrfProtection, validateBody(loginSchema), loginController);
authRouter.post("/refresh", refreshRateLimit, requireCsrfProtection, validateRefreshCookie, refreshController);
authRouter.post("/logout", logoutRateLimit, requireAuthentication, requireCsrfProtection, logoutController);

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
