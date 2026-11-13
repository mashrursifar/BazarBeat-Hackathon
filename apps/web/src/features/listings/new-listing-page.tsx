import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Stepper } from "../../components/shared/stepper.js";
import { Step1Crop } from "./components/step-1-crop.js";
import { Step2Photos } from "./components/step-2-photos.js";
import { Step3AiResult } from "./components/step-3-ai-result.js";
import { Step4Price } from "./components/step-4-price.js";
import { Step5QuantityTimer } from "./components/step-5-quantity-timer.js";
import { Step6ReviewPublish } from "./components/step-6-review-publish.js";
import {
  ListingWizardProvider,
  useListingWizard,
} from "./context/listing-wizard-context.js";

function ListingWizardContent(): ReactElement {
  const { t } = useTranslation();
  const { step, setStep } = useListingWizard();

  const steps = [
    { id: 1, key: "crop", label: t("stepper.crop", "Crop") },
    { id: 2, key: "photos", label: t("stepper.photos", "Photos") },
    { id: 3, key: "aiGrade", label: t("stepper.aiGrade", "AI Grade") },
    { id: 4, key: "price", label: t("stepper.price", "Price") },
    { id: 5, key: "quantityTimer", label: t("stepper.quantityTimer", "Quantity & Timer") },
    { id: 6, key: "review", label: t("stepper.review", "Review") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {t("wizard.pageTitle", "Create a new auction listing")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("wizard.pageSubtitle", "List your harvest with AI grading and price guidance in 6 simple steps.")}
        </p>
      </div>

      {/* Stepper navigation */}
      <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 shadow-2xs">
        <Stepper
          steps={steps}
          currentStep={step}
          onStepClick={(targetStep) => {
            // Only allow backward navigation or current step via stepper
            if (targetStep < step) {
              setStep(targetStep);
            }
          }}
        />
      </div>

      {/* Step Components */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7 shadow-xs">
        {step === 1 && <Step1Crop />}
        {step === 2 && <Step2Photos />}
        {step === 3 && <Step3AiResult />}
        {step === 4 && <Step4Price />}
        {step === 5 && <Step5QuantityTimer />}
        {step === 6 && <Step6ReviewPublish />}
      </div>
    </div>
  );
}

export function NewListingPage(): ReactElement {
  return (
    <ListingWizardProvider>
      <main className="p-4 sm:p-8">
        <ListingWizardContent />
      </main>
    </ListingWizardProvider>
  );
}

export default NewListingPage;
