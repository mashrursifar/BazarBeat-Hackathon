import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { ImageUploader } from "../../../components/shared/image-uploader.js";
import { Button } from "../../../components/ui/button.js";
import { useAssessQuality } from "../api/use-listing-wizard-api.js";
import { useListingWizard } from "../context/listing-wizard-context.js";
import { PhotoTipsCard } from "./photo-tips-card.js";

export function Step2Photos(): ReactElement {
  const { t, i18n } = useTranslation();
  const {
    selectedCrop,
    photos,
    setPhotos,
    setStep,
    setAssessmentResult,
    setAssessmentError,
  } = useListingWizard();

  const assessMutation = useAssessQuality();

  if (!selectedCrop) {
    // If user loaded step 2 without selecting crop, send back to step 1
    setStep(1);
    return <div />;
  }

  const localizedCropName =
    i18n.language === "bn" ? selectedCrop.nameBn : selectedCrop.nameEn;

  const handleAssess = async (): Promise<void> => {
    if (photos.length === 0) return;

    try {
      const result = await assessMutation.mutateAsync({
        cropId: selectedCrop.id,
        photos,
      });

      setAssessmentResult(result);
      setAssessmentError(null);
      setStep(3);
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      setAssessmentResult(null);
      setAssessmentError({
        code: errorObj.code || "INTERNAL",
        message: errorObj.message || "Quality assessment could not be completed.",
      });
      setStep(3);
    }
  };

  return (
    <div data-testid="step-2-photos" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t("wizard.step2Title", "Take or upload photos of your harvest")}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {t(
              "wizard.step2Subtitle",
              "Upload 1 to 4 clear photos for AI grading and price guidance.",
            )}
          </p>
        </div>

        {/* Selected crop pill */}
        <div className="self-start sm:self-auto rounded-full bg-stone-100 border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-800 flex items-center gap-1.5">
          <span className="text-muted-foreground">{t("inventory.crop", "Crop")}:</span>
          <span className="text-primary font-bold">{localizedCropName}</span>
        </div>
      </div>

      {/* Photo tips card */}
      <PhotoTipsCard />

      {/* Image Uploader */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
        <h3 className="font-bold text-sm text-foreground mb-3">
          {t("imageUploader.cropPhotos", "Crop photos")} (1–4)
        </h3>
        <ImageUploader
          files={photos}
          onChange={setPhotos}
          maxFiles={4}
          disabled={assessMutation.isPending}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-stone-200">
        <Button
          type="button"
          data-testid="step-2-back"
          onClick={() => setStep(1)}
          disabled={assessMutation.isPending}
          className="w-full sm:w-auto bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300"
        >
          ← {t("wizard.back", "Change crop")}
        </Button>

        <Button
          type="button"
          data-testid="step-2-assess"
          disabled={photos.length === 0 || assessMutation.isPending}
          onClick={() => void handleAssess()}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {assessMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("wizard.assessing", "Analyzing quality with AI…")}
            </span>
          ) : (
            <span>{t("wizard.assessQuality", "Assess quality with AI")} →</span>
          )}
        </Button>
      </div>
    </div>
  );
}
