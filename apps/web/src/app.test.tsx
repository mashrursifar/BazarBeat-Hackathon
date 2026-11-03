import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./app/providers.js";
import { router } from "./app/router.js";

describe("web app foundation", () => {
  it("exports the application router", () => {
    render(<AppProviders><div>{router.routes.length} routes</div></AppProviders>);
    expect(screen.getByText("2 routes")).toBeInTheDocument();
  });
});
