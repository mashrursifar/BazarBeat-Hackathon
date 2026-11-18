import type { NotificationItem, NotificationListResponse } from "@bazarbeat/shared";
import {
  type ReactElement,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/auth-context.js";
import { getNotificationTargetRoute } from "./notification-routing.js";
import { renderNotificationText } from "./notification-text.js";

export interface ActiveToast {
  id: string;
  notification: NotificationItem;
  title: string;
  body: string;
}

export interface NotificationContextValue {
  unreadCount: number;
  recentNotifications: NotificationItem[];
  loading: boolean;
  toasts: ActiveToast[];
  markRead: (input: { ids?: string[]; all?: boolean }) => Promise<void>;
  dismissToast: (toastId: string) => void;
  handleClickNotification: (notification: NotificationItem) => Promise<void>;
  refetchUnread: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const userRef = useRef(user);
  userRef.current = user;

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const fetchRecent = useCallback(async () => {
    if (!userRef.current) return;
    try {
      setLoading(true);
      const res = await fetch("/api/v1/notifications?limit=8", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const body = (await res.json()) as NotificationListResponse;
        setRecentNotifications(body.data);
        setUnreadCount(body.meta.unreadCount);
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(
    async (input: { ids?: string[]; all?: boolean }) => {
      if (!userRef.current) return;
      try {
        const res = await fetch("/api/v1/notifications/read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Protection": "1",
          },
          body: JSON.stringify(input),
        });

        if (res.ok) {
          const body = (await res.json()) as { data: { unreadCount: number } };
          setUnreadCount(body.data.unreadCount);

          if (input.all) {
            setRecentNotifications((prev) =>
              prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
            );
          } else if (input.ids && input.ids.length > 0) {
            const idSet = new Set(input.ids);
            setRecentNotifications((prev) =>
              prev.map((n) =>
                idSet.has(n.id)
                  ? { ...n, isRead: true, readAt: new Date().toISOString() }
                  : n,
              ),
            );
          }
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleClickNotification = useCallback(
    async (notification: NotificationItem) => {
      if (!userRef.current) return;
      if (!notification.isRead) {
        void markRead({ ids: [notification.id] });
      }
      const targetRoute = getNotificationTargetRoute(notification, userRef.current.role);
      navigate(targetRoute);
    },
    [markRead, navigate],
  );

  // Single shared /me/stream connection per tab with 30-second polling fallback (Gap 5)
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setRecentNotifications([]);
      setToasts([]);
      return;
    }

    // Initial fetch
    void fetchRecent();

    let eventSource: EventSource | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let isConnected = false;

    function startPollingFallback(): void {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        void fetchRecent();
      }, 30000); // 30s polling fallback per Gap 5
    }

    function stopPollingFallback(): void {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    try {
      eventSource = new EventSource("/api/v1/me/stream", { withCredentials: true });

      eventSource.addEventListener("snapshot", (event) => {
        isConnected = true;
        stopPollingFallback();
        try {
          const payload = JSON.parse(event.data) as { unreadCount: number };
          setUnreadCount(payload.unreadCount);
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener("notification.created", (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            notification: NotificationItem;
            unreadCount: number;
          };
          setUnreadCount(payload.unreadCount);
          setRecentNotifications((prev) => [
            payload.notification,
            ...prev.filter((n) => n.id !== payload.notification.id).slice(0, 7),
          ]);

          // Gap 6 Toast Suppression Rule:
          // A notification toast is suppressed when the user is currently viewing the notification's listing or order
          const currentPath = locationRef.current;
          const entityId = payload.notification.entityRef.id;
          const isViewingEntity = Boolean(entityId && currentPath.includes(entityId));

          if (!isViewingEntity) {
            const { title, body } = renderNotificationText(
              payload.notification,
              t,
              i18n.language,
            );
            const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setToasts((prev) => [...prev, { id: toastId, notification: payload.notification, title, body }]);

            // Auto-dismiss after 5s
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 5000);
          }
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener("notification.updated", (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            notification: NotificationItem;
            unreadCount: number;
          };
          setUnreadCount(payload.unreadCount);
          setRecentNotifications((prev) => [
            payload.notification,
            ...prev.filter((n) => n.id !== payload.notification.id).slice(0, 7),
          ]);

          // Gap 6 Rule: Updates to a coalesced notification never re-toast.
        } catch {
          // ignore
        }
      });

      eventSource.onerror = () => {
        isConnected = false;
        startPollingFallback();
      };
    } catch {
      startPollingFallback();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      stopPollingFallback();
    };
  }, [user, fetchRecent, t, i18n.language]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        recentNotifications,
        loading,
        toasts,
        markRead,
        dismissToast,
        handleClickNotification,
        refetchUnread: fetchRecent,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

const defaultContextValue: NotificationContextValue = {
  unreadCount: 0,
  recentNotifications: [],
  loading: false,
  toasts: [],
  markRead: async () => {},
  dismissToast: () => {},
  handleClickNotification: async () => {},
  refetchUnread: async () => {},
};

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  return context ?? defaultContextValue;
}
