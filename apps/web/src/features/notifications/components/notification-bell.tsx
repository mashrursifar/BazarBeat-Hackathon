import { type ReactElement, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/auth-context.js";
import { toBanglaDigits } from "../../../lib/format.js";
import { useNotifications } from "../notification-context.js";
import { renderNotificationText } from "../notification-text.js";

/**
 * Notification Bell with unread count badge (99+ cap) and interactive popover (Task 8.6).
 */
export function NotificationBell(): ReactElement {
  const { user } = useAuth();
  const { unreadCount, recentNotifications, markRead, handleClickNotification } =
    useNotifications();
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isBangla = i18n.language === "bn";
  const displayCount =
    unreadCount > 99
      ? isBangla
        ? `${toBanglaDigits(99)}+`
        : "99+"
      : isBangla
        ? toBanglaDigits(unreadCount)
        : String(unreadCount);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return (): void => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const basePath = user?.role === "FARMER" ? "/farmer" : "/buyer";

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        data-testid="notification-bell-button"
        aria-label={`${t("notifications.title")}${unreadCount > 0 ? ` (${displayCount} ${t("notifications.unreadTab")})` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute top-0 right-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm"
          >
            {displayCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="notification-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-stone-200 bg-white shadow-xl z-50 overflow-hidden"
          role="region"
          aria-label={t("notifications.title")}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 bg-stone-50">
            <h2 className="text-sm font-bold text-foreground">
              {t("notifications.title")}
              {unreadCount > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({displayCount})
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="mark-all-read-button"
                onClick={() => void markRead({ all: true })}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
            {recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t("notifications.emptyAll")}
              </div>
            ) : (
              recentNotifications.slice(0, 8).map((notification) => {
                const { title, body } = renderNotificationText(
                  notification,
                  t,
                  i18n.language,
                );
                return (
                  <button
                    key={notification.id}
                    type="button"
                    data-testid={`notification-item-${notification.id}`}
                    onClick={() => {
                      setIsOpen(false);
                      void handleClickNotification(notification);
                    }}
                    className={`flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-stone-50 ${
                      !notification.isRead ? "bg-green-50/40" : ""
                    }`}
                  >
                    {!notification.isRead && (
                      <span
                        data-testid="unread-dot"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs sm:text-sm ${!notification.isRead ? "font-bold text-foreground" : "font-medium text-stone-700"}`}>
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {body}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Popover Footer */}
          <div className="border-t border-stone-100 p-2 text-center bg-stone-50">
            <Link
              to={`${basePath}/notifications`}
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("notifications.viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
