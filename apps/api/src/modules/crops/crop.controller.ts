import type { RequestHandler } from "express";

import type { CropResponse } from "@bazarbeat/shared";

import { listActiveCrops } from "./crop.service.js";

export const getCropsController: RequestHandler<
  Record<string, string>,
  { data: CropResponse[] }
> = async (_request, response): Promise<void> => {
  const crops = await listActiveCrops();
  response.status(200).json({ data: crops });
};
