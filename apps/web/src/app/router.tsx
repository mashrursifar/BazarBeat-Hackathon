import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { Link, createBrowserRouter } from "react-router-dom";

function HomePage(): ReactElement {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{t("appName")}</p>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-foreground sm:text-6xl">
        {t("tagline")}
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("introduction")}</p>
      <Link className="mt-8 w-fit rounded-md bg-primary px-5 py-3 font-semibold text-white" to="/market">
        {t("exploreMarketplace")}
      </Link>
    </main>
  );
}

function MarketplacePage(): ReactElement {
  const { t } = useTranslation();
  return <main className="p-8">{t("marketplacePlaceholder")}</main>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  { path: "/market", element: <MarketplacePage /> },
]);
