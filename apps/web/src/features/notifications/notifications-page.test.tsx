import { NotificationType } from "@bazarbeat/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NotificationsPage from "./notifications-page.js";
import * as NotificationContextModule from "./notification-context.js";
import "../../lib/i18n.js";

const mockNotificationItem = {
  id: "notif-1",
  userId: "user-1",
  type: NotificationType.NEW_BID,
  title: "New bid on Potato",
  body: "Someone placed a bid of ৳35.00 per kg.",
  params: {
    listingId: "507f1f77bcf86cd799439011",
    cropSlug: "potato",
    currentBidPerKg: 3500,
    bidCount: 2,
  },
  entityRef: { kind: "listing" as const, id: "507f1f77bcf86cd799439011" },
  isRead: false,
  readAt: null,
  dedupeKey: "key-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("NotificationsPage Component (Task 8.6)", () => {
  const markReadMock = vi.fn().mockResolvedValue(undefined);
  const handleClickNotificationMock = vi.fn().mockResolvedValue(undefined);
  const refetchUnreadMock = vi.fn().mockResolvedValue(undefined);
  const dismissToastMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(NotificationContextModule, "useNotifications").mockReturnValue({
      unreadCount: 3,
      recentNotifications: [mockNotificationItem],
      loading: false,
      toasts: [],
      markRead: markReadMock,
      handleClickNotification: handleClickNotificationMock,
      dismissToast: dismissToastMock,
      refetchUnread: refetchUnreadMock,
    });
  });

  it("renders notifications list and handles notification click", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockNotificationItem],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }),
    } as Response);

    render(<NotificationsPage />);

    expect(screen.getByRole("status")).toHaveTextContent(/Loading/i);

    await waitFor(() => {
      expect(screen.getByTestId("page-notification-item-notif-1")).toBeInTheDocument();
    });

    expect(screen.getByText("New bid on Potato")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("page-notification-item-notif-1"));
    expect(handleClickNotificationMock).toHaveBeenCalledWith(mockNotificationItem);
  });

  it("switches tabs between All and Unread, fetching with unreadOnly", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [mockNotificationItem],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      } as Response);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-notification-item-notif-1")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications?page=1&limit=20",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );

    fireEvent.click(screen.getByTestId("tab-unread"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/notifications?page=1&limit=20&unreadOnly=true",
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("empty-notifications")).toHaveTextContent(
        /No unread notifications/i,
      );
    });
  });

  it("renders empty state when there are no notifications in All tab", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      }),
    } as Response);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-notifications")).toHaveTextContent(
        /No notifications yet/i,
      );
    });
  });

  it("handles pagination next and previous controls", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [mockNotificationItem],
          meta: { total: 35, page: 1, limit: 20, totalPages: 2 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ ...mockNotificationItem, id: "notif-2" }],
          meta: { total: 35, page: 2, limit: 20, totalPages: 2 },
        }),
      } as Response);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("next-page-button")).toBeEnabled();
    });

    expect(screen.getByTestId("prev-page-button")).toBeDisabled();

    fireEvent.click(screen.getByTestId("next-page-button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/notifications?page=2&limit=20",
        expect.any(Object),
      );
    });
  });

  it("triggers mark all read when button is clicked", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [mockNotificationItem],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ ...mockNotificationItem, isRead: true }],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      } as Response);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-mark-all-read")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("page-mark-all-read"));

    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledWith({ all: true });
    });
  });
});
