import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import "../../lib/i18n.js";
import { PriceBandChart, type PriceBandChartPoint } from "./price-band-chart.js";

const mockSeriesData: PriceBandChartPoint[] = [
  {
    date: "2026-11-10",
    avgPricePerKg: 6200,
    minPricePerKg: 5800,
    maxPricePerKg: 6600,
  },
  {
    date: "2026-11-11",
    avgPricePerKg: 6350,
    minPricePerKg: 5900,
    maxPricePerKg: 6800,
  },
  {
    date: "2026-11-12",
    avgPricePerKg: 6500,
    minPricePerKg: 6100,
    maxPricePerKg: 7000,
  },
];

describe("PriceBandChart Component", () => {
  it("renders chart view by default with title, subtitle, and legend indicators", () => {
    render(
      <PriceBandChart
        title="Onion Market Prices"
        subtitle="Rajshahi Division • Last 30 days"
        data={mockSeriesData}
      />,
    );

    expect(screen.getByText("Onion Market Prices")).toBeInTheDocument();
    expect(screen.getByText("Rajshahi Division • Last 30 days")).toBeInTheDocument();
    expect(screen.getByText("Average Price (৳/kg)")).toBeInTheDocument();
    expect(screen.getByText("Min–Max Range")).toBeInTheDocument();
  });

  it("toggles between chart view and accessible data table", async () => {
    const user = userEvent.setup();
    render(<PriceBandChart title="Onion Market Prices" data={mockSeriesData} />);

    const tableTab = screen.getByRole("tab", { name: /table/i });
    await user.click(tableTab);

    // Verify table is visible with headers and data rows
    const table = screen.getByTestId("price-band-chart-table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("৳62.00")).toBeInTheDocument();
    expect(screen.getByText("৳58.00")).toBeInTheDocument();
    expect(screen.getByText("৳66.00")).toBeInTheDocument();

    const chartTab = screen.getByRole("tab", { name: /chart/i });
    await user.click(chartTab);
    expect(screen.queryByTestId("price-band-chart-table")).not.toBeInTheDocument();
  });

  it("renders accessible empty state when data array is empty", () => {
    render(<PriceBandChart title="Potato Market Prices" data={[]} />);

    const emptyBox = screen.getByTestId("price-band-chart-empty");
    expect(emptyBox).toBeInTheDocument();
    expect(emptyBox).toHaveTextContent("No price history available for the selected period.");
  });

  it("renders Bangla formatted prices when isBangla is true", async () => {
    const user = userEvent.setup();
    render(
      <PriceBandChart
        title="পেঁয়াজের বাজারদর"
        data={mockSeriesData}
        isBangla={true}
      />,
    );

    const tableTab = screen.getByRole("tab", { name: /সারণী|table/i });
    await user.click(tableTab);

    expect(screen.getByText(/৳৬২\.০০/)).toBeInTheDocument();
  });
});
