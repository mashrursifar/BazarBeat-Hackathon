import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AppProviders } from "../../app/providers.js";
import { LoginPage, RegisterPage, ServerError } from "./auth-pages.js";

describe("authentication pages", () => {
  beforeEach(() => {
    document.cookie = "bazarbeat-session=1; Path=/; SameSite=Lax";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => {
    cleanup();
    document.cookie = "bazarbeat-session=; Path=/; Max-Age=0";
    vi.unstubAllGlobals();
  });

  it("renders the login form and registration link", async () => {
    render(<AppProviders><MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<LoginPage />} /></Routes></MemoryRouter></AppProviders>);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bangladesh mobile number")).toHaveAttribute("type", "tel");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("does not probe the API for a visitor without a session", () => {
    document.cookie = "bazarbeat-session=; Path=/; Max-Age=0";
    render(<AppProviders><MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<LoginPage />} /></Routes></MemoryRouter></AppProviders>);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets a registrant choose a role and shows the buyer organization field", async () => {
    render(<AppProviders><MemoryRouter initialEntries={["/register"]}><Routes><Route path="/register" element={<RegisterPage />} /></Routes></MemoryRouter></AppProviders>);
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Buyer" }));
    expect(screen.getByLabelText("Organization (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("District")).toBeDisabled();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("reports API failures as server errors instead of connection errors", () => {
    render(<AppProviders><ServerError code="INTERNAL" /></AppProviders>);
    expect(screen.getByRole("alert")).toHaveTextContent("BazarBeat could not complete that request.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("We could not reach BazarBeat");
  });
});
