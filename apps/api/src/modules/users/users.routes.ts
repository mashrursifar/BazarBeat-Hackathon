import { Router } from "express";

import { updateProfileSchema } from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { requireAuthentication } from "../auth/auth.middleware.js";
import { meController, updateMeController } from "./users.controller.js";
import { meStreamController } from "../notifications/notification.controller.js";

export const usersRouter = Router();
usersRouter.get("/me", requireAuthentication, meController);
usersRouter.patch("/me", requireAuthentication, requireCsrfProtection, validateBody(updateProfileSchema), updateMeController);
usersRouter.get("/me/stream", requireAuthentication, meStreamController);
