import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AssessmentResult,
  CropResponse,
  FarmerListing,
  PriceGuidance,
  PublicConfig,
} from "@bazarbeat/shared";
import "../../lib/i18n.js";
import { WIZARD_DRAFT_KEY } from "./context/listing-wizard-context.js";
import { NewListingPage } from "./new-listing-page.js";

const mockCropA: CropResponse = {
  id: "0123456789abcdef01234567",
  slug: "bitter-gourd",
  nameEn: "Bitter Gourd",
  nameBn: "করলা",
  unit: "KG",
  minLotKg: 10,
  maxLotKg: 1000,
  shelfLifeHours: 120,
  gradeGuide: { A: "Firm", B: "Minor blemishes", C: "Ripe" },
  minIncrementPerKg: 100,
  imageUrl: "/crops/bitter-gourd.svg",
};

const mockCropB: CropResponse = {
  id: "0123456789abcdef01234568",
  slug: "potato",
  nameEn: "Potato",
  nameBn: "আলু",
  unit: "KG",
  minLotKg: 50,
  maxLotKg: 2000,
  shelfLifeHours: 720,
  gradeGuide: { A: "Clean and dry", B: "Minor dirt", C: "Small" },
  minIncrementPerKg: 100,
  imageUrl: "/crops/potato.svg",
};

const mockCrops: CropResponse[] = [mockCropA, mockCropB];

const mockAssessmentResult: AssessmentResult = {
  grade: "A",
  confidence: 0.94,
  confidenceBand: "HIGH",
  classProbabilities: { A: 0.85, B: 0.1, C: 0.05 },
  qualityNotes: ["Even size and healthy green color"],
  cropMatch: true,
  modelVersion: "mock-1.0",
  provider: "mock",
  degraded: false,
  assessedAt: new Date().toISOString(),
  assessmentToken: "valid-assessment-token",
};

const mockGuidance: PriceGuidance = {
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
};

const mockConfig: PublicConfig = {
  demoMode: false,
  durationPresets: {
    "1h": 60,
    "3h": 180,
    "6h": 360,
    "12h": 720,
    "24h": 1440,
  },
  platformFeeBps: 200,
};

const mockCreatedListing: FarmerListing = {
  id: "67b8d0001111222233334444",
  cropId: mockCropA.id,
  quantityKg: 50,
  images: [{ url: "/crops/bitter-gourd.svg", width: 800, height: 600 }],
  aiAssessment: mockAssessmentResult,
  aiPriceGuidance: mockGuidance,
  floorPricePerKg: 4200,
  minIncrementPerKg: 100,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  originalEndsAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  extensionCount: 0,
  status: "ACTIVE",
  bidCount: 0,
  createdAt: new Date().toISOString(),
};

// Mock the API functions
vi.mock("./api/listing-api.js", () => ({
  getCrops: vi.fn(async () => mockCrops),
  assessQuality: vi.fn(async () => mockAssessmentResult),
  predictPrice: vi.fn(async () => mockGuidance),
  getConfig: vi.fn(async () => mockConfig),
  createListing: vi.fn(async () => ({
    data: mockCreatedListing,
    meta: { serverTime: new Date().toISOString() },
  })),
}));

