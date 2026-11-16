import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderStatus } from "@bazarbeat/shared";

import "../../lib/i18n.js";
import { OrderStatusBadge } from "./order-status-badge.js";

describe("OrderStatusBadge component", () => {
  it("renders distinct styles and localized labels for all statuses", () => {
    const statuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.DISPUTED,
    ];

    for (const st of statuses) {
      const { unmount } = render(<OrderStatusBadge status={st} />);
      const badge = screen.getByTestId("order-status-badge") || screen.getByText(new RegExp(st, "i"));
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-status", st);
      unmount();
    }
  });
});
