import { Router } from "express";
import { UserRole, myBidsQuerySchema } from "@bazarbeat/shared";

import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import { validateQuery } from "../../shared/validate-query.js";
import { getMyBidsController } from "./bid.controller.js";

export const bidsRouter = Router();

bidsRouter.get(
  "/mine",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  validateQuery(myBidsQuerySchema),
  getMyBidsController,
);
