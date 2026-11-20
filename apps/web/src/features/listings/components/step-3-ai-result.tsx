import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";

import { GradeBadge } from "../../../components/shared/grade-badge.js";
import { Button } from "../../../components/ui/button.js";
import { renderGradingReason } from "../../ai-reasons/ai-reason-text.js";
import { useListingWizard } from "../context/listing-wizard-context.js";

export function Step3AiResult(): ReactElement {
  const { t, i18n } = useTranslation();
  const { selectedCrop, assessmentResult, assessmentError, retakePhotos, setStep } =
    useListingWizard();

  const [showTooltip, setShowTooltip] = useState(false);

  const localizedCropName = selectedCrop
    ? i18n.language === "bn"
      ? selectedCrop.nameBn
      : selectedCrop.nameEn
    : "";

  // 1. Error state handling: CROP_MISMATCH, GRADE_UNAVAILABLE, DAILY_ASSESSMENT_LIMIT_EXCEEDED, or generic
  if (assessmentError) {
    const isCropMismatch = assessmentError.code === "CROP_MISMATCH";
    const isGradeUnavailable = assessmentError.code === "GRADE_UNAVAILABLE";
    const isDailyLimitExceeded =
      assessmentError.code === "DAILY_ASSESSMENT_LIMIT_EXCEEDED" ||
      assessmentError.code === "RATE_LIMITED";

    return (
      <div data-testid="step-3-ai-result" className="space-y-6">
        {isCropMismatch && (
          <div
            data-testid="ai-error-crop-mismatch"
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6 text-red-950 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2.5 text-red-700">
              <svg
                className="h-6 w-6 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-base sm:text-lg font-bold">
                {t("wizard.cropMismatchTitle", "Crop mismatch detected")}
              </h3>
            </div>

            <p className="text-sm leading-relaxed text-red-900">
              {t(
                "wizard.cropMismatchDesc",
                "The uploaded photo does not appear to match {{cropName}}. Please retake the photo showing the correct crop, or choose a different crop.",
                { cropName: localizedCropName },
              )}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="button"
                data-testid="retake-photos-btn"
                onClick={retakePhotos}
                className="w-full sm:w-auto bg-red-700 text-white hover:bg-red-800"
              >
                {t("wizard.retakePhotos", "Retake photos")}
              </Button>
              <Button
                type="button"
                data-testid="change-crop-btn"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto bg-white text-stone-700 hover:bg-stone-100 border border-stone-300"
              >
                {t("wizard.changeCrop", "Change crop")}
              </Button>
            </div>
          </div>
        )}

        {isGradeUnavailable && (
          <div
            data-testid="ai-error-grade-unavailable"
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-5 sm:p-6 text-amber-950 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2.5 text-amber-800">
              <svg
                className="h-6 w-6 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-base sm:text-lg font-bold">
                {t("wizard.gradeUnavailableTitle", "Quality grade unavailable")}
              </h3>
            </div>

            <p className="text-sm leading-relaxed text-amber-900">
              {t(
                "wizard.gradeUnavailableDesc",
                "Our AI model could not grade this photo with sufficient confidence (confidence below 55%). This usually happens when lighting is poor, the background is cluttered, or the crop is partially obscured.",
              )}
            </p>

            <div className="rounded-lg bg-white/80 p-3.5 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">{t("wizard.howToFix", "How to take a gradable photo:")}</p>
              <ul className="list-disc list-inside space-y-0.5 text-stone-700">
                <li>{t("photoTips.lightTitle", "Use natural daylight, avoid heavy shadows")}</li>
                <li>
                  {t("photoTips.backgroundTitle", "Place crop on a clean, plain mat or floor")}
                </li>
                <li>{t("photoTips.multiTitle", "Show at least 3 pieces together")}</li>
              </ul>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                data-testid="retake-photos-btn"
                onClick={retakePhotos}
                className="w-full sm:w-auto bg-amber-700 text-white hover:bg-amber-800"
              >
                {t("wizard.retakePhotos", "Retake photos")}
              </Button>
            </div>
          </div>
        )}

        {isDailyLimitExceeded && (
          <div
            data-testid="ai-error-daily-limit"
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-5 sm:p-6 text-amber-950 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2.5 text-amber-800">
              <svg
                className="h-6 w-6 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-base sm:text-lg font-bold">
                {t("wizard.dailyLimitExceededTitle", "Daily assessment limit reached")}
              </h3>
            </div>

            <p className="text-sm leading-relaxed text-amber-900">
              {t(
                "wizard.dailyLimitExceededDesc",
                "You have reached your daily limit of AI quality assessments ({{limit}} per day). Please try again tomorrow or contact support.",
                { limit: 20 },
              )}
            </p>

            <div className="pt-2">
              <Button
                type="button"
                data-testid="daily-limit-back-btn"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto bg-amber-700 text-white hover:bg-amber-800"
              >
                ← {t("wizard.back", "Change crop")}
              </Button>
            </div>
          </div>
        )}

        {!isCropMismatch && !isGradeUnavailable && !isDailyLimitExceeded && (
          <div
            data-testid="ai-error-generic"
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6 text-red-950 space-y-4 shadow-sm"
          >
            <h3 className="text-base sm:text-lg font-bold text-red-800">
              {t("wizard.assessmentFailed", "Assessment could not be completed")}
            </h3>
            <p className="text-sm text-red-900">{assessmentError.message}</p>
            <Button
              type="button"
              data-testid="retake-photos-btn"
              onClick={retakePhotos}
              className="w-full sm:w-auto bg-red-700 text-white hover:bg-red-800"
            >
              {t("wizard.retakePhotos", "Retake photos")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // If no result and no error, fallback to step 2
  if (!assessmentResult) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          {t("wizard.noAssessment", "No assessment found. Please upload photos first.")}
        </p>
        <Button type="button" onClick={() => setStep(2)} className="mt-4 w-auto inline-flex">
          {t("wizard.backToPhotos", "Upload photos")}
        </Button>
      </div>
    );
  }

  // 2. Successful Assessment Result view
  const confidenceBandLabel =
    assessmentResult.confidenceBand === "HIGH"
      ? t("wizard.confidenceHigh", "High confidence")
      : assessmentResult.confidenceBand === "MEDIUM"
        ? t("wizard.confidenceMedium", "Medium confidence")
        : t("wizard.confidenceLow", "Low confidence");

  return (
    <div data-testid="step-3-ai-result" className="space-y-6">
      {/* Degraded mode notice */}
      {assessmentResult.degraded && (
        <div
          data-testid="degraded-notice"
          role="status"
          className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <span className="text-base">ℹ️</span>
          <span>
            {t(
              "wizard.degradedNotice",
              "AI grading service is operating in offline estimate mode. Grade calculated from baseline criteria.",
            )}
          </span>
        </div>
      )}

      {/* Main Grade Card */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {t("wizard.step3Title", "Quality Assessment Result")}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{localizedCropName}</p>
          </div>

          {/* AI-assessed badge + tooltip */}
          <div className="relative">
            <button
              type="button"
              data-testid="ai-assessed-badge"
              onClick={() => setShowTooltip((prev) => !prev)}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              aria-label={
                assessmentResult.provider?.toLowerCase() === "gemini" && !assessmentResult.degraded
                  ? t("wizard.aiAssessedTooltipGemini")
                  : t("wizard.aiAssessedTooltip", "AI estimate explanation")
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 transition cursor-pointer"
            >
              <span>
                🤖{" "}
                {assessmentResult.provider?.toLowerCase() === "gemini" && !assessmentResult.degraded
                  ? t("wizard.aiAssessedGemini")
                  : t("wizard.aiAssessed", "AI-assessed")}
              </span>
              <svg
                className="h-3.5 w-3.5 text-stone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>

            {/* Tooltip popover */}
            {showTooltip && (
              <div
                data-testid="ai-assessed-tooltip"
                role="tooltip"
                className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg bg-stone-900 p-3 text-xs text-stone-100 shadow-lg"
              >
                {assessmentResult.provider?.toLowerCase() === "gemini" && !assessmentResult.degraded
                  ? t(
                      "wizard.aiAssessedTooltipGemini",
                      "This grade was evaluated by Google Gemini multimodal AI based on visual quality features. It serves as an objective market benchmark.",
                    )
                  : t(
                      "wizard.aiAssessedTooltip",
                      "This grade is generated by our AI model based on visual quality features. It serves as an objective market benchmark.",
                    )}
              </div>
            )}
          </div>
        </div>

        {/* Grade Badge & Confidence display */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-stone-50 p-4 border border-stone-100">
          <div className="flex items-center gap-4">
            <GradeBadge grade={assessmentResult.grade} size="lg" />
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                {t("wizard.confidenceLevel", "Confidence")}
              </p>
              <p
                data-testid="ai-confidence-band"
                className="text-sm font-bold text-foreground mt-0.5"
              >
                {confidenceBandLabel} ({Math.round(assessmentResult.confidence * 100)}%)
              </p>
            </div>
          </div>

          {/* Class probabilities distribution */}
          {assessmentResult.classProbabilities && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground border-t sm:border-t-0 sm:border-l border-stone-200 pt-2 sm:pt-0 sm:pl-4">
              <span>A: {Math.round(assessmentResult.classProbabilities.A * 100)}%</span>
              <span>B: {Math.round(assessmentResult.classProbabilities.B * 100)}%</span>
              <span>C: {Math.round(assessmentResult.classProbabilities.C * 100)}%</span>
            </div>
          )}
        </div>

        {/* Reasons list */}
        <div className="space-y-2">
          <h3 className="text-xs sm:text-sm font-bold text-foreground">
            {t("wizard.reasons", "Quality Observations & Reasons")}
          </h3>
          <ul data-testid="ai-reasons" className="space-y-1.5 text-xs sm:text-sm text-stone-700">
            {assessmentResult.qualityNotes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                <span>{renderGradingReason(note, t)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-stone-200">
        <Button
          type="button"
          data-testid="retake-photos-btn"
          onClick={retakePhotos}
          className="w-full sm:w-auto bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300"
        >
          📷 {t("wizard.retakePhotos", "Retake photos")}
        </Button>

        <Button
          type="button"
          data-testid="step-3-continue"
          onClick={() => setStep(4)}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {t("wizard.continueToPrice", "Continue to Price Guidance")} →
        </Button>
      </div>
    </div>
  );
}
