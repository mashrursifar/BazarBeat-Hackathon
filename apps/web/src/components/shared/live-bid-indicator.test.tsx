import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../lib/i18n.js";
import { LiveBidIndicator } from "./live-bid-indicator.js";

describe("LiveBidIndicator component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    void i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.useRealTimers();
    void i18n.changeLanguage("en");
  });

  it("renders 'No bids yet' for 0 bids", () => {
    render(<LiveBidIndicator bidCount={0} />);

    expect(screen.getByTestId("live-bid-count")).toHaveTextContent("No bids yet");
    expect(screen.getByTestId("live-pulse-ring")).toBeInTheDocument();
  });

  it("renders singular '1 bid' for 1 bid", () => {
    render(<LiveBidIndicator bidCount={1} />);

    expect(screen.getByTestId("live-bid-count")).toHaveTextContent("1 bid");
  });

  it("renders plural count for multiple bids", () => {
    render(<LiveBidIndicator bidCount={12} />);

    expect(screen.getByTestId("live-bid-count")).toHaveTextContent("12 bids");
  });

  it("renders offline indicator styling when isLive is false", () => {
    render(<LiveBidIndicator bidCount={3} isLive={false} showStatusText />);

    expect(screen.queryByTestId("live-pulse-ring")).toBeNull();
    expect(screen.getByTestId("live-dot")).toHaveClass("bg-stone-400");
    expect(screen.getByTestId("live-status-text")).toHaveTextContent("Offline");
  });

  it("triggers highlight animation briefly on bid count increment", () => {
    const { rerender } = render(<LiveBidIndicator bidCount={2} />);
    const indicator = screen.getByTestId("live-bid-indicator");
    expect(indicator).not.toHaveAttribute("data-updated");

    rerender(<LiveBidIndicator bidCount={3} />);
    expect(indicator).toHaveAttribute("data-updated", "true");

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(indicator).not.toHaveAttribute("data-updated");
  });

  it("renders localized count in Bangla when language is switched", async () => {
    await i18n.changeLanguage("bn");
    render(<LiveBidIndicator bidCount={25} />);

    expect(screen.getByTestId("live-bid-count")).toHaveTextContent("২৫টি বিড");
  });

  it("exposes an aria-live polite region for screen readers", () => {
    const { container } = render(<LiveBidIndicator bidCount={5} isLive />);
    const liveRegion = container.querySelector('[aria-live="polite"]');

    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Live. 5 bids");
  });
});
