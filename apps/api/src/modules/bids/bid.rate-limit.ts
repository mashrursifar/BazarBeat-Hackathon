import rateLimit from "express-rate-limit";
import type { AuthenticatedLocals } from "../auth/auth.middleware.js";

export const bidsRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
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
        message: "Bidding rate limit exceeded. Maximum 20 bids per minute per user.",
      },
    });
  },
});

