import { UserRole, type UserRole as UserRoleType } from "@bazarbeat/shared";
import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { LanguageSwitcher } from "../components/language-switcher.js";
import { DemoModeBadge } from "../components/demo-mode-badge.js";
import { useAuth } from "../features/auth/auth-context.js";
import { CompareTrayProvider } from "../features/marketplace/context/compare-tray-context.js";
import { NotificationBell } from "../features/notifications/components/notification-bell.js";
import { NotificationToastStack } from "../features/notifications/components/notification-toast-stack.js";
import { NotificationProvider } from "../features/notifications/notification-context.js";

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
  return (
    <NotificationProvider>
      <Outlet />
      <NotificationToastStack />
    </NotificationProvider>
  );
}

export function FarmerLayout(): ReactElement {
  return <RoleLayout role={UserRole.FARMER} />;
}

export function BuyerLayout(): ReactElement {
  return (
    <CompareTrayProvider>
      <RoleLayout role={UserRole.BUYER} />
    </CompareTrayProvider>
  );
}

function RoleLayout({ role }: { role: UserRoleType }): ReactElement {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [signOutError, setSignOutError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return (): void => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  if (user === null) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === UserRole.FARMER ? "/farmer/dashboard" : "/buyer/dashboard"} replace />;
  }

  const items = role === UserRole.FARMER ? FARMER_NAV : BUYER_NAV;
  const title = role === UserRole.FARMER ? t("roles.FARMER") : t("roles.BUYER");
  const basePath = role === UserRole.FARMER ? "/farmer" : "/buyer";

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
      {/* Desktop Sidebar: persistent on md+ */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-stone-200 md:bg-white md:p-5 md:min-h-screen">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg shadow-sm">
            B
          </span>
          <Link className="text-xl font-extrabold text-primary" to="/">
            {t("appName")}
          </Link>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 border border-stone-200/70">
          <span className="text-sm font-semibold text-stone-800">{title}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {role}
          </span>
        </div>
        <nav className="mt-4 flex flex-col gap-1" aria-label={t("navigation")}>
          {items.map((item, index) => {
            const showSectionHeader =
              item.section && (index === 0 || items[index - 1]?.section !== item.section);
            return (
              <div key={item.path} className="flex flex-col">
                {showSectionHeader && (
                  <div
                    data-testid={`sidebar-section-${item.section}`}
                    className="pt-3 pb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {t(`nav.${item.section}`)}
                  </div>
                )}
                <NavLink
                  to={`${basePath}/${item.path}`}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center rounded-md px-3 text-sm transition-colors ${
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

      {/* Main Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Responsive Header */}
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-stone-200 bg-white/95 backdrop-blur-sm px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile hamburger menu toggle */}
            <button
              type="button"
              data-testid="mobile-menu-button"
              aria-label={isMobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary md:hidden"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Mobile Brand Link */}
            <Link to="/" className="flex items-center gap-2 md:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-base shadow-sm">
                B
              </span>
              <span className="text-lg font-bold text-primary">{t("appName")}</span>
            </Link>

            {/* Desktop user title info */}
            <div className="hidden md:flex md:items-center md:gap-2">
              <span className="font-semibold text-foreground">{user.name}</span>
              <span className="text-sm text-muted-foreground">• {title}</span>
              <DemoModeBadge />
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="md:hidden">
              <DemoModeBadge />
            </div>
            <NotificationBell />
            <LanguageSwitcher />
            <button
              type="button"
              className="hidden md:inline-flex min-h-11 items-center rounded px-3 text-sm font-semibold text-primary underline focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => void handleSignOut()}
            >
              {t("auth.logout")}
            </button>
          </div>
        </header>

        {/* Sign out error banner */}
        {signOutError && (
          <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {t("auth.logoutError")}
          </p>
        )}

        {/* Mobile Slide-In Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            data-testid="mobile-nav-drawer"
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t("navigation")}
          >
            {/* Backdrop */}
            <div
              data-testid="mobile-nav-backdrop"
              className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Container */}
            <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between bg-white shadow-2xl z-50">
              <div className="flex flex-col p-4 overflow-y-auto">
                {/* Header in Drawer */}
                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-base shadow-sm">
                      B
                    </span>
                    <span className="text-lg font-extrabold text-primary">{t("appName")}</span>
                  </div>
                  <button
                    type="button"
                    data-testid="mobile-menu-close-button"
                    aria-label={t("nav.closeMenu")}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* User info card in drawer */}
                <div className="mt-3 rounded-lg bg-stone-50 p-3 border border-stone-200/70">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground truncate">{user.name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {title}
                    </span>
                  </div>
                  {user.division && (
                    <p className="mt-1 text-xs text-muted-foreground capitalize">
                      {[user.district, user.division].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>

                {/* Nav Items in Drawer */}
                <nav className="mt-4 flex flex-col gap-1" aria-label={t("navigation")}>
                  {items.map((item, index) => {
                    const showSectionHeader =
                      item.section && (index === 0 || items[index - 1]?.section !== item.section);
                    return (
                      <div key={item.path} className="flex flex-col">
                        {showSectionHeader && (
                          <div
                            data-testid={`mobile-sidebar-section-${item.section}`}
                            className="pt-3 pb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                          >
                            {t(`nav.${item.section}`)}
                          </div>
                        )}
                        <NavLink
                          to={`${basePath}/${item.path}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex min-h-11 items-center rounded-md px-3 text-sm transition-colors ${
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
              </div>

              {/* Drawer Footer with Logout */}
              <div className="border-t border-stone-200 p-4 bg-stone-50/60">
                <button
                  type="button"
                  data-testid="mobile-drawer-logout"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    void handleSignOut();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t("auth.logout")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PlaceholderPage({ pageKey }: { pageKey: string }): ReactElement {
  const { t } = useTranslation();
  return <section><h1 className="text-2xl font-bold sm:text-3xl">{t(`nav.${pageKey}`)}</h1><p className="mt-2 text-muted-foreground">{t("auth.pagePlaceholder")}</p></section>;
}
