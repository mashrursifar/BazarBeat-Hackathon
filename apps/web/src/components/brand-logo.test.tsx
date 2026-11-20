import { render, screen } from "@testing-library/react";
import i18next from "i18next";
import { beforeEach, describe, expect, it } from "vitest";

import "../lib/i18n.js";
import { BrandLogo } from "./brand-logo.js";

describe("BrandLogo Component", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("renders English logo by default", () => {
    render(<BrandLogo />);
    const logo = screen.getByTestId("brand-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/BazarBeat_Eng.svg");
    expect(logo).toHaveAttribute("alt", "BazarBeat");
  });

  it("switches to Bangla logo when language is bn", async () => {
    await i18next.changeLanguage("bn");
    render(<BrandLogo />);
    const logo = screen.getByTestId("brand-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/BazarBeat_Bng.svg");
    expect(logo).toHaveAttribute("alt", "বাজারবিট");
  });

  it("accepts custom className and alt override", () => {
    render(<BrandLogo className="h-12 w-12 custom-class" alt="Custom Alt" />);
    const logo = screen.getByTestId("brand-logo");
    expect(logo).toHaveClass("h-12", "w-12", "custom-class");
    expect(logo).toHaveAttribute("alt", "Custom Alt");
  });
});
