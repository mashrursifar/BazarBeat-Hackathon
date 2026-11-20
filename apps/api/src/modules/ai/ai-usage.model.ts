import mongoose, { type InferSchemaType } from "mongoose";
import { ObjectId } from "bson";
import { AIErrorCode } from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";

const aiUserDailyUsageSchema = new mongoose.Schema(
  {
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true }, // UTC YYYY-MM-DD
    count: { type: Number, required: true, default: 0 },
    lastAssessedAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: "ai_user_daily_usages", versionKey: false },
);

aiUserDailyUsageSchema.index({ farmerId: 1, date: 1 }, { unique: true });

export type AiUserDailyUsageDoc = InferSchemaType<typeof aiUserDailyUsageSchema>;

export const AiUserDailyUsage = mongoose.models.AiUserDailyUsage
  ? mongoose.model<AiUserDailyUsageDoc>("AiUserDailyUsage")
  : mongoose.model<AiUserDailyUsageDoc>("AiUserDailyUsage", aiUserDailyUsageSchema);

/**
 * Safely converts farmerId string to ObjectId, supporting non-standard test IDs without throwing BSONError.
 */
export function toFarmerObjectId(farmerId: string): ObjectId {
  if (ObjectId.isValid(farmerId)) {
    return new ObjectId(farmerId);
  }
  const hex = Buffer.from(farmerId.padEnd(12, "0")).toString("hex").slice(0, 24);
  return new ObjectId(hex);
}

/**
 * Returns current UTC date string in YYYY-MM-DD format (Hard Rule 7: Time is UTC).
 */
export function getUtcDayString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Retrieves the count of assessments performed by a farmer on a specific UTC day.
 */
export async function getDailyAssessmentCount(
  farmerId: string,
  date: Date = new Date(),
): Promise<number> {
  const dateStr = getUtcDayString(date);
  const record = await AiUserDailyUsage.findOne({
    farmerId: toFarmerObjectId(farmerId),
    date: dateStr,
  });
  return record ? record.count : 0;
}

/**
 * Checks if a farmer has reached their daily assessment quota.
 * Throws AppError with status 429 and AIErrorCode.DAILY_ASSESSMENT_LIMIT_EXCEEDED if limit reached.
 */
export async function checkDailyAssessmentLimit(
  farmerId: string,
  limit: number = env.AI_DAILY_ASSESSMENTS_PER_USER,
): Promise<void> {
  const currentCount = await getDailyAssessmentCount(farmerId);
  if (currentCount >= limit) {
    throw new AppError(
      429,
      AIErrorCode.DAILY_ASSESSMENT_LIMIT_EXCEEDED,
      `You have reached your daily limit of ${limit} AI quality assessments. Please try again tomorrow.`,
      { currentCount, limit },
    );
  }
}

/**
 * Atomically increments the daily assessment count for a farmer on the current UTC day.
 * Sets a 7-day TTL on the record to prevent unbounded storage growth.
 */
export async function incrementDailyAssessmentCount(
  farmerId: string,
  date: Date = new Date(),
): Promise<number> {
  const dateStr = getUtcDayString(date);
  // Keep records for 7 days then let MongoDB TTL expire them
  const expiresAt = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);

  const updated = await AiUserDailyUsage.findOneAndUpdate(
    {
      farmerId: toFarmerObjectId(farmerId),
      date: dateStr,
    },
    {
      $inc: { count: 1 },
      $set: { lastAssessedAt: date, expiresAt },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return updated?.count ?? 1;
}
