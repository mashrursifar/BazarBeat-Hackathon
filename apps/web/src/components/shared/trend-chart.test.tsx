import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import "../../lib/i18n.js";
import { TrendChart, type TrendChartPoint } from "./trend-chart.js";

const sampleData: TrendChartPoint[] = [
  { bucket: "2026-11-10", date: "2026-11-10", value: 2500000, quantityKg: 100, orderCount: 2 },
  { bucket: "2026-11-11", date: "2026-11-11", value: 3000000, quantityKg: 150, orderCount: 3 },
  { bucket: "2026-11-12", date: "2026-11-12", value: 4500000, quantityKg: 200, orderCount: 4 },
];

describe("TrendChart Component", () => {
  it("renders empty state when data is empty or all zeroes", () => {
    render(
      <TrendChart
        title="Sales Trend"
        data={[]}
        emptyMessage="No sales recorded in this period"
      />,
    );

    expect(screen.getByText("Sales Trend")).toBeInTheDocument();
    expect(screen.getByTestId("trend-chart-empty-state")).toBeInTheDocument();
    expect(screen.getAllByText("No sales recorded in this period").length).toBeGreaterThanOrEqual(1);

    const summary = screen.getByTestId("trend-chart-text-summary");
    expect(summary).toHaveTextContent("No sales recorded in this period");
  });

  it("renders populated trend chart with accessible text summary", () => {
    render(
      <TrendChart
        title="Booked Sales Trend"
        subtitle="Gross value over time"
        data={sampleData}
        valueLabel="Sales"
      />,
    );

    expect(screen.getByText("Booked Sales Trend")).toBeInTheDocument();
    expect(screen.getByText("Gross value over time")).toBeInTheDocument();

    // Total: 2,500,000 + 3,000,000 + 4,500,000 = 10,000,000 poisha = ৳100000.00
    // Total Kg: 100 + 150 + 200 = 450 kg
    // Total Orders: 2 + 3 + 4 = 9 orders
    const summary = screen.getByTestId("trend-chart-text-summary");
    expect(summary).toHaveTextContent("৳100000.00");
    expect(summary).toHaveTextContent("450 kg");
    expect(summary).toHaveTextContent("9 orders");
  });

  it("toggles between chart view and accessible data table", async () => {
    const user = userEvent.setup();

    render(
      <TrendChart
        title="Sales Trend"
        data={sampleData}
        valueLabel="Sales"
      />,
    );

    // Initial state: Chart tab selected, table not visible
    expect(screen.getByTestId("trend-chart-tab-chart")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("trend-chart-table")).not.toBeInTheDocument();

    // Click Table tab
    await user.click(screen.getByTestId("trend-chart-tab-table"));

    expect(screen.getByTestId("trend-chart-tab-table")).toHaveAttribute("aria-selected", "true");
    const table = screen.getByTestId("trend-chart-table");
    expect(table).toBeInTheDocument();

    // Verify table headers and rows
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Volume (kg)")).toBeInTheDocument();

    // Formatted dates in Asia/Dhaka
    expect(screen.getByText("10 Nov")).toBeInTheDocument();
    expect(screen.getByText("11 Nov")).toBeInTheDocument();
    expect(screen.getByText("12 Nov")).toBeInTheDocument();

    // Formatted values in table
    expect(screen.getByText("৳25000.00")).toBeInTheDocument();
    expect(screen.getByText("৳30000.00")).toBeInTheDocument();
    expect(screen.getByText("৳45000.00")).toBeInTheDocument();

    // Totals row in tfoot
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(table).toHaveTextContent("৳100000.00");
    expect(table).toHaveTextContent("450 kg");
  });

  it("formats dates and values with Bangla localization when isBangla is true", async () => {
    const user = userEvent.setup();

    render(
      <TrendChart
        title="বিক্রির ধারা"
        data={sampleData}
        isBangla={true}
        valueLabel="বিক্রি"
      />,
    );

    // Switch to table to inspect formatted cells
    await user.click(screen.getByTestId("trend-chart-tab-table"));

    // Check Bangla date formatting "১০ নভে"
    expect(screen.getByText("১০ নভে")).toBeInTheDocument();
    expect(screen.getByText("১১ নভে")).toBeInTheDocument();
    expect(screen.getByText("১২ নভে")).toBeInTheDocument();

    // Check Bangla digits on currency amounts
    expect(screen.getByText("৳২৫০০০.০০")).toBeInTheDocument();
    expect(screen.getByText("৳৩০০০০.০০")).toBeInTheDocument();
    expect(screen.getByText("৳৪৫০০০.০০")).toBeInTheDocument();
  });

  it("renders at 360px viewport without overflow and maintains fixed height container", () => {
    const { container } = render(
      <div style={{ width: 360 }}>
        <TrendChart
          title="Sales Trend"
          data={sampleData}
        />
      </div>,
    );

    const rootWrapper = screen.getByTestId("trend-chart");
    expect(rootWrapper).toHaveClass("w-full", "max-w-full", "overflow-hidden");

    // Recharts container inside chart view has fixed height
    const chartWrapper = container.querySelector(".h-64");
    expect(chartWrapper).toBeInTheDocument();
  });
});