import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "../../lib/i18n.js";
import { DemoAiChip } from "./demo-ai-chip.js";

describe("DemoAiChip Component", () => {
  it("renders 'Demo AI model' when no provider is passed", () => {
    render(<DemoAiChip />);
    const chip = screen.getByTestId("demo-ai-chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("Demo AI model");
    expect(chip).toHaveAttribute(
      "title",
      "Produce quality and price benchmarks are evaluated by BazarBeat AI.",
    );
  });

  it("renders 'Demo AI model' when provider is 'mock'", () => {
    render(<DemoAiChip provider="mock" degraded={false} />);
    const chip = screen.getByTestId("demo-ai-chip");
    expect(chip).toHaveTextContent("Demo AI model");
  });

  it("renders 'Gemini' when provider is 'gemini' and not degraded", () => {
    render(<DemoAiChip provider="gemini" degraded={false} />);
    const chip = screen.getByTestId("demo-ai-chip");
    expect(chip).toHaveTextContent("Gemini");
    expect(chip).toHaveAttribute(
      "title",
      "Produce quality evaluated by Google Gemini multimodal AI model.",
    );
  });

  it("renders 'Demo AI model' when provider is 'gemini' but degraded: true", () => {
    render(<DemoAiChip provider="gemini" degraded={true} />);
    const chip = screen.getByTestId("demo-ai-chip");
    expect(chip).toHaveTextContent("Demo AI model");
    expect(chip).toHaveAttribute(
      "title",
      "Produce quality and price benchmarks are evaluated by BazarBeat AI.",
    );
  });
});
