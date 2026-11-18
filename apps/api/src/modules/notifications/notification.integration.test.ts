import http from "node:http";
import type { AddressInfo } from "node:net";
import { ObjectId } from "bson";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationType,
  OrderSubEvent,
  type PublicUser,
  UserRole,
} from "@bazarbeat/shared";

const userAId = new ObjectId().toString();
const userBId = new ObjectId().toString();

const sessionUsers: Record<string, PublicUser> = {
  userA: {
    id: userAId,
    role: UserRole.FARMER,
    name: "Farmer User A",
    division: "dhaka",
    district: "gazipur",
    language: "en",
  },
  userB: {
    id: userBId,
    role: UserRole.BUYER,
    name: "Buyer User B",
    division: "dhaka",
    district: "dhaka",
    language: "en",
  },
};

const { authenticateAccessTokenMock } = vi.hoisted(() => ({
  authenticateAccessTokenMock: vi.fn<(token: string) => Promise<PublicUser>>(),
}));

vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return { ...actual, authenticateAccessToken: authenticateAccessTokenMock };
});

import { app } from "../../app.js";
import { TestClock, resetClock, setClock } from "../../shared/clock.js";
import {
  DomainEventEmitter,
  resetDomainEventEmitter,
  setDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { Notification } from "./notification.model.js";
import { createOrCoalesceNotification } from "./notification.service.js";
import {
  UserStreamHub,
  resetUserStreamHub,
  setUserStreamHub,
} from "../realtime/user-stream-hub.js";

interface ParsedSseEvent {
  event?: string;
  data?: unknown;
  comment?: string;
  raw: string;
}

interface StreamConnection {
  req: http.ClientRequest;
  events: ParsedSseEvent[];
  waitForEvent: (eventName: string, timeoutMs?: number) => Promise<ParsedSseEvent>;
  close: () => Promise<void>;
}

let mongoReplSet: MongoMemoryReplSet | undefined;
let testClock: TestClock;
let eventEmitter: DomainEventEmitter;
let streamHub: UserStreamHub;
let server: http.Server;
let baseUrl: string;

describe("Notification Endpoints & User Stream (Task 8.4)", () => {
  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(mongoReplSet.getUri());
    await Notification.init();

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    authenticateAccessTokenMock.mockImplementation(async (token) => {
      const user = sessionUsers[token];
      if (user === undefined) throw new Error("Unexpected test access token");
      return user;
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    if (mongoReplSet) {
      await mongoReplSet.stop();
    }
  });

  beforeEach(async () => {
    await Notification.deleteMany({});

    testClock = new TestClock(new Date("2026-11-18T10:00:00.000Z"));
    setClock(testClock);

    eventEmitter = new DomainEventEmitter();
    setDomainEventEmitter(eventEmitter);

    streamHub = new UserStreamHub({
      eventEmitter,
      defaultHeartbeatIntervalMs: 20000,
      maxStreamsPerUser: 6,
    });
    setUserStreamHub(streamHub);
  });

  afterEach(() => {
    streamHub.destroy();
    resetUserStreamHub();
    resetDomainEventEmitter();
    resetClock();
  });

  function connectToUserStream(token: string): Promise<StreamConnection> {
    return new Promise((resolve, reject) => {
      const url = `${baseUrl}/api/v1/me/stream`;
      const events: ParsedSseEvent[] = [];
      const listeners: Array<(event: ParsedSseEvent) => void> = [];
      let buffer = "";

      const req = http.get(
        url,
        {
          headers: {
            Cookie: `accessToken=${token}`,
            Accept: "text/event-stream",
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Stream connection failed with HTTP ${res.statusCode}`));
            return;
          }

          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            buffer += chunk;
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.trim()) continue;
              const lines = part.split("\n");
              let currentEvent: string | undefined;
              let currentData: unknown = undefined;
              let currentComment: string | undefined;

              for (const line of lines) {
                if (line.startsWith(":")) {
                  currentComment = line.slice(1).trim();
                } else if (line.startsWith("event:")) {
                  currentEvent = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  const rawData = line.slice(5).trim();
                  try {
                    currentData = JSON.parse(rawData);
                  } catch {
                    currentData = rawData;
                  }
                }
              }

              const parsed: ParsedSseEvent = {
                event: currentEvent,
                data: currentData,
                comment: currentComment,
                raw: part,
              };

              events.push(parsed);
              for (const listener of [...listeners]) {
                listener(parsed);
              }
            }
          });

          const connection: StreamConnection = {
            req,
            events,
            waitForEvent: (eventName: string, timeoutMs = 3000) => {
              const existing = events.find((e) => e.event === eventName);
              if (existing) return Promise.resolve(existing);

              return new Promise<ParsedSseEvent>((resEvent, rejEvent) => {
                const timer = setTimeout(() => {
                  rejEvent(
                    new Error(
                      `Timed out waiting for event "${eventName}". Received: ${JSON.stringify(
                        events.map((e) => e.event ?? e.comment),
                      )}`,
                    ),
                  );
                }, timeoutMs);

                const handler = (e: ParsedSseEvent): void => {
                  if (e.event === eventName) {
                    clearTimeout(timer);
                    const idx = listeners.indexOf(handler);
                    if (idx >= 0) listeners.splice(idx, 1);
                    resEvent(e);
                  }
                };
                listeners.push(handler);
              });
            },
            close: (): Promise<void> => {
              return new Promise<void>((resClose) => {
                req.destroy();
                setTimeout(resClose, 50);
              });
            },
          };

          resolve(connection);
        },
      );

      req.on("error", () => {
        // ignore client destroy errors
      });
    });
  }

  describe("GET /api/v1/notifications", () => {
    it("rejects unauthenticated requests with 401 UNAUTHENTICATED", async () => {
      const res = await request(app).get("/api/v1/notifications");
      expect(res.status).toBe(401);
    });

    it("returns empty list with accurate metadata for user with no notifications", async () => {
      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", ["accessToken=userA"]);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        unreadCount: 0,
      });
    });

    it("strictly isolates user notifications and returns newest first", async () => {
      testClock.advanceBy(1000);
      await createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.NEW_BID,
        title: "New bid 1",
        body: "First bid on potato",
        params: {
          listingId: "507f1f77bcf86cd799439011",
          cropSlug: "potato",
          currentBidPerKg: 3500,
          bidCount: 1,
        },
        entityRef: { kind: "listing", id: "507f1f77bcf86cd799439011" },
        dedupeKey: "NEW_BID:507f1f77bcf86cd799439011",
      });

      testClock.advanceBy(1000);
      await createOrCoalesceNotification({
        userId: userBId,
        type: NotificationType.OUTBID,
        title: "Outbid on potato",
        body: "You were outbid",
        params: {
          listingId: "507f1f77bcf86cd799439011",
          cropSlug: "potato",
          newBidPerKg: 3600,
        },
        entityRef: { kind: "listing", id: "507f1f77bcf86cd799439011" },
        dedupeKey: "OUTBID:507f1f77bcf86cd799439011:3600",
      });

      testClock.advanceBy(1000);
      await createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.ORDER_UPDATE,
        title: "Order created",
        body: "New order created",
        params: {
          orderId: "507f1f77bcf86cd799439022",
          listingId: "507f1f77bcf86cd799439011",
          subEvent: OrderSubEvent.CREATED,
          cropSlug: "potato",
          totalAmount: 1800000,
        },
        entityRef: { kind: "order", id: "507f1f77bcf86cd799439022" },
        dedupeKey: "ORDER_UPDATE:507f1f77bcf86cd799439022:CREATED",
      });

      // User A should see only their 2 notifications, newest first (ORDER_UPDATE then NEW_BID)
      const resA = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", ["accessToken=userA"]);

      expect(resA.status).toBe(200);
      expect(resA.body.data).toHaveLength(2);
      expect(resA.body.data[0].type).toBe(NotificationType.ORDER_UPDATE);
      expect(resA.body.data[1].type).toBe(NotificationType.NEW_BID);
      expect(resA.body.meta.unreadCount).toBe(2);

      // User B should see only their 1 notification (OUTBID)
      const resB = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", ["accessToken=userB"]);

      expect(resB.status).toBe(200);
      expect(resB.body.data).toHaveLength(1);
      expect(resB.body.data[0].type).toBe(NotificationType.OUTBID);
      expect(resB.body.meta.unreadCount).toBe(1);
    });

    it("supports unreadOnly query filter and pagination", async () => {
      // Create 3 notifications for User A
      for (let i = 1; i <= 3; i++) {
        testClock.advanceBy(1000);
        await createOrCoalesceNotification({
          userId: userAId,
          type: NotificationType.ENDING_SOON,
          title: `Ending soon ${i}`,
          body: `Listing ${i} is ending soon`,
          params: {
            listingId: `507f1f77bcf86cd79943901${i}`,
            cropSlug: "potato",
            endsAt: testClock.iso(),
          },
          entityRef: { kind: "listing", id: `507f1f77bcf86cd79943901${i}` },
          dedupeKey: `ENDING_SOON:507f1f77bcf86cd79943901${i}`,
        });
      }

      // Mark first one as read directly
      await Notification.updateOne(
        { userId: new ObjectId(userAId) },
        { isRead: true, readAt: testClock.now() },
      );

      // Fetch unread only
      const resUnread = await request(app)
        .get("/api/v1/notifications?unreadOnly=true")
        .set("Cookie", ["accessToken=userA"]);

      expect(resUnread.status).toBe(200);
      expect(resUnread.body.data).toHaveLength(2);
      expect(resUnread.body.meta.unreadCount).toBe(2);
      expect(resUnread.body.meta.total).toBe(2);

      // Fetch with pagination
      const resPage = await request(app)
        .get("/api/v1/notifications?page=1&limit=2")
        .set("Cookie", ["accessToken=userA"]);

      expect(resPage.status).toBe(200);
      expect(resPage.body.data).toHaveLength(2);
      expect(resPage.body.meta.page).toBe(1);
      expect(resPage.body.meta.limit).toBe(2);
      expect(resPage.body.meta.total).toBe(3);
      expect(resPage.body.meta.totalPages).toBe(2);
    });
  });

  describe("POST /api/v1/notifications/read", () => {
    it("marks specific notification IDs as read and ignores IDs belonging to others", async () => {
      const notifA1 = await createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.NEW_BID,
        title: "Bid on cabbage",
        body: "New bid",
        params: {
          listingId: "507f1f77bcf86cd799439011",
          cropSlug: "cabbage",
          currentBidPerKg: 2000,
          bidCount: 1,
        },
        entityRef: { kind: "listing", id: "507f1f77bcf86cd799439011" },
        dedupeKey: "NEW_BID:507f1f77bcf86cd799439011",
      });

      await createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.AUCTION_SOLD,
        title: "Sold cabbage",
        body: "Auction sold",
        params: {
          listingId: "507f1f77bcf86cd799439011",
          cropSlug: "cabbage",
          orderId: "507f1f77bcf86cd799439099",
          winningBidPerKg: 2500,
          totalAmount: 1250000,
        },
        entityRef: { kind: "order", id: "507f1f77bcf86cd799439099" },
        dedupeKey: "AUCTION_SOLD:507f1f77bcf86cd799439011",
      });

      const notifB = await createOrCoalesceNotification({
        userId: userBId,
        type: NotificationType.AUCTION_WON,
        title: "Won cabbage",
        body: "You won",
        params: {
          listingId: "507f1f77bcf86cd799439011",
          cropSlug: "cabbage",
          orderId: "507f1f77bcf86cd799439099",
          winningBidPerKg: 2500,
          totalAmount: 1250000,
        },
        entityRef: { kind: "order", id: "507f1f77bcf86cd799439099" },
        dedupeKey: "AUCTION_WON:507f1f77bcf86cd799439011",
      });

      // User A attempts to mark notifA1 and notifB (User B's notification)
      const res = await request(app)
        .post("/api/v1/notifications/read")
        .set("Cookie", ["accessToken=userA"])
        .set("X-CSRF-Protection", "1")
        .send({ ids: [notifA1!.id, notifB!.id] });

      expect(res.status).toBe(200);
      expect(res.body.data.markedCount).toBe(1); // Only notifA1 was marked
      expect(res.body.data.unreadCount).toBe(1); // notifA2 is still unread

      // Verify User B's notification remained unread
      const notifBDoc = await Notification.findById(notifB!.id);
      expect(notifBDoc?.isRead).toBe(false);
    });

    it("marks all notifications as read when all: true is provided", async () => {
      for (let i = 1; i <= 3; i++) {
        await createOrCoalesceNotification({
          userId: userAId,
          type: NotificationType.NEW_BID,
          title: `Bid ${i}`,
          body: `Bid body ${i}`,
          params: {
            listingId: `507f1f77bcf86cd79943901${i}`,
            cropSlug: "potato",
            currentBidPerKg: 3000 + i * 100,
            bidCount: i,
          },
          entityRef: { kind: "listing", id: `507f1f77bcf86cd79943901${i}` },
          dedupeKey: `NEW_BID:507f1f77bcf86cd79943901${i}`,
        });
      }

      const res = await request(app)
        .post("/api/v1/notifications/read")
        .set("Cookie", ["accessToken=userA"])
        .set("X-CSRF-Protection", "1")
        .send({ all: true });

      expect(res.status).toBe(200);
      expect(res.body.data.markedCount).toBe(3);
      expect(res.body.data.unreadCount).toBe(0);
    });
  });

  describe("GET /api/v1/me/stream", () => {
    it("rejects unauthenticated requests with 401 UNAUTHENTICATED", async () => {
      const res = await request(app).get("/api/v1/me/stream");
      expect(res.status).toBe(401);
    });

    it("sends initial snapshot and receives live notification.created and notification.updated events", async () => {
      // Pre-seed 1 unread notification for User A
      await createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.AUCTION_UNSOLD,
        title: "Unsold potato",
        body: "Auction expired unsold",
        params: {
          listingId: "507f1f77bcf86cd799439011",
          cropSlug: "potato",
        },
        entityRef: { kind: "listing", id: "507f1f77bcf86cd799439011" },
        dedupeKey: "AUCTION_UNSOLD:507f1f77bcf86cd799439011",
      });

      const conn = await connectToUserStream("userA");

      // Verify initial snapshot
      const snapshot = await conn.waitForEvent("snapshot");
      expect(snapshot.data).toEqual({ unreadCount: 1 });

      // Emit new notification for User A
      void createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.NEW_BID,
        title: "Live new bid",
        body: "Live bid body",
        params: {
          listingId: "507f1f77bcf86cd799439022",
          cropSlug: "onion",
          currentBidPerKg: 4200,
          bidCount: 1,
        },
        entityRef: { kind: "listing", id: "507f1f77bcf86cd799439022" },
        dedupeKey: "NEW_BID:507f1f77bcf86cd799439022",
      });

      const createdEvent = await conn.waitForEvent("notification.created");
      expect((createdEvent.data as { unreadCount: number }).unreadCount).toBe(2);
      expect(
        (createdEvent.data as { notification: { params: { currentBidPerKg: number } } })
          .notification.params.currentBidPerKg,
      ).toBe(4200);

      // Emit coalesced update on same listing
      void createOrCoalesceNotification({
        userId: userAId,
        type: NotificationType.NEW_BID,
        title: "Coalesced bid",
        body: "Updated bid body",
        params: {
          listingId: "507f1f77bcf86cd799439022",
          cropSlug: "onion",
          currentBidPerKg: 4500,
          bidCount: 2,
        },
        entityRef: { kind: "listing", id: "507f1f77bcf86cd799439022" },
        dedupeKey: "NEW_BID:507f1f77bcf86cd799439022",
      });

      const updatedEvent = await conn.waitForEvent("notification.updated");
      expect((updatedEvent.data as { unreadCount: number }).unreadCount).toBe(2);
      expect(
        (updatedEvent.data as { notification: { params: { currentBidPerKg: number } } })
          .notification.params.currentBidPerKg,
      ).toBe(4500);

      await conn.close();
    });

    it("drops oldest stream when user stream cap (6) is exceeded without rejecting new connections", async () => {
      const mockResponses: Array<{
        status: ReturnType<typeof vi.fn>;
        setHeader: ReturnType<typeof vi.fn>;
        flushHeaders: ReturnType<typeof vi.fn>;
        write: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        ended: boolean;
      }> = [];

      for (let i = 1; i <= 6; i++) {
        const mockRes = {
          status: vi.fn().mockReturnThis(),
          setHeader: vi.fn(),
          flushHeaders: vi.fn(),
          write: vi.fn(),
          end: vi.fn(() => {
            mockRes.ended = true;
          }),
          on: vi.fn(),
          ended: false,
        };
        mockResponses.push(mockRes);

        await streamHub.registerClient({
          user: sessionUsers.userA!,
          req: { on: vi.fn() } as unknown as Parameters<typeof streamHub.registerClient>[0]["req"],
          res: mockRes as unknown as Parameters<typeof streamHub.registerClient>[0]["res"],
        });
      }

      expect(streamHub.getUserStreamCount(userAId)).toBe(6);
      expect(mockResponses[0]!.ended).toBe(false);

      // Now register 7th stream: should drop oldest (mockResponses[0]) and succeed without 429
      const mockRes7 = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        ended: false,
      };

      await streamHub.registerClient({
        user: sessionUsers.userA!,
        req: { on: vi.fn() } as unknown as Parameters<typeof streamHub.registerClient>[0]["req"],
        res: mockRes7 as unknown as Parameters<typeof streamHub.registerClient>[0]["res"],
      });

      expect(mockResponses[0]!.ended).toBe(true);
      expect(streamHub.getUserStreamCount(userAId)).toBe(6);
    });
  });
});
