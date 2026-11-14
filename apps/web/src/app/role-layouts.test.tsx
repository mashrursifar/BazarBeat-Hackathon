import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@bazarbeat/shared";
import "../lib/i18n.js";
import { FarmerLayout } from "./role-layouts.js";

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
});
