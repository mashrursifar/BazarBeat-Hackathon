import type { Request, Response } from "express";
import {
  DomainEventName,
  type NotificationItem,
  NOTIFICATION_TIMING,
  type PublicUser,
} from "@bazarbeat/shared";

import {
  type DomainEventEmitter,
  getDomainEventEmitter,
} from "../../shared/domain-event-emitter.js";
import { logger } from "../../shared/logger.js";
import { getUnreadCount } from "../notifications/notification.service.js";

export interface UserStreamClient {
  id: string;
  userId: string;
  res: Response;
  heartbeatTimer: NodeJS.Timeout;
  connectedAt: number;
}

export interface RegisterUserStreamOptions {
  user: PublicUser;
  req: Request;
  res: Response;
  heartbeatIntervalMs?: number;
}

export interface UserStreamHubOptions {
  eventEmitter?: DomainEventEmitter;
  defaultHeartbeatIntervalMs?: number;
  maxStreamsPerUser?: number;
}

/**
 * Server-Sent Events (SSE) Hub for authenticated user personal notification streams (/me/stream).
 *
 * ARCHITECTURE §5 & docs/phase-8.md Gap 5:
 * The notification bell and Notifications page open /me/stream to receive real-time
 * unread count snapshots, notification.created, and notification.updated events.
 *
 * CONCURRENCY & DROP-OLDEST POLICY (Gap 5):
 * Users may have multiple browser tabs open (e.g. Crop Bidding + Marketplace + Notifications).
 * When the per-user stream cap (default 6) is reached, the server drops the oldest stream
 * instead of rejecting a new one with 429.
 */
export class UserStreamHub {
  private readonly userStreams = new Map<string, UserStreamClient[]>();
  private readonly defaultHeartbeatIntervalMs: number;
  private readonly maxStreamsPerUser: number;
  private unbindListeners?: () => void;
  private clientSequence = 0;

  public constructor(options?: UserStreamHubOptions) {
    this.defaultHeartbeatIntervalMs =
      options?.defaultHeartbeatIntervalMs ?? 20 * 1000; // 20s per API_SPEC
    this.maxStreamsPerUser =
      options?.maxStreamsPerUser ?? NOTIFICATION_TIMING.MAX_CONCURRENT_USER_STREAMS;

    this.bindEventEmitter(options?.eventEmitter ?? getDomainEventEmitter());
  }

  public bindEventEmitter(emitter: DomainEventEmitter): void {
    if (this.unbindListeners) {
      this.unbindListeners();
    }

    const unsubCreated = emitter.on(
      DomainEventName.NOTIFICATION_CREATED,
      (payload: { userId: string; notification: NotificationItem; unreadCount: number }) => {
        this.handleNotificationCreated(payload);
      },
    );

    const unsubUpdated = emitter.on(
      DomainEventName.NOTIFICATION_UPDATED,
      (payload: { userId: string; notification: NotificationItem; unreadCount: number }) => {
        this.handleNotificationUpdated(payload);
      },
    );

    this.unbindListeners = (): void => {
      unsubCreated();
      unsubUpdated();
    };
  }

