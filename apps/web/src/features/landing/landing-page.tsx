import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";

import { LanguageSwitcher } from "../../components/language-switcher.js";
import { DemoModeBadge } from "../../components/demo-mode-badge.js";
import { BrandLogo } from "../../components/brand-logo.js";
import { useOptionalAuth } from "../auth/auth-context.js";

export function LandingPage(): ReactElement {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const { t } = useTranslation();

  // Task 8.12: Logged-in users are redirected to their dashboards
  if (user) {
    if (user.role === "FARMER") {
      return <Navigate to="/farmer/dashboard" replace />;
    }
    if (user.role === "BUYER") {
      return <Navigate to="/buyer/dashboard" replace />;
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-foreground flex flex-col overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <BrandLogo className="h-9 w-9 rounded-lg object-contain shadow-xs" />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {t("appName")}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <DemoModeBadge />
            <LanguageSwitcher />
            <Link
              to="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {t("landing.loginLink")}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Landmark */}
      <main className="flex-1">
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-28 text-center bg-gradient-to-b from-white to-stone-50">
          <div className="mx-auto max-w-4xl">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {t("landing.badge")}
            </span>

            <h1
              id="hero-heading"
              className="mt-6 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl leading-tight"
            >
              {t("landing.heading")}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-stone-600 leading-relaxed">
              {t("landing.subheading")}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                to="/register?role=FARMER"
                data-testid="landing-cta-farmer"
                className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {t("landing.farmerCta")}
              </Link>
              <Link
                to="/register?role=BUYER"
                data-testid="landing-cta-buyer"
                className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center rounded-lg border border-primary bg-white px-6 py-3 text-base font-semibold text-primary shadow-sm hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {t("landing.buyerCta")}
              </Link>
              <Link
                to="/market"
                data-testid="landing-cta-marketplace"
                className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center rounded-lg border border-stone-300 bg-stone-100 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {t("landing.browseMarketCTA")}
              </Link>
            </div>
          </div>
        </section>

        {/* 3-Step Workflows Section */}
        <section aria-labelledby="workflow-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 id="workflow-heading" className="sr-only">
            How BazarBeat Works
          </h2>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Farmer 3-Step Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold text-lg">
                  🌾
                </span>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">
                    {t("landing.farmerSectionTitle")}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {t("landing.farmerSectionSubtitle")}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-6">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {t("landing.farmerStep1Title")}
                    </h4>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      {t("landing.farmerStep1Desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {t("landing.farmerStep2Title")}
                    </h4>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      {t("landing.farmerStep2Desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {t("landing.farmerStep3Title")}
                    </h4>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      {t("landing.farmerStep3Desc")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-stone-100">
                <Link
                  to="/register?role=FARMER"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  {t("landing.farmerCta")}
                </Link>
              </div>
            </div>

            {/* Buyer 3-Step Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-bold text-lg">
                  🛒
                </span>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">
                    {t("landing.buyerSectionTitle")}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {t("landing.buyerSectionSubtitle")}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-6">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-800 font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {t("landing.buyerStep1Title")}
                    </h4>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      {t("landing.buyerStep1Desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-800 font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {t("landing.buyerStep2Title")}
                    </h4>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      {t("landing.buyerStep2Desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-800 font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {t("landing.buyerStep3Title")}
                    </h4>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      {t("landing.buyerStep3Desc")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-stone-100">
                <Link
                  to="/register?role=BUYER"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                >
                  {t("landing.buyerCta")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Existing User Login Banner */}
        <section aria-label="Sign In" className="border-t border-stone-200 bg-white px-4 py-12 text-center">
          <div className="mx-auto max-w-md">
            <p className="text-sm text-stone-600">
              {t("landing.loginPrompt")}
            </p>
            <Link
              to="/login"
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-6 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {t("landing.loginLink")}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer Landmark */}
      <footer className="border-t border-stone-200 bg-stone-100 px-4 py-8 text-center text-xs text-stone-500">
        <p>© 2026 BazarBeat. {t("tagline")}</p>
      </footer>
    </div>
  );
}
