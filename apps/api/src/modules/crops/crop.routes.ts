import { Router } from "express";

import { getCropsController } from "./crop.controller.js";

export const cropsRouter = Router();
cropsRouter.get("/", getCropsController);
