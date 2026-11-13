import { Router } from "express";
import { getConfigController } from "./config.controller.js";

export const configRouter = Router();

configRouter.get("/", getConfigController);
