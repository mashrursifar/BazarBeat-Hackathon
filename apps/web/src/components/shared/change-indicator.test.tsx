import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "../../lib/i18n.js";
import { i18n } from "../../lib/i18n.js";
import { ChangeIndicator } from "./change-indicator.js";

describe("ChangeIndicator component (UI_UX_GUIDELINES §1, §2, §6)", () => {
  it("returns null when changePercent is null or undefined", () => {
    const { container: nullContainer } = render(<ChangeIndicator changePercent={null} />);
    expect(nullContainer.firstChild).toBeNull();

    const { container: undefContainer } = render(<ChangeIndicator changePercent={undefined} />);
    expect(undefContainer.firstChild).toBeNull();
  });

  it("renders positive change with up arrow and text (not color alone)", () => {
    render(<ChangeIndicator changePercent={14.5} />);
    const indicator = screen.getByTestId("change-indicator-positive");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent("↑");
    expect(indicator).toHaveTextContent("+14.5%");
    expect(indicator).toHaveTextContent("vs previous period");
  });

  it("renders negative change with down arrow and text (not color alone)", () => {
    render(<ChangeIndicator changePercent={-9.2} />);
    const indicator = screen.getByTestId("change-indicator-negative");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent("↓");
    expect(indicator).toHaveTextContent("-9.2%");
    expect(indicator).toHaveTextContent("vs previous period");
  });

  it("renders zero change with arrow and 0.0%", () => {
    render(<ChangeIndicator changePercent={0} />);
    const indicator = screen.getByTestId("change-indicator-neutral");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent("→");
    expect(indicator).toHaveTextContent("0.0%");
  });

  it("supports custom label", () => {
    render(<ChangeIndicator changePercent={8.0} label="vs last month" />);
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });

  it("renders Bangla numerals when language is bn", async () => {
    await i18n.changeLanguage("bn");
    try {
      render(<ChangeIndicator changePercent={15.0} />);
      const indicator = screen.getByTestId("change-indicator-positive");
      expect(indicator).toHaveTextContent("↑");
      expect(indicator).toHaveTextContent("+১৫.০%");
    } finally {
      await i18n.changeLanguage("en");
    }
  });
});
