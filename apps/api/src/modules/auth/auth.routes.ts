import { Router } from "express";
import rateLimit from "express-rate-limit";

import { registerSchema } from "@bazarbeat/shared";

import { registerController } from "./auth.controller.js";
import { validateBody } from "../../shared/validate-body.js";

const registrationRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response): void => {
    response.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many registration attempts. Try again shortly." },
    });
  },
});

export const authRouter = Router();
authRouter.post("/register", registrationRateLimit, validateBody(registerSchema), registerController);
