import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "./app/providers.js";
import { router } from "./app/router.js";

describe("web app foundation", () => {
  beforeEach(() => {
    document.cookie = "bazarbeat-session=1; Path=/; SameSite=Lax";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => {
    document.cookie = "bazarbeat-session=; Path=/; Max-Age=0";
    vi.unstubAllGlobals();
  });

  it("exports the application router", async () => {
    render(<AppProviders><div>{router.routes.length} routes</div></AppProviders>);
    expect(screen.getByText("5 routes")).toBeInTheDocument();
    expect(router.routes.map((route) => route.path)).toEqual(["/", "/market", "/login", "/register", undefined]);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