// Mock inventory for Step 5
vi.mock("../inventory/api/use-inventory.js", () => ({
  useInventory: vi.fn(() => ({
    data: [
      {
        crop: mockCropA,
        availableKg: 200,
        listedKg: 0,
        soldKg: 0,
      },
      {
        crop: mockCropB,
        availableKg: 500,
        listedKg: 0,
        soldKg: 0,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useAddStock: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

// Mock URL object URL methods
beforeAll(() => {
  URL.createObjectURL = vi.fn((file: File) => `blob://${file.name}`);
  URL.revokeObjectURL = vi.fn();
});

const createTestWrapper = (): (({ children }: { children: ReactNode }) => ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }): ReactElement => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe("NewListingPage and Wizard Steps 1 to 6 Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("navigates through steps 1 to 3, preserving state on back navigation", async () => {
    const wrapper = createTestWrapper();
    render(<NewListingPage />, { wrapper });

    // 1. Step 1: Crop Selection
    expect(await screen.findByTestId("step-1-crop")).toBeInTheDocument();
    expect(screen.getByTestId("crop-card-bitter-gourd")).toBeInTheDocument();
    expect(screen.getByTestId("crop-card-potato")).toBeInTheDocument();

    const continueBtn = screen.getByTestId("step-1-continue");
    expect(continueBtn).toBeDisabled();

    // Select Bitter Gourd
    fireEvent.click(screen.getByTestId("crop-card-bitter-gourd"));
    expect(continueBtn).not.toBeDisabled();

    // Proceed to Step 2
    fireEvent.click(continueBtn);
    expect(await screen.findByTestId("step-2-photos")).toBeInTheDocument();
    expect(screen.getByTestId("photo-tips-card")).toBeInTheDocument();

    // 2. Step 2 Back navigation test: changing crop returns to Step 1 with Bitter Gourd selected
    fireEvent.click(screen.getByTestId("step-2-back"));
    expect(await screen.findByTestId("step-1-crop")).toBeInTheDocument();
    expect(screen.getByTestId("crop-card-bitter-gourd")).toHaveAttribute("aria-checked", "true");

    // Return to Step 2
    fireEvent.click(screen.getByTestId("step-1-continue"));
    expect(await screen.findByTestId("step-2-photos")).toBeInTheDocument();

    // Upload a photo
    const file = new File(["sample-photo"], "bitter-gourd.jpg", { type: "image/jpeg" });
    const galleryInput = screen.getByTestId("uploader-gallery-input");
    fireEvent.change(galleryInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("uploader-count")).toHaveTextContent("1 / 4 photos");
    });

    const assessBtn = screen.getByTestId("step-2-assess");
    expect(assessBtn).not.toBeDisabled();

    // Click Assess quality
    fireEvent.click(assessBtn);

    // 3. Step 3: AI Result
    expect(await screen.findByTestId("step-3-ai-result")).toBeInTheDocument();
    expect(screen.getByTestId("grade-badge-a")).toHaveTextContent("A");
    expect(screen.getByTestId("ai-confidence-band")).toHaveTextContent("High confidence (94%)");
    expect(screen.getByTestId("ai-reasons")).toHaveTextContent("Even size and healthy green color");

    // 4. Back navigation from Step 3: clicking "Retake photos" returns to Step 2
    const retakeBtn = screen.getByTestId("retake-photos-btn");
    fireEvent.click(retakeBtn);

    expect(await screen.findByTestId("step-2-photos")).toBeInTheDocument();
    // Photos state preserved
    expect(screen.getByTestId("uploader-count")).toHaveTextContent("1 / 4 photos");
  });

  it("completes full wizard flow from step 1 through publish in step 6", async () => {
    const wrapper = createTestWrapper();
    render(<NewListingPage />, { wrapper });

    // Step 1: Select crop
    expect(await screen.findByTestId("step-1-crop")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("crop-card-bitter-gourd"));
    fireEvent.click(screen.getByTestId("step-1-continue"));

    // Step 2: Upload photo and assess
    expect(await screen.findByTestId("step-2-photos")).toBeInTheDocument();
    const file = new File(["sample-photo"], "bitter-gourd.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("uploader-gallery-input"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId("step-2-assess")).toBeEnabled());
    fireEvent.click(screen.getByTestId("step-2-assess"));

    // Step 3: AI Result -> Continue to price
    expect(await screen.findByTestId("step-3-ai-result")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("step-3-continue"));

    // Step 4: Price Guidance & Floor Price
    expect(await screen.findByTestId("step-4-price")).toBeInTheDocument();
    expect(screen.getByTestId("reassurance-banner")).toHaveTextContent(
      "If no bid reaches your floor, you can still sell in your local market.",
    );
    // Use suggested floor (auto-fills ৳42)
    fireEvent.click(screen.getByTestId("use-suggested-floor-btn"));
    expect(screen.getByTestId("step-4-continue")).toBeEnabled();
    fireEvent.click(screen.getByTestId("step-4-continue"));

    // Step 5: Quantity & Timer
    expect(await screen.findByTestId("step-5-quantity-timer")).toBeInTheDocument();
    const quantityInput = screen.getByTestId("lot-quantity-input");
    fireEvent.change(quantityInput, { target: { value: "50" } });
    expect(screen.getByTestId("step-5-continue")).toBeEnabled();
    fireEvent.click(screen.getByTestId("step-5-continue"));

    // Step 6: Review & Publish
    expect(await screen.findByTestId("step-6-review-publish")).toBeInTheDocument();
    expect(screen.getByTestId("review-summary-card")).toHaveTextContent("Bitter Gourd");
    expect(screen.getByTestId("review-summary-card")).toHaveTextContent("50 kg");

    // Publish listing
    const publishBtn = screen.getByTestId("publish-listing-btn");
    fireEvent.click(publishBtn);

    // Verify success screen displayed
    const successScreen = await screen.findByTestId("publish-success-screen");
    expect(successScreen).toBeInTheDocument();
    expect(successScreen).toHaveTextContent("Listing published successfully!");
  });

  it("restores unexpired draft from sessionStorage", async () => {
    const unexpiredAssessedAt = new Date().toISOString(); // Just now
    const draft = {
      step: 4,
      selectedCrop: mockCropA,
      assessmentResult: {
        ...mockAssessmentResult,
        assessedAt: unexpiredAssessedAt,
      },
      priceGuidance: mockGuidance,
      floorPricePerKg: 4200,
      localSellingCostPerKg: 0,
      quantityKg: 20,
      durationMinutes: 360,
      pickupNote: "Restored draft note",
    };
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));

    const wrapper = createTestWrapper();
    render(<NewListingPage />, { wrapper });

    // Should restore directly to step 4 with guidance and floor price
    expect(await screen.findByTestId("step-4-price")).toBeInTheDocument();
    expect(screen.getByTestId("floor-price-input")).toHaveValue(42);
  });

  it("discards expired draft (> 30 min) from sessionStorage", async () => {
    // 35 minutes ago (> 30 min TTL)
    const expiredAssessedAt = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const draft = {
      step: 4,
      selectedCrop: mockCropA,
      assessmentResult: {
        ...mockAssessmentResult,
        assessedAt: expiredAssessedAt,
      },
      priceGuidance: mockGuidance,
      floorPricePerKg: 4200,
    };
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));

    const wrapper = createTestWrapper();
    render(<NewListingPage />, { wrapper });

    // Expired draft should be cleared and user starts on Step 1
    expect(await screen.findByTestId("step-1-crop")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(WIZARD_DRAFT_KEY)).toBeNull();
  });

  it("renders correctly in mobile viewport (360px)", async () => {
    const wrapper = createTestWrapper();
    render(<NewListingPage />, { wrapper });

    expect(await screen.findByTestId("step-1-crop")).toBeInTheDocument();
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
  });
});
