import { NotificationType, UserRole } from "@bazarbeat/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "./components/notification-bell.js";
import * as NotificationContextModule from "./notification-context.js";
import * as AuthContextModule from "../auth/auth-context.js";
import "../../lib/i18n.js";

describe("NotificationBell Component (Task 8.6)", () => {
  const markReadMock = vi.fn().mockResolvedValue(undefined);
  const handleClickNotificationMock = vi.fn().mockResolvedValue(undefined);
  const refetchUnreadMock = vi.fn().mockResolvedValue(undefined);
  const dismissToastMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: "user-1",
        name: "Farmer User",
        role: UserRole.FARMER,
        division: "dhaka",
        district: "gazipur",
        language: "en",
      },
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      setUser: vi.fn(),
      retry: vi.fn(),
    });
  });

  function setupBell(unreadCount: number, recentCount = 0) {
    const recentNotifications = [];
    for (let i = 1; i <= recentCount; i++) {
      recentNotifications.push({
        id: `notif-${i}`,
        userId: "user-1",
        type: NotificationType.NEW_BID,
        title: `New bid #${i}`,
        body: `Details for bid #${i}`,
        params: {
          listingId: `list-${i}`,
          cropSlug: "potato",
          currentBidPerKg: 3000 + i * 100,
          bidCount: i,
        },
        entityRef: { kind: "listing" as const, id: `list-${i}` },
        isRead: i > unreadCount,
        readAt: null,
        dedupeKey: `key-${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    vi.spyOn(NotificationContextModule, "useNotifications").mockReturnValue({
      unreadCount,
      recentNotifications,
      loading: false,
      toasts: [],
      markRead: markReadMock,
      dismissToast: dismissToastMock,
      handleClickNotification: handleClickNotificationMock,
      refetchUnread: refetchUnreadMock,
    });

    return render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
  }

  it("hides badge when unreadCount is 0", () => {
    setupBell(0);
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("shows exact count when unreadCount is between 1 and 99", () => {
    setupBell(7);
    const badge = screen.getByTestId("notification-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("7");
  });

  it("caps badge at 99+ when unreadCount exceeds 99", () => {
    setupBell(125);
    const badge = screen.getByTestId("notification-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("99+");
  });

  it("toggles popover on click and renders latest items and mark all read button", () => {
    setupBell(2, 3);
    const button = screen.getByTestId("notification-bell-button");
    expect(screen.queryByTestId("notification-popover")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByTestId("notification-popover")).toBeInTheDocument();

    // Mark all read button visible because unreadCount > 0
    const markAllBtn = screen.getByTestId("mark-all-read-button");
    expect(markAllBtn).toBeInTheDocument();

    fireEvent.click(markAllBtn);
    expect(markReadMock).toHaveBeenCalledWith({ all: true });

    // Renders items
    expect(screen.getByTestId("notification-item-notif-1")).toBeInTheDocument();
    expect(screen.getByTestId("notification-item-notif-2")).toBeInTheDocument();

    // Clicking an item calls handleClickNotification
    fireEvent.click(screen.getByTestId("notification-item-notif-1"));
    expect(handleClickNotificationMock).toHaveBeenCalled();
  });

  it("closes popover when Escape key is pressed", () => {
    setupBell(1, 1);
    const button = screen.getByTestId("notification-bell-button");
    fireEvent.click(button);
    expect(screen.getByTestId("notification-popover")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("notification-popover")).not.toBeInTheDocument();
  });
});
