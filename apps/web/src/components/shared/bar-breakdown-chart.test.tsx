import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import "../../lib/i18n.js";
import { BarBreakdownChart, type BarBreakdownItem } from "./bar-breakdown-chart.js";

const sampleCrops: BarBreakdownItem[] = [
  {
    cropId: "crop-onion",
    cropSlug: "onion",
    cropName: "Onion",
    cropNameBn: "পেঁয়াজ",
    value: 7500000, // ৳75,000.00
    quantityKg: 850,
    orderCount: 8,
  },
  {
    cropId: "crop-potato",
    cropSlug: "potato",
    cropName: "Potato",
    cropNameBn: "আলু",
    value: 5000000, // ৳50,000.00
    quantityKg: 600,
    orderCount: 6,
  },
];

describe("BarBreakdownChart Component", () => {
  it("renders empty state when data is empty or all zeroes", () => {
    render(
      <BarBreakdownChart
        title="Booked Value by Crop"
        data={[]}
        emptyMessage="No crop sales recorded in this period"
      />,
    );

    expect(screen.getByText("Booked Value by Crop")).toBeInTheDocument();
    expect(screen.getByTestId("bar-breakdown-chart-empty-state")).toBeInTheDocument();
    expect(screen.getAllByText("No crop sales recorded in this period").length).toBeGreaterThanOrEqual(1);

    const summary = screen.getByTestId("bar-breakdown-chart-text-summary");
    expect(summary).toHaveTextContent("No crop sales recorded in this period");
  });

  it("renders populated breakdown with accessible text summary listing crops", () => {
    render(
      <BarBreakdownChart
        title="Booked Value by Crop"
        subtitle="Gross value and volume breakdown"
        data={sampleCrops}
        valueLabel="Total Sales"
      />,
    );

    expect(screen.getByText("Booked Value by Crop")).toBeInTheDocument();
    expect(screen.getByText("Gross value and volume breakdown")).toBeInTheDocument();

    const summary = screen.getByTestId("bar-breakdown-chart-text-summary");
    expect(summary).toHaveTextContent("Onion: ৳75000.00 (850 kg, 8 Orders)");
    expect(summary).toHaveTextContent("Potato: ৳50000.00 (600 kg, 6 Orders)");
  });

  it("toggles between chart view and accessible data table", async () => {
    const user = userEvent.setup();

    render(
      <BarBreakdownChart
        title="Purchases by Crop"
        data={sampleCrops}
        valueLabel="Spend"
      />,
    );

    // Initial state: Chart view active
    expect(screen.getByTestId("bar-breakdown-chart-tab-chart")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("bar-breakdown-chart-table")).not.toBeInTheDocument();

    // Switch to Table view
    await user.click(screen.getByTestId("bar-breakdown-chart-tab-table"));

    expect(screen.getByTestId("bar-breakdown-chart-tab-table")).toHaveAttribute("aria-selected", "true");
    const table = screen.getByTestId("bar-breakdown-chart-table");
    expect(table).toBeInTheDocument();

    // Headers
    expect(screen.getByText("Crop")).toBeInTheDocument();
    expect(screen.getByText("Spend")).toBeInTheDocument();
    expect(screen.getByText("Volume (kg)")).toBeInTheDocument();

    // Rows
    expect(screen.getByText("Onion")).toBeInTheDocument();
    expect(screen.getByText("৳75000.00")).toBeInTheDocument();
    expect(screen.getByText("850 kg")).toBeInTheDocument();

    expect(screen.getByText("Potato")).toBeInTheDocument();
    expect(screen.getByText("৳50000.00")).toBeInTheDocument();
    expect(screen.getByText("600 kg")).toBeInTheDocument();

    // Totals row
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(table).toHaveTextContent("৳125000.00");
    expect(table).toHaveTextContent("1,450 kg");
  });

  it("renders localized Bangla crop names and digits when isBangla is true", async () => {
    const user = userEvent.setup();

    render(
      <BarBreakdownChart
        title="ফসল অনুযায়ী কেনাকাটা"
        data={sampleCrops}
        isBangla={true}
        valueLabel="ব্যয়"
      />,
    );

    // Summary should show Bangla crop names and digits
    const summary = screen.getByTestId("bar-breakdown-chart-text-summary");
    expect(summary).toHaveTextContent("পেঁয়াজ: ৳৭৫০০০.০০");
    expect(summary).toHaveTextContent("আলু: ৳৫০০০০.০০");

    // Table view
    await user.click(screen.getByTestId("bar-breakdown-chart-tab-table"));
    expect(screen.getByText("পেঁয়াজ")).toBeInTheDocument();
    expect(screen.getByText("আলু")).toBeInTheDocument();
    expect(screen.getByText("৳৭৫০০০.০০")).toBeInTheDocument();
    expect(screen.getByText("৳৫০০০০.০০")).toBeInTheDocument();
  });

  it("renders at 360px viewport without overflow and maintains fixed height container", () => {
    const { container } = render(
      <div style={{ width: 360 }}>
        <BarBreakdownChart
          title="Booked Value by Crop"
          data={sampleCrops}
        />
      </div>,
    );

    const rootWrapper = screen.getByTestId("bar-breakdown-chart");
    expect(rootWrapper).toHaveClass("w-full", "max-w-full", "overflow-hidden");

    const chartWrapper = container.querySelector(".h-64");
    expect(chartWrapper).toBeInTheDocument();
  });
});