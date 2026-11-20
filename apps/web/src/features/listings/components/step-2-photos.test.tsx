import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CropResponse } from "@bazarbeat/shared";
import { i18n } from "../../../lib/i18n.js";
import { ListingWizardProvider } from "../context/listing-wizard-context.js";
import { Step2Photos } from "./step-2-photos.js";

const mockCrop: CropResponse = {
  id: "0123456789abcdef01234567",
  slug: "potato",
  nameEn: "Potato",
  nameBn: "আলু",
  unit: "KG",
  minLotKg: 10,
  maxLotKg: 1000,
  shelfLifeHours: 720,
  gradeGuide: { A: "Firm, clean", B: "Minor blemishes", C: "Usable" },
  minIncrementPerKg: 100,
  imageUrl: "/images/crops/potato.svg",
};

function renderStep2(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ListingWizardProvider initialStep={2} initialCrop={mockCrop}>
        <Step2Photos />
      </ListingWizardProvider>
    </QueryClientProvider>,
  );
}

describe("Step2Photos component (Task G6)", () => {
  it("renders farmer-facing AI transparency notice in English", async () => {
    await i18n.changeLanguage("en");
    renderStep2();

    const notice = screen.getByTestId("ai-photo-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      "Photos are analysed by an AI service for quality grading and price guidance. No personal information is shared.",
    );
  });

  it("renders farmer-facing AI transparency notice in Bangla", async () => {
    await i18n.changeLanguage("bn");
    renderStep2();

    const notice = screen.getByTestId("ai-photo-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      "মান নির্ধারণ ও দামের পরামর্শের জন্য ছবিগুলো এআই (AI) সার্ভিসের মাধ্যমে বিশ্লেষণ করা হয়। কোনো ব্যক্তিগত তথ্য শেয়ার করা হয় না।",
    );

    // Reset language back to en
    await i18n.changeLanguage("en");
  });
});
