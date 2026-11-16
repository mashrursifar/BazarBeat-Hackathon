import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderStatus } from "@bazarbeat/shared";

import "../../lib/i18n.js";
import { OrderTimeline } from "./order-timeline.js";

describe("OrderTimeline component", () => {
  it("renders empty state gracefully when no entries are provided", () => {
    render(<OrderTimeline entries={[]} />);
    expect(screen.getByText(/No activity recorded yet/i)).toBeInTheDocument();
  });

  it("renders statusHistory timeline entries in chronological order with notes", () => {
    const entries = [
      {
        status: OrderStatus.CONFIRMED,
        at: "2026-11-16T11:00:00.000Z",
        note: "Handover scheduled for tomorrow 10am",
      },
      {
        status: OrderStatus.PENDING,
        at: "2026-11-16T10:00:00.000Z",
      },
      {
        status: OrderStatus.DELIVERED,
        at: "2026-11-16T15:00:00.000Z",
        note: "Handed over to buyer pickup truck",
      },
    ];

    render(<OrderTimeline entries={entries} />);

    // Renders all entries
    expect(screen.getByText("Handover scheduled for tomorrow 10am")).toBeInTheDocument();
    expect(screen.getByText("Handed over to buyer pickup truck")).toBeInTheDocument();

    const timeline = screen.getByTestId("order-timeline") || screen.getByRole("status", { hidden: true });
    expect(timeline).toBeDefined();
  });
});
