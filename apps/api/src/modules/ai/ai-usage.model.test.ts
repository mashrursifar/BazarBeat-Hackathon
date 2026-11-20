import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIErrorCode } from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import {
  AiUserDailyUsage,
  checkDailyAssessmentLimit,
  getDailyAssessmentCount,
  getUtcDayString,
  incrementDailyAssessmentCount,
} from "./ai-usage.model.js";

describe("AI Daily Assessment Usage & Quotas (Task G6)", () => {
  const fakeFarmerId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUtcDayString", () => {
    it("formats dates in UTC YYYY-MM-DD", () => {
      const date = new Date("2026-11-20T23:30:00.000Z");
      expect(getUtcDayString(date)).toBe("2026-11-20");
    });
  });

  describe("getDailyAssessmentCount", () => {
    it("returns 0 when no usage record exists", async () => {
      vi.spyOn(AiUserDailyUsage, "findOne").mockResolvedValue(null as never);
      const count = await getDailyAssessmentCount(fakeFarmerId);
      expect(count).toBe(0);
    });

    it("returns current usage count from record", async () => {
      vi.spyOn(AiUserDailyUsage, "findOne").mockResolvedValue({
        farmerId: fakeFarmerId,
        date: "2026-11-20",
        count: 7,
      } as never);
      const count = await getDailyAssessmentCount(fakeFarmerId);
      expect(count).toBe(7);
    });
  });

  describe("checkDailyAssessmentLimit", () => {
    it("passes without throwing when usage is below limit", async () => {
      vi.spyOn(AiUserDailyUsage, "findOne").mockResolvedValue({ count: 5 } as never);
      await expect(checkDailyAssessmentLimit(fakeFarmerId, 20)).resolves.not.toThrow();
    });

    it("throws 429 DAILY_ASSESSMENT_LIMIT_EXCEEDED when usage equals limit", async () => {
      vi.spyOn(AiUserDailyUsage, "findOne").mockResolvedValue({ count: 20 } as never);

      try {
        await checkDailyAssessmentLimit(fakeFarmerId, 20);
        expect.fail("Expected checkDailyAssessmentLimit to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(429);
        expect(appErr.code).toBe(AIErrorCode.DAILY_ASSESSMENT_LIMIT_EXCEEDED);
        expect(appErr.message).toContain("daily limit of 20 AI quality assessments");
      }
    });

    it("throws 429 when usage exceeds limit", async () => {
      vi.spyOn(AiUserDailyUsage, "findOne").mockResolvedValue({ count: 25 } as never);

      await expect(checkDailyAssessmentLimit(fakeFarmerId, 20)).rejects.toMatchObject({
        statusCode: 429,
        code: AIErrorCode.DAILY_ASSESSMENT_LIMIT_EXCEEDED,
      });
    });
  });

  describe("incrementDailyAssessmentCount", () => {
    it("atomically increments usage and sets 7-day TTL", async () => {
      const mockFindOneAndUpdate = vi.spyOn(AiUserDailyUsage, "findOneAndUpdate").mockResolvedValue({
        farmerId: fakeFarmerId,
        date: "2026-11-20",
        count: 8,
      } as never);

      const testDate = new Date("2026-11-20T12:00:00.000Z");
      const newCount = await incrementDailyAssessmentCount(fakeFarmerId, testDate);

      expect(newCount).toBe(8);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-11-20" }),
        expect.objectContaining({
          $inc: { count: 1 },
          $set: expect.objectContaining({
            lastAssessedAt: testDate,
            expiresAt: new Date(testDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          }),
        }),
        expect.objectContaining({ upsert: true, new: true }),
      );
    });
  });
});
