import { Router } from "express";
import {
  markNotificationsReadRequestSchema,
  notificationQuerySchema,
} from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication } from "../auth/auth.middleware.js";
import {
  getNotificationsController,
  markNotificationsReadController,
} from "./notification.controller.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requireAuthentication,
  validateQuery(notificationQuerySchema),
  getNotificationsController,
);

notificationsRouter.post(
  "/read",
  requireAuthentication,
  requireCsrfProtection,
  validateBody(markNotificationsReadRequestSchema),
  markNotificationsReadController,
);
