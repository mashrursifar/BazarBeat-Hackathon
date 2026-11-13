import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GradeBadge } from "./grade-badge.js";

describe("GradeBadge component", () => {
  it("always displays the letter prominently for all grades", () => {
    const { rerender } = render(<GradeBadge grade="A" />);
    const badgeA = screen.getByTestId("grade-badge-a");
    expect(badgeA).toHaveTextContent("A");
    expect(badgeA).toHaveAttribute("aria-label", "Grade A");

    rerender(<GradeBadge grade="B" />);
    const badgeB = screen.getByTestId("grade-badge-b");
    expect(badgeB).toHaveTextContent("B");
    expect(badgeB).toHaveAttribute("aria-label", "Grade B");

    rerender(<GradeBadge grade="C" />);
    const badgeC = screen.getByTestId("grade-badge-c");
    expect(badgeC).toHaveTextContent("C");
    expect(badgeC).toHaveAttribute("aria-label", "Grade C");
  });

  it("supports different sizes and hiding the Grade label", () => {
    render(<GradeBadge grade="A" size="sm" showLabel={false} />);
    const badge = screen.getByTestId("grade-badge-a");
    expect(badge).toHaveTextContent("A");
    expect(badge).not.toHaveTextContent("Grade");
  });
});
