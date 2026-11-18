import {
  type NotificationItem,
  NotificationType,
  UserRole,
} from "@bazarbeat/shared";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import React, { type ReactElement, type ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as AuthContextModule from "../auth/auth-context.js";
import {
  NotificationProvider,
  useNotifications,
} from "./notification-context.js";
import "../../lib/i18n.js";

class MockEventSource {
  public static instances: MockEventSource[] = [];
  public url: string;
  public withCredentials?: boolean;
  public readyState = 0;
  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  public listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials;
    MockEventSource.instances.push(this);
  }

  public addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  public close(): void {
    this.readyState = 2;
  }

  public emit(type: string, data: unknown): void {
    const serialized = typeof data === "string" ? data : JSON.stringify(data);
    const set = this.listeners.get(type);
    if (set) {
      set.forEach((listener) => {
        listener(new MessageEvent(type, { data: serialized }));
      });
    }
  }

  public triggerError(): void {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

const mockUser = {
  id: "user-1",
  name: "Farmer User",
  role: UserRole.FARMER,
  division: "dhaka",
  district: "gazipur",
  upazila: "gazipur-sadar",
  language: "en" as const,
};

const makeNotificationItem = (id = "notif-1", entityId = "507f1f77bcf86cd799439011"): NotificationItem => ({
  id,
  userId: "user-1",
  type: NotificationType.NEW_BID,
  title: "New bid on Potato",
  body: "Someone placed a bid of ৳35.00 per kg.",
  params: {
    listingId: entityId,
    cropSlug: "potato",
    currentBidPerKg: 3500,
    bidCount: 1,
  },
  entityRef: { kind: "listing", id: entityId },
  isRead: false,
  readAt: null,
  dedupeKey: `key-${id}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("NotificationContext & Provider (Task 8.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockUser,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      setUser: vi.fn(),
      retry: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches recent notifications and connects to /api/v1/me/stream on mount", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [makeNotificationItem("notif-10")],
        meta: { unreadCount: 1, total: 1, page: 1, limit: 8, totalPages: 1 },
      }),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications?limit=8",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0]!.url).toBe("/api/v1/me/stream");
  });

  it("handles SSE snapshot to update unread count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { unreadCount: 0, total: 0, page: 1, limit: 8, totalPages: 1 },
      }),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0]!;

    act(() => {
      es.emit("snapshot", { unreadCount: 5 });
    });

    expect(result.current.unreadCount).toBe(5);
  });

  it("adds toast on notification.created when user is on an unrelated route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { unreadCount: 0, total: 0, page: 1, limit: 8, totalPages: 1 },
      }),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0]!;
    const notif = makeNotificationItem("notif-1", "507f1f77bcf86cd799439011");

    act(() => {
      es.emit("notification.created", {
        notification: notif,
        unreadCount: 1,
      });
    });

    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0]!.notification.id).toBe("notif-1");
    expect(result.current.unreadCount).toBe(1);
  });

  it("Gap 6 Toast Suppression: suppresses toast when current route matches entityRef.id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { unreadCount: 0, total: 0, page: 1, limit: 8, totalPages: 1 },
      }),
    } as Response);

    const targetEntityId = "507f1f77bcf86cd799439011";

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={[`/farmer/listings/${targetEntityId}`]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0]!;
    const notif = makeNotificationItem("notif-1", targetEntityId);

    act(() => {
      es.emit("notification.created", {
        notification: notif,
        unreadCount: 1,
      });
    });

    // Toast MUST be suppressed because user is viewing the entity
    expect(result.current.toasts.length).toBe(0);
    // But unread count and recent notifications are updated
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.recentNotifications[0]!.id).toBe("notif-1");
  });

  it("Gap 6 Rule: notification.updated never creates a toast", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [makeNotificationItem("notif-1")],
        meta: { unreadCount: 1, total: 1, page: 1, limit: 8, totalPages: 1 },
      }),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0]!;
    const updatedNotif = {
      ...makeNotificationItem("notif-1"),
      params: {
        listingId: "507f1f77bcf86cd799439011",
        cropSlug: "potato",
        currentBidPerKg: 3800,
        bidCount: 2,
      },
    };

    act(() => {
      es.emit("notification.updated", {
        notification: updatedNotif,
        unreadCount: 1,
      });
    });

    // No toast created for coalesced update
    expect(result.current.toasts.length).toBe(0);
    const params = result.current.recentNotifications[0]!.params as { currentBidPerKg: number };
    expect(params.currentBidPerKg).toBe(3800);
  });

  it("handles markRead by sending request and updating state", async () => {
    const initialItem = makeNotificationItem("notif-1");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [initialItem],
          meta: { unreadCount: 1, total: 1, page: 1, limit: 8, totalPages: 1 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { unreadCount: 0 },
        }),
      } as Response);

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    await act(async () => {
      await result.current.markRead({ all: true });
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.recentNotifications[0]!.isRead).toBe(true);
  });

  it("falls back to polling on EventSource error", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { unreadCount: 0, total: 0, page: 1, limit: 8, totalPages: 1 },
      }),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    );

    renderHook(() => useNotifications(), { wrapper });

    // Initial fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const es = MockEventSource.instances[0]!;

    // Simulate EventSource disconnect / error
    act(() => {
      es.triggerError();
    });

    // Advance 30 seconds for polling fallback
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
