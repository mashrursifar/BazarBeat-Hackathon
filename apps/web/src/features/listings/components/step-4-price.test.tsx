import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { AssessmentResult, CropResponse, PriceGuidance } from "@bazarbeat/shared";
import "../../../lib/i18n.js";
import { ListingWizardProvider } from "../context/listing-wizard-context.js";
import { Step4Price } from "./step-4-price.js";

const mockCrop: CropResponse = {
  id: "0123456789abcdef01234567",
  slug: "bitter-gourd",
  nameEn: "Bitter Gourd",
  nameBn: "করলা",
  unit: "KG",
  minLotKg: 10,
  maxLotKg: 1000,
  shelfLifeHours: 120,
  gradeGuide: { A: "Firm, rich green", B: "Minor blemishes", C: "Ripe and usable" },
  minIncrementPerKg: 100,
  imageUrl: "/images/crops/bitter-gourd.svg",
};

const mockAssessment: AssessmentResult = {
  grade: "A",
  confidence: 0.92,
  confidenceBand: "HIGH",
  classProbabilities: { A: 0.8, B: 0.15, C: 0.05 },
  qualityNotes: ["Firm texture"],
  cropMatch: true,
  modelVersion: "mock-1.0",
  provider: "mock",
  degraded: false,
  assessedAt: new Date().toISOString(),
  assessmentToken: "token-abc-123",
};

const mockGuidance: PriceGuidance = {
  lowPerKg: 4000, // ৳40.00
  expectedPerKg: 4500, // ৳45.00
  highPerKg: 5000, // ৳50.00
  trend: "UP",
  confidence: 0.9,
  explanation: ["Market trend is favorable"],
  modelVersion: "mock-price-1.0",
  provider: "mock",
  degraded: false,
  generatedAt: new Date().toISOString(),
  suggestedFloorPerKg: 4200, // ৳42.00
};

function renderStep4(options: {
  guidance?: PriceGuidance | null;
  initialFloorPricePerKg?: number;
}): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ListingWizardProvider
        initialStep={4}
        initialCrop={mockCrop}
        initialAssessment={mockAssessment}
        initialPriceGuidance={options.guidance !== undefined ? options.guidance : mockGuidance}
        initialFloorPricePerKg={options.initialFloorPricePerKg ?? 0}
        skipStorageRestoration
      >
        <Step4Price />
      </ListingWizardProvider>
    </QueryClientProvider>,
  );
}

describe("Step4Price component", () => {
  it("renders AI price range visual, local market estimate card, and reassurance text", () => {
    renderStep4({});

    // Range visual
    expect(screen.getByTestId("price-range-visual")).toBeInTheDocument();
    expect(screen.getByText("৳40.00")).toBeInTheDocument(); // Low
    expect(screen.getByText("৳45.00")).toBeInTheDocument(); // Expected
    expect(screen.getByText("৳50.00")).toBeInTheDocument(); // High
    expect(screen.getByTestId("trend-badge")).toHaveTextContent("Prices trending up");

    // Local market estimate card
    const localCard = screen.getByTestId("local-market-card");
    expect(localCard).toBeInTheDocument();
    expect(localCard).toHaveTextContent("Local market estimate");
    expect(localCard).toHaveTextContent("৳45.00 / kg");

    // Reassurance banner
    const reassurance = screen.getByTestId("reassurance-banner");
    expect(reassurance).toBeInTheDocument();
    expect(reassurance).toHaveTextContent(
      "If no bid reaches your floor, you can still sell in your local market.",
    );
  });

  it("auto-fills floor price when 'Use suggested floor' button is clicked", () => {
    renderStep4({ initialFloorPricePerKg: 0 });

    const input = screen.getByTestId("floor-price-input") as HTMLInputElement;
    const useFloorBtn = screen.getByTestId("use-suggested-floor-btn");
    expect(useFloorBtn).toHaveTextContent("Use suggested floor");
    expect(useFloorBtn).toHaveTextContent("৳42.00/kg");

    fireEvent.click(useFloorBtn);
    expect(input.value).toBe("42");
    expect(screen.getByTestId("floor-status-ok")).toBeInTheDocument();
  });

  it("shows warning when floor price is below the market range but does NOT block continuing", () => {
    renderStep4({ initialFloorPricePerKg: 3500 }); // ৳35 < ৳40 low

    const belowMarketWarning = screen.getByTestId("floor-warning-below-market");
    expect(belowMarketWarning).toBeInTheDocument();
    expect(belowMarketWarning).toHaveTextContent(
      "Warning: Your floor price is below the AI market range",
    );

    // Floor warnings warn but do not block publishing/continuing
    const continueBtn = screen.getByTestId("step-4-continue");
    expect(continueBtn).toBeEnabled();
  });

  it("shows warning when floor price is > 30% above high market price but does NOT block continuing", () => {
    renderStep4({ initialFloorPricePerKg: 7000 }); // ৳70 > ৳50 * 1.3 (৳65)

    const overpricedWarning = screen.getByTestId("floor-warning-overpriced");
    expect(overpricedWarning).toBeInTheDocument();
    expect(overpricedWarning).toHaveTextContent(
      "Warning: Your floor price is more than 30% above the high market price",
    );

    // Floor warnings warn but do not block publishing/continuing
    const continueBtn = screen.getByTestId("step-4-continue");
    expect(continueBtn).toBeEnabled();
  });

  it("shows ok check when floor price is within recommended range", () => {
    renderStep4({ initialFloorPricePerKg: 4600 }); // ৳46 is within ৳40 - ৳65

    expect(screen.getByTestId("floor-status-ok")).toBeInTheDocument();
    expect(screen.queryByTestId("floor-warning-below-market")).not.toBeInTheDocument();
    expect(screen.queryByTestId("floor-warning-overpriced")).not.toBeInTheDocument();

    const continueBtn = screen.getByTestId("step-4-continue");
    expect(continueBtn).toBeEnabled();
  });

  it("disables continue button if floor price is 0 or empty", () => {
    renderStep4({ initialFloorPricePerKg: 0 });

    const input = screen.getByTestId("floor-price-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    const continueBtn = screen.getByTestId("step-4-continue");
    expect(continueBtn).toBeDisabled();
  });
});
