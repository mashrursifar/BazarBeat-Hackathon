import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingStatus } from "@bazarbeat/shared";

import { i18n } from "../../lib/i18n.js";
import { resetServerClock } from "../../lib/server-clock.js";
import { CountdownTimer } from "./countdown-timer.js";

describe("CountdownTimer component", () => {
  const baseNow = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetServerClock();
    void i18n.changeLanguage("en");
  });

  afterEach(() => {
    resetServerClock();
    vi.useRealTimers();
    void i18n.changeLanguage("en");
  });

  it("renders normal countdown styling for duration >= 10 minutes", () => {
    const endsAt = new Date(baseNow + 25 * 60 * 1000).toISOString();
    render(<CountdownTimer endsAt={endsAt} />);

    const timer = screen.getByTestId("countdown-timer");
    expect(timer).toHaveAttribute("data-normal", "true");
    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("25:00");
  });

  it("renders amber styling for duration under 10 minutes", () => {
    const endsAt = new Date(baseNow + 8 * 60 * 1000).toISOString();
    render(<CountdownTimer endsAt={endsAt} />);

    const timer = screen.getByTestId("countdown-timer");
    expect(timer).toHaveAttribute("data-warning", "true");
    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("08:00");
  });

  it("renders red styling for duration under 2 minutes", () => {
    const endsAt = new Date(baseNow + 90 * 1000).toISOString(); // 1m 30s
    render(<CountdownTimer endsAt={endsAt} />);

    const timer = screen.getByTestId("countdown-timer");
    expect(timer).toHaveAttribute("data-urgent", "true");
    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("01:30");
  });

  it("renders brief 'Extended' flash when anti-sniping extension arrives", () => {
    const initialEndsAt = new Date(baseNow + 30 * 1000).toISOString();
    const extendedEndsAt = new Date(baseNow + 150 * 1000).toISOString();

    const { rerender } = render(<CountdownTimer endsAt={initialEndsAt} />);
    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("00:30");

    // Extension pushed back
    rerender(<CountdownTimer endsAt={extendedEndsAt} />);

    expect(screen.getByTestId("countdown-extended-flash")).toHaveTextContent("Extended (+2m)");

    // After flash period (3s), reverts to active countdown display
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByTestId("countdown-extended-flash")).toBeNull();
    expect(screen.getByTestId("countdown-digits")).toBeInTheDocument();
  });

  it("renders 'Finalizing…' at zero while listing is still ACTIVE", () => {
    const endsAt = new Date(baseNow + 1000).toISOString();
    render(<CountdownTimer endsAt={endsAt} status={ListingStatus.ACTIVE} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("countdown-finalizing-label")).toHaveTextContent("Finalizing…");
    const timer = screen.getByTestId("countdown-timer");
    expect(timer).toHaveAttribute("data-finalizing", "true");
  });

  it("renders 'Auction ended' once closed status is confirmed by server", () => {
    const endsAt = new Date(baseNow - 5000).toISOString();
    render(<CountdownTimer endsAt={endsAt} status={ListingStatus.SOLD} />);

    expect(screen.getByTestId("countdown-ended-label")).toHaveTextContent("Auction ended");
  });

  it("renders Bangla numerals when language is switched to 'bn'", async () => {
    await i18n.changeLanguage("bn");
    const endsAt = new Date(baseNow + 12 * 60 * 1000).toISOString(); // 12:00
    render(<CountdownTimer endsAt={endsAt} />);

    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("১২:০০");
  });
});
