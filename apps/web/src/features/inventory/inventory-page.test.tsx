import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../lib/i18n.js";
import { AddStockDialog, MovementHistory } from "./inventory-page.js";

const movementHook = vi.hoisted(() => vi.fn());
vi.mock("./api/use-inventory.js", () => ({ useInventoryMovements: movementHook }));

const crop = {
  id: "0123456789abcdef01234567", slug: "bitter-gourd", nameEn: "Bitter Gourd", nameBn: "করলা", unit: "KG" as const,
  minLotKg: 10, maxLotKg: 1000, shelfLifeHours: 120, gradeGuide: { A: "A", B: "B", C: "C" }, minIncrementPerKg: 100, imageUrl: "/bitter-gourd.svg",
};
const crops = [{ crop, availableKg: 0, listedKg: 0, soldKg: 0 }];
const wrapper = ({ children }: { children: React.ReactNode }): ReactElement => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe("inventory components", () => {
  beforeEach(() => { movementHook.mockReset(); });

  it("validates and submits the add stock dialog with visible kg unit", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AddStockDialog crops={crops} onAdd={onAdd} onClose={onClose} />, { wrapper });
    expect(screen.getByLabelText("Kilograms")).toHaveTextContent("kg");
    fireEvent.change(screen.getByTestId("stock-quantity"), { target: { value: "5001" } });
    fireEvent.click(screen.getByTestId("stock-submit"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("stock-quantity"), { target: { value: "12.5" } });
    fireEvent.change(screen.getByTestId("stock-note"), { target: { value: "Morning harvest" } });
    fireEvent.click(screen.getByTestId("stock-submit"));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ cropId: crop.id, quantityKg: 12.5, note: "Morning harvest" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders readable movement types and paginates history", () => {
    movementHook.mockReturnValue({
      isLoading: false, isError: false, refetch: vi.fn(),
      data: { data: [{ id: "abcdef0123456789abcdef01", farmerId: crop.id, cropId: crop.id, type: "ADD", quantityKg: 12, createdAt: "2026-11-03T06:00:00.000Z", note: "Harvest" }], meta: { page: 1, limit: 10, total: 15 } },
    });
    const onPageChange = vi.fn();
    render(<MovementHistory cropId={crop.id} page={1} onPageChange={onPageChange} />, { wrapper });
    expect(screen.getByTestId("movement-history")).toHaveTextContent("Stock added");
    expect(screen.getByTestId("movement-history")).toHaveTextContent("12 kg");
    fireEvent.click(screen.getByTestId("history-next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
