import { Router } from "express";

import { requireAuthentication } from "../auth/auth.middleware.js";
import { meController } from "./users.controller.js";

export const usersRouter = Router();
usersRouter.get("/me", requireAuthentication, meController);
