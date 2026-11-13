import type { RequestHandler } from "express";
import type { AssessmentResult, PredictPriceRequest, PriceGuidance } from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import { assessCropQuality, predictCropPrice } from "./ai.service.js";

export const assessQualityController: RequestHandler<
  Record<string, string>,
  { data: AssessmentResult },
  Record<string, unknown>,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const cropIdentifier = (request.body.cropId ?? request.body.crop) as string | undefined;
  if (!cropIdentifier) {
    throw new AppError(400, "VALIDATION_ERROR", "Field cropId is required");
  }

  const files = request.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one image is required");
  }

  const result = await assessCropQuality(response.locals.currentUser.id, cropIdentifier, files);

  response.status(200).json({ data: result });
};

export const predictPriceController: RequestHandler<
  Record<string, string>,
  { data: PriceGuidance },
  PredictPriceRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const farmer = response.locals.currentUser;
  const guidance = await predictCropPrice(farmer.id, farmer.division, request.body);

  response.status(200).json({ data: guidance });
};
