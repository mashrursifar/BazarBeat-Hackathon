import { type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  change?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
  "data-testid"?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  change,
  action,
  className = "",
  icon,
  "data-testid": testId,
}: StatCardProps): ReactElement {
  return (
    <div
      data-testid={testId}
      className={`flex min-w-0 flex-col justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {(change || action) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2">
          {change && <div>{change}</div>}
          {action && <div>{action}</div>}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }): ReactElement {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center">
      <p>{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
      <p>{t("inventory.loadError")}</p>
      <button
        className="mt-3 min-h-11 rounded border border-red-300 px-3 font-semibold"
        onClick={onRetry}
      >
        {t("inventory.retry")}
      </button>
    </div>
  );
}

export function DataTable({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): ReactElement {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}
