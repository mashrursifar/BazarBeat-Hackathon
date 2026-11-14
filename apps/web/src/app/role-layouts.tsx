import { UserRole, type UserRole as UserRoleType } from "@bazarbeat/shared";
import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { LanguageSwitcher } from "../components/language-switcher.js";
import { useAuth } from "../features/auth/auth-context.js";

type NavItem = { path: string; key: string; section?: string };
const FARMER_NAV: readonly NavItem[] = [
  { path: "dashboard", key: "dashboard" },
  { path: "products", key: "myListings", section: "products" },
  { path: "new-listing", key: "newListing", section: "products" },
  { path: "crop-bidding", key: "cropBidding" },
  { path: "inventory", key: "inventory" },
  { path: "orders", key: "orders" },
  { path: "sales", key: "sales" },
  { path: "earnings", key: "earnings" },
  { path: "market-prices", key: "marketPrices" },
  { path: "settings", key: "settings" },
];
const BUYER_NAV: readonly NavItem[] = [
  { path: "dashboard", key: "dashboard" },
  { path: "marketplace", key: "marketplace" },
  { path: "compare", key: "compare" },
  { path: "my-bids", key: "myBids" },
  { path: "orders", key: "orders" },
  { path: "watchlist", key: "watchlist" },
  { path: "market-overview", key: "marketOverview" },
  { path: "settings", key: "settings" },
];

export function AuthGuard(): ReactElement {
  const { user, loading, error, retry } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  if (loading) return <main className="p-8" role="status">{t("auth.loading")}</main>;
  if (error !== null) return <main className="mx-auto max-w-lg p-8"><p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{t(error === "SESSION_EXPIRED" ? "errors.UNAUTHENTICATED" : "auth.loadError")}</p>{error === "SESSION_EXPIRED" ? <Link className="font-semibold text-primary underline" to="/login">{t("login.title")}</Link> : <button className="min-h-11 rounded bg-primary px-4 text-white" onClick={retry}>{t("auth.retry")}</button>}</main>;
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function FarmerLayout(): ReactElement {
  return <RoleLayout role={UserRole.FARMER} />;
}

export function BuyerLayout(): ReactElement {
  return <RoleLayout role={UserRole.BUYER} />;
}

function RoleLayout({ role }: { role: UserRoleType }): ReactElement {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [signOutError, setSignOutError] = useState(false);
  if (user === null) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard"} replace />;
  const items = role === UserRole.FARMER ? FARMER_NAV : BUYER_NAV;
  const title = role === UserRole.FARMER ? t("roles.FARMER") : t("roles.BUYER");
  async function handleSignOut(): Promise<void> {
    setSignOutError(false);
    try {
      await signOut();
    } catch {
      setSignOutError(true);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 md:flex">
      <aside className="w-full shrink-0 border-b border-stone-200 bg-white p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:p-5">
        <Link className="text-xl font-extrabold text-primary" to="/">{t("appName")}</Link>
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <nav className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-1" aria-label={t("navigation")}>
          {items.map((item, index) => {
            const showSectionHeader =
              item.section && (index === 0 || items[index - 1]?.section !== item.section);
            return (
              <div key={item.path} className="contents">
                {showSectionHeader && (
                  <div
                    data-testid={`sidebar-section-${item.section}`}
                    className="col-span-full pt-3 pb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {t(`nav.${item.section}`)}
                  </div>
                )}
                <NavLink
                  to={`${role === UserRole.FARMER ? "/farmer" : "/buyer"}/${item.path}`}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center rounded-md px-3 text-sm ${
                      isActive
                        ? "bg-green-50 font-semibold text-primary"
                        : "text-stone-700 hover:bg-stone-100"
                    }`
                  }
                >
                  {t(`nav.${item.key}`)}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2 sm:px-6">
          <div><span className="font-semibold">{user.name}</span><span className="ml-2 text-sm text-muted-foreground">{title}</span></div>
          <div className="flex items-center gap-2"><LanguageSwitcher /><button className="min-h-11 rounded px-3 text-sm font-semibold text-primary underline" onClick={() => void handleSignOut()}>{t("auth.logout")}</button></div>
        </header>
        {signOutError && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{t("auth.logoutError")}</p>}
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function PlaceholderPage({ pageKey }: { pageKey: string }): ReactElement {
  const { t } = useTranslation();
  return <section><h1 className="text-2xl font-bold sm:text-3xl">{t(`nav.${pageKey}`)}</h1><p className="mt-2 text-muted-foreground">{t("auth.pagePlaceholder")}</p></section>;
}
