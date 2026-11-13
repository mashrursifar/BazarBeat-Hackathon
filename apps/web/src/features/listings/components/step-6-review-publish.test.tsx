import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssessmentResult, CropResponse, FarmerListing, FarmerListingResponse } from "@bazarbeat/shared";
import "../../../lib/i18n.js";
import { ApiError } from "../api/listing-api.js";
import { ListingWizardProvider } from "../context/listing-wizard-context.js";
import { Step6ReviewPublish } from "./step-6-review-publish.js";

const useCreateListingMock = vi.hoisted(() => vi.fn());

vi.mock("../api/use-listing-wizard-api.js", () => ({
  useCreateListing: useCreateListingMock,
}));

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
  confidence: 0.95,
  confidenceBand: "HIGH",
  classProbabilities: { A: 0.9, B: 0.08, C: 0.02 },
  qualityNotes: ["Firm texture"],
  cropMatch: true,
  modelVersion: "mock-1.0",
  provider: "mock",
  degraded: false,
  assessedAt: new Date().toISOString(),
  assessmentToken: "token-secret-123",
};

const mockCreatedListing: FarmerListing = {
  id: "67b8d0001111222233334444",
  cropId: mockCrop.id,
  quantityKg: 50,
  images: [{ url: "/images/crops/bitter-gourd.svg", width: 800, height: 600 }],
  aiAssessment: mockAssessment,
  aiPriceGuidance: {
    lowPerKg: 4000,
    expectedPerKg: 4500,
    highPerKg: 5000,
    trend: "UP",
    confidence: 0.9,
    explanation: ["Market trend is favorable"],
    modelVersion: "mock-price-1.0",
    provider: "mock",
    degraded: false,
    generatedAt: new Date().toISOString(),
    suggestedFloorPerKg: 4200,
  },
  floorPricePerKg: 4500,
  minIncrementPerKg: 100,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  originalEndsAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  extensionCount: 0,
  status: "ACTIVE",
  bidCount: 0,
  pickupNote: "Storage shed #2",
  createdAt: new Date().toISOString(),
};

function renderStep6(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ListingWizardProvider
          initialStep={6}
          initialCrop={mockCrop}
          initialAssessment={mockAssessment}
          initialFloorPricePerKg={4500} // ৳45.00
          initialQuantityKg={50} // 50 kg
          initialDurationMinutes={360} // 6 hours
          initialPickupNote="Storage shed #2"
          skipStorageRestoration
        >
          <Step6ReviewPublish />
        </ListingWizardProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("Step6ReviewPublish component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders listing summary card before publish", () => {
    useCreateListingMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    renderStep6();

    const summaryCard = screen.getByTestId("review-summary-card");
    expect(summaryCard).toBeInTheDocument();
    expect(summaryCard).toHaveTextContent("Bitter Gourd");
    expect(summaryCard).toHaveTextContent("A"); // GradeBadge
    expect(summaryCard).toHaveTextContent("50 kg"); // Quantity
    expect(summaryCard).toHaveTextContent("৳45.00"); // Floor price
    expect(summaryCard).toHaveTextContent("৳2250.00"); // Total floor value: 45 * 50 = 2250
    expect(summaryCard).toHaveTextContent("6 hours");
    expect(summaryCard).toHaveTextContent("Storage shed #2");

    // Publish button is present and enabled
    const publishBtn = screen.getByTestId("publish-listing-btn");
    expect(publishBtn).toBeInTheDocument();
    expect(publishBtn).toBeEnabled();
    expect(publishBtn).toHaveTextContent("Publish Listing");

    // Strict check: No success screen shown before server confirmation
    expect(screen.queryByTestId("publish-success-screen")).not.toBeInTheDocument();
  });

  it("disables publish button while pending", () => {
    useCreateListingMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });

    renderStep6();

    const publishBtn = screen.getByTestId("publish-listing-btn");
    expect(publishBtn).toBeDisabled();
    expect(publishBtn).toHaveTextContent("Publishing listing…");

    // Strict check: No success screen shown while pending
    expect(screen.queryByTestId("publish-success-screen")).not.toBeInTheDocument();
  });

  it("maps INSUFFICIENT_STOCK server error to friendly text and does not show success", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiError(409, "INSUFFICIENT_STOCK", "Stock exhausted"),
    );

    useCreateListingMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderStep6();

    const publishBtn = screen.getByTestId("publish-listing-btn");
    fireEvent.click(publishBtn);

    const errorBanner = await screen.findByTestId("publish-error-banner");
    expect(errorBanner).toBeInTheDocument();
    expect(errorBanner).toHaveTextContent(
      "You do not have enough available stock for this listing.",
    );

    // Strict check: No success screen shown on error
    expect(screen.queryByTestId("publish-success-screen")).not.toBeInTheDocument();
  });

  it("maps CONFLICT server error when token expired or reused", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiError(409, "CONFLICT", "Token consumed"),
    );

    useCreateListingMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderStep6();

    const publishBtn = screen.getByTestId("publish-listing-btn");
    fireEvent.click(publishBtn);

    const errorBanner = await screen.findByTestId("publish-error-banner");
    expect(errorBanner).toBeInTheDocument();
    expect(errorBanner).toHaveTextContent(
      "This assessment token has already been used or expired. Please retake photos.",
    );

    // Strict check: No success screen shown on error
    expect(screen.queryByTestId("publish-success-screen")).not.toBeInTheDocument();
  });

  it("shows success screen ONLY AFTER server confirms creation", async () => {
    const response: FarmerListingResponse = {
      data: mockCreatedListing,
      meta: { serverTime: new Date().toISOString() },
    };
    const mutateAsync = vi.fn().mockResolvedValue(response);

    useCreateListingMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderStep6();

    // Verify BEFORE click: No success screen
    expect(screen.queryByTestId("publish-success-screen")).not.toBeInTheDocument();

    const publishBtn = screen.getByTestId("publish-listing-btn");
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        cropId: mockCrop.id,
        assessmentToken: mockAssessment.assessmentToken,
        quantityKg: 50,
        floorPricePerKg: 4500,
        durationMinutes: 360,
        pickupNote: "Storage shed #2",
      });
    });

    // Verify AFTER server confirms: Success screen is shown!
    const successScreen = await screen.findByTestId("publish-success-screen");
    expect(successScreen).toBeInTheDocument();
    expect(successScreen).toHaveTextContent("Listing published successfully!");
    expect(successScreen).toHaveTextContent("ACTIVE");
    expect(successScreen).toHaveTextContent("50 kg");
    expect(screen.getByTestId("success-crop-bidding-link")).toHaveAttribute(
      "href",
      "/farmer/crop-bidding",
    );
    expect(screen.getByTestId("success-my-listings-link")).toHaveAttribute(
      "href",
      "/farmer/products",
    );
  });
});
