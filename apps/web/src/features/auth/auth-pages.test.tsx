import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AppProviders } from "../../app/providers.js";
import { LoginPage, RegisterPage } from "./auth-pages.js";

describe("authentication pages", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders the login form and registration link", async () => {
    render(<AppProviders><MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<LoginPage />} /></Routes></MemoryRouter></AppProviders>);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bangladesh mobile number")).toHaveAttribute("type", "tel");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("lets a registrant choose a role and shows the buyer organization field", async () => {
    render(<AppProviders><MemoryRouter initialEntries={["/register"]}><Routes><Route path="/register" element={<RegisterPage />} /></Routes></MemoryRouter></AppProviders>);
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Buyer" }));
    expect(screen.getByLabelText("Organization (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("District")).toBeDisabled();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