  public async registerClient(options: RegisterUserStreamOptions): Promise<void> {
    const { user, req, res, heartbeatIntervalMs } = options;

    // 1. Enforce per-user stream cap with Drop-Oldest behavior (Gap 5)
    const existingStreams = this.userStreams.get(user.id) ?? [];
    while (existingStreams.length >= this.maxStreamsPerUser) {
      const oldest = existingStreams.shift();
      if (oldest) {
        logger.debug(
          { userId: user.id, clientId: oldest.id },
          "Dropping oldest user stream connection due to user stream cap",
        );
        this.closeClient(oldest, "superseded");
      }
    }

    // 2. Configure SSE HTTP response headers
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // 3. Emit initial snapshot event with current unread count
    const unreadCount = await getUnreadCount(user.id);
    res.write(`event: snapshot\ndata: ${JSON.stringify({ unreadCount })}\n\n`);

    // 4. Set up periodic heartbeat comment
    const intervalMs = heartbeatIntervalMs ?? this.defaultHeartbeatIntervalMs;
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (err: unknown) {
        logger.warn(
          { err, userId: user.id },
          "User stream heartbeat write failed; removing client",
        );
        this.removeClient(client);
      }
    }, intervalMs);

    if (typeof heartbeatTimer.unref === "function") {
      heartbeatTimer.unref();
    }

    const clientId = `user-client-${++this.clientSequence}-${user.id}`;
    const client: UserStreamClient = {
      id: clientId,
      userId: user.id,
      res,
      heartbeatTimer,
      connectedAt: Date.now(),
    };

    let userStreamsList = this.userStreams.get(user.id);
    if (!userStreamsList) {
      userStreamsList = [];
      this.userStreams.set(user.id, userStreamsList);
    }
    userStreamsList.push(client);

    // 5. Register disconnect cleanup
    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.removeClient(client);
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
    res.on("close", cleanup);
    res.on("finish", cleanup);
  }

  private handleNotificationCreated(payload: {
    userId: string;
    notification: NotificationItem;
    unreadCount: number;
  }): void {
    const clients = this.userStreams.get(payload.userId);
    if (!clients || clients.length === 0) return;

    const eventPayload = JSON.stringify({
      notification: payload.notification,
      unreadCount: payload.unreadCount,
    });
    const sseMessage = `event: notification.created\ndata: ${eventPayload}\n\n`;

    for (const client of [...clients]) {
      try {
        client.res.write(sseMessage);
      } catch (err: unknown) {
        logger.warn(
          { err, clientId: client.id, userId: payload.userId },
          "Failed to write notification.created to SSE client; removing",
        );
        this.removeClient(client);
      }
    }
  }

  private handleNotificationUpdated(payload: {
    userId: string;
    notification: NotificationItem;
    unreadCount: number;
  }): void {
    const clients = this.userStreams.get(payload.userId);
    if (!clients || clients.length === 0) return;

    const eventPayload = JSON.stringify({
      notification: payload.notification,
      unreadCount: payload.unreadCount,
    });
    const sseMessage = `event: notification.updated\ndata: ${eventPayload}\n\n`;

    for (const client of [...clients]) {
      try {
        client.res.write(sseMessage);
      } catch (err: unknown) {
        logger.warn(
          { err, clientId: client.id, userId: payload.userId },
          "Failed to write notification.updated to SSE client; removing",
        );
        this.removeClient(client);
      }
    }
  }

  private closeClient(client: UserStreamClient, reason: string): void {
    clearInterval(client.heartbeatTimer);
    try {
      client.res.write(`: stream-closed (${reason})\n\n`);
      client.res.end();
    } catch {
      // ignore write errors on already closed connection
    }
  }

  public removeClient(client: UserStreamClient): void {
    clearInterval(client.heartbeatTimer);
    const clients = this.userStreams.get(client.userId);
    if (!clients) return;

    const index = clients.findIndex((c) => c.id === client.id);
    if (index !== -1) {
      clients.splice(index, 1);
    }
    if (clients.length === 0) {
      this.userStreams.delete(client.userId);
    }
  }

  public getUserStreamCount(userId: string): number {
    return this.userStreams.get(userId)?.length ?? 0;
  }

  public getTotalStreamCount(): number {
    let total = 0;
    for (const list of this.userStreams.values()) {
      total += list.length;
    }
    return total;
  }

  public destroy(): void {
    if (this.unbindListeners) {
      this.unbindListeners();
      this.unbindListeners = undefined;
    }

    for (const list of this.userStreams.values()) {
      for (const client of list) {
        clearInterval(client.heartbeatTimer);
        try {
          client.res.end();
        } catch {
          // ignore
        }
      }
    }

    this.userStreams.clear();
  }
}

let activeUserStreamHub: UserStreamHub = new UserStreamHub();

export function getUserStreamHub(): UserStreamHub {
  return activeUserStreamHub;
}

export function setUserStreamHub(hub: UserStreamHub): void {
  activeUserStreamHub = hub;
}

export function resetUserStreamHub(options?: UserStreamHubOptions): void {
  activeUserStreamHub.destroy();
  activeUserStreamHub = new UserStreamHub(options);
}
