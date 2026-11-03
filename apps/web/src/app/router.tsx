import { type ReactElement, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, createBrowserRouter } from "react-router-dom";

import { LanguageSwitcher } from "../components/language-switcher.js";

const LoginPage = lazy(() => import("../features/auth/auth-pages.js").then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("../features/auth/auth-pages.js").then((module) => ({ default: module.RegisterPage })));
const AuthGuard = lazy(() => import("./role-layouts.js").then((module) => ({ default: module.AuthGuard })));
const BuyerLayout = lazy(() => import("./role-layouts.js").then((module) => ({ default: module.BuyerLayout })));
const FarmerLayout = lazy(() => import("./role-layouts.js").then((module) => ({ default: module.FarmerLayout })));
const PlaceholderPage = lazy(() => import("./role-layouts.js").then((module) => ({ default: module.PlaceholderPage })));
const InventoryPage = lazy(() => import("../features/inventory/inventory-page.js"));
const FARMER_PAGES = [
  ["dashboard", "dashboard"], ["products", "myListings"], ["new-listing", "newListing"],
  ["crop-bidding", "cropBidding"], ["inventory", "inventory"], ["orders", "orders"],
  ["sales", "sales"], ["earnings", "earnings"], ["market-prices", "marketPrices"], ["settings", "settings"],
] as const;
const BUYER_PAGES = [
  ["dashboard", "dashboard"], ["marketplace", "marketplace"], ["compare", "compare"], ["my-bids", "myBids"],
  ["orders", "orders"], ["watchlist", "watchlist"], ["market-overview", "marketOverview"], ["settings", "settings"],
] as const;

function RouteLoading(): ReactElement {
  const { t } = useTranslation();
  return <main className="p-8" role="status">{t("auth.loading")}</main>;
}

function HomePage(): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{t("appName")}</p>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-foreground sm:text-6xl">{t("tagline")}</h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("introduction")}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link className="min-h-12 rounded-md bg-primary px-5 py-3 font-semibold text-white" to="/register">{t("register.title")}</Link>
        <Link className="min-h-12 rounded-md border border-primary px-5 py-3 font-semibold text-primary" to="/login">{t("login.title")}</Link>
        <LanguageSwitcher />
      </div>
    </main>
  );
}

function MarketplacePage(): ReactElement {
  const { t } = useTranslation();
  return <main className="p-8">{t("marketplacePlaceholder")}</main>;
}

function page(path: string, pageKey: string): { path: string; element: ReactElement } {
  return { path, element: path === "inventory" ? <InventoryPage /> : <PlaceholderPage pageKey={pageKey} /> };
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/market", element: <MarketplacePage /> },
  { path: "/login", element: <Suspense fallback={<RouteLoading />}><LoginPage /></Suspense> },
  { path: "/register", element: <Suspense fallback={<RouteLoading />}><RegisterPage /></Suspense> },
  {
    element: <Suspense fallback={<RouteLoading />}><AuthGuard /></Suspense>,
    children: [
      {
        path: "/farmer",
        element: <Suspense fallback={<RouteLoading />}><FarmerLayout /></Suspense>,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          ...FARMER_PAGES.map(([path, pageKey]) => page(path, pageKey)),
        ],
      },
      {
        path: "/buyer",
        element: <Suspense fallback={<RouteLoading />}><BuyerLayout /></Suspense>,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          ...BUYER_PAGES.map(([path, pageKey]) => page(path, pageKey)),
        ],
      },
    ],
  },
]);
