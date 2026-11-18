import { type ReactElement, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, createBrowserRouter } from "react-router-dom";

import { LanguageSwitcher } from "../components/language-switcher.js";

const LoginPage = lazy(() =>
  import("../features/auth/auth-pages.js").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("../features/auth/auth-pages.js").then((module) => ({ default: module.RegisterPage })),
);
const AuthGuard = lazy(() =>
  import("./role-layouts.js").then((module) => ({ default: module.AuthGuard })),
);
const BuyerLayout = lazy(() =>
  import("./role-layouts.js").then((module) => ({ default: module.BuyerLayout })),
);
const FarmerLayout = lazy(() =>
  import("./role-layouts.js").then((module) => ({ default: module.FarmerLayout })),
);
const PlaceholderPage = lazy(() =>
  import("./role-layouts.js").then((module) => ({ default: module.PlaceholderPage })),
);
const InventoryPage = lazy(() => import("../features/inventory/inventory-page.js"));
const NewListingPage = lazy(() => import("../features/listings/new-listing-page.js"));
const MyListingsPage = lazy(() => import("../features/listings/my-listings-page.js"));
const CropBiddingPage = lazy(() => import("../features/listings/crop-bidding-page.js"));
const MarketplacePage = lazy(() => import("../features/marketplace/marketplace-page.js"));
const BuyerListingDetailPage = lazy(() => import("../features/marketplace/listing-detail-page.js"));
const ComparePage = lazy(() => import("../features/marketplace/compare-page.js"));
const MyBidsPage = lazy(() => import("../features/bids/my-bids-page.js"));
const FarmerOrdersPage = lazy(() => import("../features/orders/farmer-orders-page.js"));
const FarmerOrderDetailPage = lazy(() => import("../features/orders/farmer-order-detail-page.js"));
const BuyerOrdersPage = lazy(() => import("../features/orders/buyer-orders-page.js"));
const BuyerOrderDetailPage = lazy(() => import("../features/orders/buyer-order-detail-page.js"));
const SalesPage = lazy(() => import("../features/sales/sales-page.js"));
const EarningsPage = lazy(() => import("../features/earnings/earnings-page.js"));
const FarmerDashboardPage = lazy(() => import("../features/dashboards/farmer-dashboard-page.js"));
const BuyerDashboardPage = lazy(() => import("../features/dashboards/buyer-dashboard-page.js"));
const FarmerMarketPricesPage = lazy(() => import("../features/market-prices/farmer-market-prices-page.js"));
const BuyerMarketOverviewPage = lazy(() => import("../features/market-prices/buyer-market-overview-page.js"));
const NotificationsPage = lazy(() => import("../features/notifications/notifications-page.js"));

const FARMER_PAGES = [
  ["dashboard", "dashboard"],
  ["products", "myListings"],
  ["new-listing", "newListing"],
  ["crop-bidding", "cropBidding"],
  ["inventory", "inventory"],
  ["orders", "orders"],
  ["sales", "sales"],
  ["earnings", "earnings"],
  ["market-prices", "marketPrices"],
  ["settings", "settings"],
] as const;
const BUYER_PAGES = [
  ["dashboard", "dashboard"],
  ["marketplace", "marketplace"],
  ["compare", "compare"],
  ["my-bids", "myBids"],
  ["orders", "orders"],
  ["watchlist", "watchlist"],
  ["market-overview", "marketOverview"],
  ["settings", "settings"],
] as const;

function RouteLoading(): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="p-8" role="status">
      {t("auth.loading")}
    </main>
  );
}

function HomePage(): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        {t("appName")}
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-foreground sm:text-6xl">
        {t("tagline")}
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("introduction")}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          className="min-h-12 rounded-md bg-primary px-5 py-3 font-semibold text-white"
          to="/register"
        >
          {t("register.title")}
        </Link>
        <Link
          className="min-h-12 rounded-md border border-primary px-5 py-3 font-semibold text-primary"
          to="/login"
        >
          {t("login.title")}
        </Link>
        <LanguageSwitcher />
      </div>
    </main>
  );
}

function farmerPage(path: string, pageKey: string): { path: string; element: ReactElement } {
  if (path === "dashboard") return { path, element: <FarmerDashboardPage /> };
  if (path === "inventory") return { path, element: <InventoryPage /> };
  if (path === "new-listing") return { path, element: <NewListingPage /> };
  if (path === "products") return { path, element: <MyListingsPage /> };
  if (path === "crop-bidding") return { path, element: <CropBiddingPage /> };
  if (path === "orders") return { path, element: <FarmerOrdersPage /> };
  if (path === "sales") return { path, element: <SalesPage /> };
  if (path === "earnings") return { path, element: <EarningsPage /> };
  if (path === "market-prices") return { path, element: <FarmerMarketPricesPage /> };
  return { path, element: <PlaceholderPage pageKey={pageKey} /> };
}

function buyerPage(path: string, pageKey: string): { path: string; element: ReactElement } {
  if (path === "dashboard") return { path, element: <BuyerDashboardPage /> };
  if (path === "marketplace") return { path, element: <MarketplacePage /> };
  if (path === "compare") return { path, element: <ComparePage /> };
  if (path === "my-bids") return { path, element: <MyBidsPage /> };
  if (path === "orders") return { path, element: <BuyerOrdersPage /> };
  if (path === "market-overview") return { path, element: <BuyerMarketOverviewPage /> };
  return { path, element: <PlaceholderPage pageKey={pageKey} /> };
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  {
    path: "/market",
    element: (
      <Suspense fallback={<RouteLoading />}>
        <MarketplacePage />
      </Suspense>
    ),
  },
  {
    path: "/login",
    element: (
      <Suspense fallback={<RouteLoading />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/register",
    element: (
      <Suspense fallback={<RouteLoading />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    element: (
      <Suspense fallback={<RouteLoading />}>
        <AuthGuard />
      </Suspense>
    ),
    children: [
      {
        path: "/farmer",
        element: (
          <Suspense fallback={<RouteLoading />}>
            <FarmerLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "bidding", element: <Navigate to="/farmer/crop-bidding" replace /> },
          { path: "orders/:id", element: <FarmerOrderDetailPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          ...FARMER_PAGES.map(([path, pageKey]) => farmerPage(path, pageKey)),
        ],
      },
      {
        path: "/buyer",
        element: (
          <Suspense fallback={<RouteLoading />}>
            <BuyerLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "listings/:id", element: <BuyerListingDetailPage /> },
          { path: "marketplace/:id", element: <BuyerListingDetailPage /> },
          { path: "orders/:id", element: <BuyerOrderDetailPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          ...BUYER_PAGES.map(([path, pageKey]) => buyerPage(path, pageKey)),
        ],
      },
    ],
  },
]);
