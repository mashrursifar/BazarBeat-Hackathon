import crypto from "node:crypto";
import mongoose from "mongoose";
import { ObjectId } from "bson";
import {
  AIProvider,
  type AssessmentResult,
  type PredictPriceRequest,
  type PriceGuidance,
} from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { Crop } from "../crops/crop.model.js";
import { LocalDiskStorageProvider } from "../storage/local-disk.provider.js";
import { type ProcessedImage, processImage } from "../storage/image-processor.js";
import type { GradingProvider, PricePredictionProvider } from "./interfaces.js";
import { createGradingProvider, createPricePredictionProvider } from "./provider.factory.js";
import { AiAssessmentRecord, type AiAssessmentRecordDoc } from "./ai-assessment-record.model.js";

const storageProvider = new LocalDiskStorageProvider();
const gradingProvider = createGradingProvider();
const pricePredictionProvider = createPricePredictionProvider();

export function getGradingProvider(): GradingProvider {
  return gradingProvider;
}

export function getPricePredictionProvider(): PricePredictionProvider {
  return pricePredictionProvider;
}

export function hashAssessmentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Handles image processing, grading assessment, token generation, and persistence.
 */
export async function assessCropQuality(
  farmerId: string,
  cropIdentifier: string,
  files: Express.Multer.File[],
): Promise<AssessmentResult> {
  if (!cropIdentifier || typeof cropIdentifier !== "string" || cropIdentifier.trim().length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Valid cropId is required");
  }

  const crop = mongoose.isValidObjectId(cropIdentifier)
    ? await Crop.findById(cropIdentifier)
    : await Crop.findOne({ slug: cropIdentifier.trim().toLowerCase() });

  if (!crop) {
    throw new AppError(404, "NOT_FOUND", "Crop not found in catalog");
  }

  if (!files || files.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one image is required");
  }

  if (files.length > 4) {
    throw new AppError(400, "VALIDATION_ERROR", "Maximum 4 images allowed");
  }

  // 1. Process all images with Sharp (verify magic bytes, resize, strip EXIF, compute hash)
  const processedImages: ProcessedImage[] = [];
  for (const file of files) {
    const processed = await processImage(file.buffer);
    processedImages.push(processed);
  }

  // 2. Store processed images
  const storedImages: { url: string; width: number; height: number; hash: string }[] = [];
  for (const processed of processedImages) {
    const url = await storageProvider.store(processed.buffer, `image.${processed.format}`);
    storedImages.push({
      url,
      width: processed.width,
      height: processed.height,
      hash: processed.hash,
    });
  }

  // 3. Call Grading Provider
  const startTime = Date.now();
  const assessment = await gradingProvider.assessQuality({
    cropId: crop._id.toString(),
    images: processedImages.map((img) => img.buffer),
  });
  const durationMs = Date.now() - startTime;

  // Log provider, duration and model version only (never images or secrets)
  logger.info(
    {
      provider: assessment.provider,
      durationMs,
      modelVersion: assessment.modelVersion,
    },
    "AI quality assessment completed",
  );

  // 4. Validate assessment result conditions
  if (!assessment.cropMatch) {
    throw new AppError(422, "CROP_MISMATCH", "The uploaded photos do not match the selected crop");
  }

  if (assessment.confidence < 0.55) {
    throw new AppError(
      422,
      "GRADE_UNAVAILABLE",
      "Quality grade could not be determined with sufficient confidence. Please provide clearer photos in good lighting",
    );
  }

  // 5. Generate opaque token and store record
  const assessmentToken = crypto.randomBytes(32).toString("hex");
  const assessmentTokenHash = hashAssessmentToken(assessmentToken);
  const confidenceBand = assessment.confidence >= 0.8 ? "HIGH" : "MEDIUM";
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes TTL

  const record = await AiAssessmentRecord.create({
    farmerId: new ObjectId(farmerId),
    cropId: crop._id,
    assessmentTokenHash,
    grade: assessment.grade,
    confidence: assessment.confidence,
    confidenceBand,
    classProbabilities: assessment.classProbabilities,
    qualityNotes:
      assessment.qualityNotes.length > 0
        ? assessment.qualityNotes
        : ["Visual quality evaluated by AI"],
    cropMatch: assessment.cropMatch,
    modelVersion: assessment.modelVersion,
    provider: assessment.provider ?? AIProvider.MOCK,
    degraded: assessment.degraded ?? false,
    assessedAt: new Date(assessment.assessedAt),
    images: storedImages,
    imageHashes: storedImages.map((img) => img.hash),
    isConsumed: false,
    expiresAt,
  });

  return {
    grade: record.grade as "A" | "B" | "C",
    confidence: record.confidence,
    confidenceBand,
    classProbabilities: record.classProbabilities,
    qualityNotes: record.qualityNotes,
    cropMatch: record.cropMatch,
    modelVersion: record.modelVersion,
    provider: record.provider as "mock" | "http",
    degraded: record.degraded,
    assessedAt: record.assessedAt.toISOString(),
    assessmentToken,
  };
}

/**
 * Predicts price guidance including suggested floor price.
 */
export async function predictCropPrice(
  farmerId: string,
  division: string | undefined,
  request: PredictPriceRequest,
): Promise<PriceGuidance> {
  const crop = await Crop.findById(request.cropId);
  if (!crop) {
    throw new AppError(404, "NOT_FOUND", "Crop not found in catalog");
  }

  const startTime = Date.now();
  const guidance = await pricePredictionProvider.predictPrice(request, division);
  const durationMs = Date.now() - startTime;

  // Log provider, duration and model version only
  logger.info(
    {
      provider: guidance.provider,
      durationMs,
      modelVersion: guidance.modelVersion,
    },
    "AI price prediction completed",
  );

  return guidance;
}

/**
 * Validates and checks an assessment token for listing creation.
 */
export async function getValidAssessmentRecord(
  rawToken: string,
  farmerId: string,
  cropId?: string,
): Promise<AiAssessmentRecordDoc> {
  const assessmentTokenHash = hashAssessmentToken(rawToken);

  const record = await AiAssessmentRecord.findOne({ assessmentTokenHash });
  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Assessment record not found");
  }

  if (record.farmerId.toString() !== farmerId) {
    throw new AppError(403, "FORBIDDEN", "This assessment token does not belong to you");
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "VALIDATION_ERROR", "Assessment record has expired");
  }

  if (record.isConsumed) {
    throw new AppError(409, "CONFLICT", "Assessment token has already been used");
  }

  if (cropId && record.cropId.toString() !== cropId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Assessment token does not match the requested crop",
    );
  }

  return record;
}
