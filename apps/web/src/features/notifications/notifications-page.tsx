import type { NotificationItem, NotificationListResponse } from "@bazarbeat/shared";
import { type ReactElement, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { toBanglaDigits } from "../../lib/format.js";
import { useNotifications } from "./notification-context.js";
import { renderNotificationText } from "./notification-text.js";

type TabMode = "all" | "unread";

/**
 * Full Notifications Page (Task 8.6).
 * Supports All and Unread tabs, pagination, mark all read, and click-to-navigate.
 */
export default function NotificationsPage(): ReactElement {
  const { unreadCount, markRead, handleClickNotification } = useNotifications();
  const { t, i18n } = useTranslation();

  const [tab, setTab] = useState<TabMode>("all");
  const [page, setPage] = useState<number>(1);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isBangla = i18n.language === "bn";

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const unreadParam = tab === "unread" ? "&unreadOnly=true" : "";
      const res = await fetch(`/api/v1/notifications?page=${page}&limit=20${unreadParam}`, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to load notifications: ${res.status}`);
      }

      const body = (await res.json()) as NotificationListResponse;
      setNotifications(body.data);
      setTotalPages(body.meta.totalPages);
      setTotalCount(body.meta.total);
    } catch {
      setError(t("auth.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tab, page, t]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const handleTabChange = (newTab: TabMode): void => {
    setTab(newTab);
    setPage(1);
  };

  const handleMarkAllRead = async (): Promise<void> => {
    await markRead({ all: true });
    void fetchPage();
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-foreground">
            {t("notifications.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "all" ? t("notifications.allTab") : t("notifications.unreadTab")}:{" "}
            {isBangla ? toBanglaDigits(totalCount) : totalCount}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            data-testid="page-mark-all-read"
            onClick={() => void handleMarkAllRead()}
            className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-green-50"
          >
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          type="button"
          data-testid="tab-all"
          onClick={() => handleTabChange("all")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("notifications.allTab")}
        </button>
        <button
          type="button"
          data-testid="tab-unread"
          onClick={() => handleTabChange("unread")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "unread"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t("notifications.unreadTab")}</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
              {unreadCount > 99
                ? isBangla
                  ? `${toBanglaDigits(99)}+`
                  : "99+"
                : isBangla
                  ? toBanglaDigits(unreadCount)
                  : String(unreadCount)}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground" role="status">
          {t("notifications.loading")}
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchPage()}
            className="mt-2 font-semibold underline"
          >
            {t("notifications.retry")}
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div
          data-testid="empty-notifications"
          className="rounded-xl border border-dashed border-stone-300 py-16 text-center text-muted-foreground"
        >
          <p className="text-base font-semibold">
            {tab === "all" ? t("notifications.emptyAll") : t("notifications.emptyUnread")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          {notifications.map((notification) => {
            const { title, body } = renderNotificationText(
              notification,
              t,
              i18n.language,
            );

            return (
              <button
                key={notification.id}
                type="button"
                data-testid={`page-notification-item-${notification.id}`}
                onClick={() => void handleClickNotification(notification)}
                className={`flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-stone-50 ${
                  !notification.isRead ? "bg-green-50/40" : ""
                }`}
              >
                {!notification.isRead && (
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className={`text-sm ${
                        !notification.isRead
                          ? "font-bold text-foreground"
                          : "font-medium text-stone-700"
                      }`}
                    >
                      {title}
                    </p>
                    <time className="text-xs text-muted-foreground shrink-0">
                      {new Date(notification.createdAt).toLocaleDateString(
                        isBangla ? "bn-BD" : "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </time>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{body}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            data-testid="prev-page-button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-stone-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {isBangla ? "পূর্ববর্তী" : "Previous"}
          </button>
          <span className="text-xs text-muted-foreground">
            {isBangla ? toBanglaDigits(page) : page} /{" "}
            {isBangla ? toBanglaDigits(totalPages) : totalPages}
          </span>
          <button
            type="button"
            data-testid="next-page-button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-stone-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {isBangla ? "পরবর্তী" : "Next"}
          </button>
        </div>
      )}
    </section>
  );
}
