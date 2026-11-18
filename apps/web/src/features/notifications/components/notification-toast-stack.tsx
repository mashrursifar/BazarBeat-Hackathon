import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../notification-context.js";

/**
 * Global toast notification stack (Task 8.6 / Gap 6).
 * Renders real-time notification alerts, auto-dismisses after 5 seconds,
 * supports click-to-navigate and manual dismiss, and respects reduced-motion.
 */
export function NotificationToastStack(): ReactElement | null {
  const { toasts, dismissToast, handleClickNotification } = useNotifications();
  const { t } = useTranslation();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none"
      role="region"
      aria-label={t("notifications.title")}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid="notification-toast"
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-primary/20 bg-white p-3 shadow-lg transition-all duration-200 motion-reduce:transition-none"
          role="alert"
        >
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => {
              dismissToast(toast.id);
              void handleClickNotification(toast.notification);
            }}
          >
            <p className="text-sm font-semibold text-foreground">{toast.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{toast.body}</p>
          </button>
          <button
            type="button"
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
            onClick={() => dismissToast(toast.id)}
            aria-label={t("notifications.dismiss")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
