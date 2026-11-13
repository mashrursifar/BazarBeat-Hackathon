import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CropResponse, InventorySummaryItem, PublicConfig } from "@bazarbeat/shared";
import "../../../lib/i18n.js";
import { ListingWizardProvider } from "../context/listing-wizard-context.js";
import { Step5QuantityTimer } from "./step-5-quantity-timer.js";

const useInventoryMock = vi.hoisted(() => vi.fn());
const useAddStockMock = vi.hoisted(() => vi.fn());
const usePublicConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../../inventory/api/use-inventory.js", () => ({
  useInventory: useInventoryMock,
  useAddStock: useAddStockMock,
}));

vi.mock("../api/use-listing-wizard-api.js", () => ({
  usePublicConfig: usePublicConfigMock,
}));

const mockCrop: CropResponse = {
  id: "0123456789abcdef01234567",
  slug: "bitter-gourd",
  nameEn: "Bitter Gourd",
  nameBn: "করলা",
  unit: "KG",
  minLotKg: 20,
  maxLotKg: 500,
  shelfLifeHours: 12, // 12 hours max shelf life! (720 minutes)
  gradeGuide: { A: "A", B: "B", C: "C" },
  minIncrementPerKg: 100,
  imageUrl: "/images/crops/bitter-gourd.svg",
};

const mockConfig: PublicConfig = {
  demoMode: false,
  durationPresets: {
    "1h": 60,
    "3h": 180,
    "6h": 360,
    "12h": 720,
    "24h": 1440, // Should be filtered out because shelfLifeHours is 12h!
  },
  platformFeeBps: 200,
};

function renderStep5(options: {
  availableKg?: number;
  initialQuantityKg?: number;
}): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const crops: InventorySummaryItem[] = [
    {
      crop: mockCrop,
      availableKg: options.availableKg ?? 100,
      listedKg: 0,
      soldKg: 0,
    },
  ];

  useInventoryMock.mockReturnValue({
    data: crops,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });

  useAddStockMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  });

  usePublicConfigMock.mockReturnValue({
    data: mockConfig,
    isLoading: false,
    isError: false,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ListingWizardProvider
        initialStep={5}
        initialCrop={mockCrop}
        initialQuantityKg={options.initialQuantityKg ?? 0}
        initialDurationMinutes={360}
        skipStorageRestoration
      >
        <Step5QuantityTimer />
      </ListingWizardProvider>
    </QueryClientProvider>,
  );
}

describe("Step5QuantityTimer component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders available stock display, allowed lot bounds, and shelf life cap", () => {
    renderStep5({ availableKg: 150 });

    expect(screen.getByTestId("available-stock-display")).toHaveTextContent("150 kg");
    expect(screen.getByTestId("stock-info-card")).toHaveTextContent("20 kg – 500 kg");
    expect(screen.getByTestId("stock-info-card")).toHaveTextContent("12 hours");
  });

  it("shows insufficient stock warning and disables continue when available stock < minLotKg", () => {
    renderStep5({ availableKg: 10 }); // 10 kg < minLotKg 20 kg

    const warning = screen.getByTestId("insufficient-stock-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent("You do not have enough stock in inventory to meet the minimum lot of 20 kg");

    const continueBtn = screen.getByTestId("step-5-continue");
    expect(continueBtn).toBeDisabled();
  });

  it("shows inline error when entered quantity is below min lot", () => {
    renderStep5({ availableKg: 150, initialQuantityKg: 15 }); // 15 < 20

    const errorMin = screen.getByTestId("quantity-error-min");
    expect(errorMin).toBeInTheDocument();
    expect(errorMin).toHaveTextContent("Quantity must be at least 20 kg");

    const continueBtn = screen.getByTestId("step-5-continue");
    expect(continueBtn).toBeDisabled();
  });

  it("shows inline error when entered quantity exceeds available stock", () => {
    renderStep5({ availableKg: 50, initialQuantityKg: 60 }); // 60 > 50

    const errorStock = screen.getByTestId("quantity-error-stock");
    expect(errorStock).toBeInTheDocument();
    expect(errorStock).toHaveTextContent("Quantity exceeds your available stock of 50 kg");

    const continueBtn = screen.getByTestId("step-5-continue");
    expect(continueBtn).toBeDisabled();
  });

  it("shows inline error when entered quantity exceeds crop maximum lot", () => {
    renderStep5({ availableKg: 1000, initialQuantityKg: 600 }); // 600 > maxLotKg 500

    const errorMax = screen.getByTestId("quantity-error-max");
    expect(errorMax).toBeInTheDocument();
    expect(errorMax).toHaveTextContent("Quantity cannot exceed crop limit of 500 kg");

    const continueBtn = screen.getByTestId("step-5-continue");
    expect(continueBtn).toBeDisabled();
  });

  it("enables continue button when entered quantity is valid", () => {
    renderStep5({ availableKg: 100, initialQuantityKg: 50 }); // 20 <= 50 <= 100

    expect(screen.queryByTestId("quantity-error-min")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quantity-error-stock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quantity-error-max")).not.toBeInTheDocument();

    const continueBtn = screen.getByTestId("step-5-continue");
    expect(continueBtn).toBeEnabled();
  });

  it("filters duration presets by crop shelf life (caps at 12 hours)", () => {
    renderStep5({ availableKg: 100, initialQuantityKg: 50 });

    // 1h (60), 3h (180), 6h (360), 12h (720) should exist
    expect(screen.getByTestId("duration-preset-60")).toBeInTheDocument();
    expect(screen.getByTestId("duration-preset-180")).toBeInTheDocument();
    expect(screen.getByTestId("duration-preset-360")).toBeInTheDocument();
    expect(screen.getByTestId("duration-preset-720")).toBeInTheDocument();

    // 24h (1440) should be capped and NOT present
    expect(screen.queryByTestId("duration-preset-1440")).not.toBeInTheDocument();
  });

  it("opens add stock dialog when inline add stock button is clicked", () => {
    renderStep5({ availableKg: 10 });

    const inlineAddStockBtn = screen.getByTestId("inline-add-stock-btn");
    fireEvent.click(inlineAddStockBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("add-stock-form")).toBeInTheDocument();
  });
});
