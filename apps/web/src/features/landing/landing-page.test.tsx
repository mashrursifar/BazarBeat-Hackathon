import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@bazarbeat/shared";

import { i18n } from "../../lib/i18n.js";
import { LandingPage } from "./landing-page.js";

let mockUser: PublicUser | null = null;

vi.mock("../auth/auth-context.js", () => ({
  useOptionalAuth: (): Record<string, unknown> => ({
    user: mockUser,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    setUser: vi.fn(),
    retry: vi.fn(),
  }),
  useAuth: (): Record<string, unknown> => ({
    user: mockUser,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    setUser: vi.fn(),
    retry: vi.fn(),
  }),
}));

function renderLanding(initialRoute = "/"): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/farmer/dashboard" element={<div data-testid="farmer-dashboard-view">Farmer Dashboard</div>} />
        <Route path="/buyer/dashboard" element={<div data-testid="buyer-dashboard-view">Buyer Dashboard</div>} />
        <Route path="/login" element={<div data-testid="login-view">Login View</div>} />
        <Route path="/register" element={<div data-testid="register-view">Register View</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LandingPage Component (Task 8.12)", () => {
  beforeEach(async () => {
    mockUser = null;
    await i18n.changeLanguage("en");
  });

  it("renders public landing page with 'Better Price, Stronger Farmer' and core message", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: /better price, stronger farmer/i })).toBeInTheDocument();
    expect(screen.getByText(/digital agricultural marketplace/i)).toBeInTheDocument();
  });

  it("renders 3-step explanation cards for both farmer and buyer flows", () => {
    renderLanding();

    // Farmer steps
    expect(screen.getByText("For Farmers")).toBeInTheDocument();
    expect(screen.getByText("1. AI Quality Grading")).toBeInTheDocument();
    expect(screen.getByText("2. Floor-Protected Bidding")).toBeInTheDocument();
    expect(screen.getByText("3. Direct Handover & Payment")).toBeInTheDocument();

    // Buyer steps
    expect(screen.getByText("For Buyers")).toBeInTheDocument();
    expect(screen.getByText("1. Verified Produce Catalog")).toBeInTheDocument();
    expect(screen.getByText("2. Fair Ascending Bids")).toBeInTheDocument();
    expect(screen.getByText("3. Guaranteed Settlement")).toBeInTheDocument();
  });

  it("renders role-specific calls to action and links to register / marketplace", () => {
    renderLanding();

    const farmerCta = screen.getByTestId("landing-cta-farmer");
    expect(farmerCta).toHaveAttribute("href", "/register?role=FARMER");

    const buyerCta = screen.getByTestId("landing-cta-buyer");
    expect(buyerCta).toHaveAttribute("href", "/register?role=BUYER");

    const marketCta = screen.getByTestId("landing-cta-marketplace");
    expect(marketCta).toHaveAttribute("href", "/market");
  });

  it("switches cleanly between English and Bangla", async () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Better Price, Stronger Farmer");

    await i18n.changeLanguage("bn");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ন্যায্য দাম, শক্তিশালী কৃষক");
    expect(screen.getByText("ডিজিটাল কৃষি মার্কেটপ্লেস")).toBeInTheDocument();
    expect(screen.getByText("কৃষকদের জন্য")).toBeInTheDocument();
    expect(screen.getByText("ক্রেতাদের জন্য")).toBeInTheDocument();
  });

  it("redirects logged-in farmers immediately to /farmer/dashboard", () => {
    mockUser = {
      id: "farmer-1",
      name: "Abdur Rahim",
      role: "FARMER",
      language: "bn",
      district: "Bogura",
      division: "Rajshahi",
    };

    renderLanding();

    expect(screen.getByTestId("farmer-dashboard-view")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /better price, stronger farmer/i })).toBeNull();
  });

  it("redirects logged-in buyers immediately to /buyer/dashboard", () => {
    mockUser = {
      id: "buyer-1",
      name: "Karim Enterprise",
      role: "BUYER",
      language: "en",
      district: "Dhaka",
      division: "Dhaka",
    };

    renderLanding();

    expect(screen.getByTestId("buyer-dashboard-view")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /better price, stronger farmer/i })).toBeNull();
  });
});
