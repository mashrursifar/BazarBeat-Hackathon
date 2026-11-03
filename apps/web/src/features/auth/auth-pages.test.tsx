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
    expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended. Please log in again.");
  });

  it("shows a credential error for a failed login instead of a session-expired message", async () => {
    document.cookie = "bazarbeat-session=; Path=/; Max-Age=0";
    render(<AppProviders><MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<LoginPage />} /></Routes></MemoryRouter></AppProviders>);
    fireEvent.change(screen.getByLabelText("Bangladesh mobile number"), { target: { value: "01712345678" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid phone number or password.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Your session has ended");
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
    expect(screen.getByLabelText("Country calling code")).toHaveValue("+880");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("explains why a common password is rejected", async () => {
    render(<AppProviders><MemoryRouter initialEntries={["/register"]}><Routes><Route path="/register" element={<RegisterPage />} /></Routes></MemoryRouter></AppProviders>);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Farmer" } });
    fireEvent.change(screen.getByLabelText("Bangladesh mobile number"), { target: { value: "01712345678" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText("Division"), { target: { value: "barishal" } });
    fireEvent.change(screen.getByLabelText("District"), { target: { value: "barguna" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("This password is too common. Choose a less predictable password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields");
    expect(screen.getByRole("alert")).toHaveClass("bg-red-50", "text-red-800");
  });

  it("reports API failures as server errors instead of connection errors", () => {
    render(<AppProviders><ServerError code="INTERNAL" /></AppProviders>);
    expect(screen.getByRole("alert")).toHaveTextContent("BazarBeat could not complete that request.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("We could not reach BazarBeat");
  });
});
