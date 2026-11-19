import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "../lib/i18n.js";
import { DemoModeBadge } from "./demo-mode-badge.js";

const usePublicConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../features/listings/api/use-listing-wizard-api.js", () => ({
  usePublicConfig: usePublicConfigMock,
}));

describe("DemoModeBadge component (Task 9.4)", () => {
  it("renders null when demoMode is false or config is absent", () => {
    usePublicConfigMock.mockReturnValue({
      data: {
        demoMode: false,
        durationPresets: {},
        platformFeeBps: 200,
      },
      isLoading: false,
    });

    const { container } = render(<DemoModeBadge />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("demo-mode-badge")).toBeNull();
  });

  it("renders the badge when demoMode is true", () => {
    usePublicConfigMock.mockReturnValue({
      data: {
        demoMode: true,
        durationPresets: {},
        platformFeeBps: 200,
      },
      isLoading: false,
    });

    render(<DemoModeBadge />);
    const badge = screen.getByTestId("demo-mode-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("Demo mode: timers are shortened");
  });
});
