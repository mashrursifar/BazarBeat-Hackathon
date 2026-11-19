import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@bazarbeat/shared";
import "../lib/i18n.js";
import { BuyerLayout, FarmerLayout } from "./role-layouts.js";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../features/auth/auth-context.js", () => ({
  useAuth: useAuthMock,
}));

describe("FarmerLayout sidebar and navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders farmer sidebar with Products section containing My Listings and New Listing", () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "farmer-1",
        name: "Rahim Farmer",
        role: UserRole.FARMER,
        division: "dhaka",
        district: "gazipur",
      },
      signOut: vi.fn(),
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <Routes>
          <Route path="/farmer/*" element={<FarmerLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    // Products section heading
    const productsSection = screen.getByTestId("sidebar-section-products");
    expect(productsSection).toBeInTheDocument();
    expect(productsSection).toHaveTextContent("Products");

    // Nav links inside farmer sidebar
    const myListingsLink = screen.getByRole("link", { name: "My Listings" });
    expect(myListingsLink).toBeInTheDocument();
    expect(myListingsLink).toHaveAttribute("href", "/farmer/products");

    const newListingLink = screen.getByRole("link", { name: "New Listing" });
    expect(newListingLink).toBeInTheDocument();
    expect(newListingLink).toHaveAttribute("href", "/farmer/new-listing");
  });

  it("opens and closes mobile slide-in drawer via hamburger menu and close button", async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      user: {
        id: "farmer-1",
        name: "Rahim Farmer",
        role: UserRole.FARMER,
        division: "dhaka",
        district: "gazipur",
      },
      signOut: vi.fn(),
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <Routes>
          <Route path="/farmer/*" element={<FarmerLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initially mobile drawer is closed
    expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();

    // Hamburger button is present
    const menuButton = screen.getByTestId("mobile-menu-button");
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    // Click hamburger button to open drawer
    await user.click(menuButton);

    const drawer = screen.getByTestId("mobile-nav-drawer");
    expect(drawer).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // Products section inside mobile drawer
    expect(screen.getByTestId("mobile-sidebar-section-products")).toBeInTheDocument();

    // Click close button inside drawer
    const closeButton = screen.getByTestId("mobile-menu-close-button");
    await user.click(closeButton);

    expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
  });

  it("closes mobile drawer on Escape key", async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      user: {
        id: "farmer-1",
        name: "Rahim Farmer",
        role: UserRole.FARMER,
      },
      signOut: vi.fn(),
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <Routes>
          <Route path="/farmer/*" element={<FarmerLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("mobile-menu-button"));
    expect(screen.getByTestId("mobile-nav-drawer")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
  });

  it("closes mobile drawer on backdrop click", async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      user: {
        id: "farmer-1",
        name: "Rahim Farmer",
        role: UserRole.FARMER,
      },
      signOut: vi.fn(),
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <Routes>
          <Route path="/farmer/*" element={<FarmerLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("mobile-menu-button"));
    expect(screen.getByTestId("mobile-nav-drawer")).toBeInTheDocument();

    await user.click(screen.getByTestId("mobile-nav-backdrop"));
    expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
  });

  it("renders BuyerLayout with buyer navigation and mobile drawer", async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      user: {
        id: "buyer-1",
        name: "Karim Buyer",
        role: UserRole.BUYER,
      },
      signOut: vi.fn(),
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/buyer/dashboard"]}>
        <Routes>
          <Route path="/buyer/*" element={<BuyerLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink).toBeInTheDocument();
    expect(marketplaceLink).toHaveAttribute("href", "/buyer/marketplace");

    // Open mobile menu
    await user.click(screen.getByTestId("mobile-menu-button"));
    expect(screen.getByTestId("mobile-nav-drawer")).toBeInTheDocument();

    // Check sign out button inside mobile drawer
    const mobileLogout = screen.getByTestId("mobile-drawer-logout");
    expect(mobileLogout).toBeInTheDocument();
  });
});
