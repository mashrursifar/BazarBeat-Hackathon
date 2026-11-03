import { type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function StatCard({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return <div className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-words text-xl font-bold">{value}</p></div>;
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }): ReactElement {
  return <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center"><p>{title}</p>{action && <div className="mt-3">{action}</div>}</div>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  const { t } = useTranslation();
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert"><p>{t("inventory.loadError")}</p><button className="mt-3 min-h-11 rounded border border-red-300 px-3 font-semibold" onClick={onRetry}>{t("inventory.retry")}</button></div>;
}

export function DataTable({ children, label }: { children: ReactNode; label: string }): ReactElement {
  return <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white"><table className="w-full min-w-[34rem] text-left text-sm"><caption className="sr-only">{label}</caption>{children}</table></div>;
}
