import { ObjectId } from "bson";
import {
  DomainEventName,
  type NotificationEntityRef,
  type NotificationItem,
  type NotificationListResponse,
  type NotificationParams,
  NotificationType,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { getDomainEventEmitter } from "../../shared/domain-event-emitter.js";
import { logger } from "../../shared/logger.js";
import { Notification, type NotificationRecord } from "./notification.model.js";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  params: NotificationParams;
  entityRef: NotificationEntityRef;
  dedupeKey: string;
}

export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface MarkReadInput {
  ids?: string[];
  all?: boolean;
}

export interface MarkReadResult {
  markedCount: number;
  unreadCount: number;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

/**
 * Maps a Mongoose Notification document or lean record to a typed NotificationItem.
 */
export function mapNotification(
  doc: {
    _id: { toString(): string };
    userId: { toString(): string };
    type: string;
    title: string;
    body: string;
    params: unknown;
    entityRef: { kind: string; id: string };
    isRead: boolean;
    readAt?: Date | null;
    dedupeKey: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  },
): NotificationItem {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    type: doc.type as NotificationType,
    title: doc.title,
    body: doc.body,
    params: doc.params as NotificationParams,
    entityRef: {
      kind: doc.entityRef.kind as "listing" | "order",
      id: doc.entityRef.id,
    },
    isRead: Boolean(doc.isRead),
    readAt: doc.readAt
      ? doc.readAt instanceof Date
        ? doc.readAt.toISOString()
        : String(doc.readAt)
      : null,
    dedupeKey: doc.dedupeKey,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt:
      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
  };
}

/**
 * Returns unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!ObjectId.isValid(userId)) {
    return 0;
  }
  return Notification.countDocuments({
    userId: new ObjectId(userId),
    isRead: false,
  });
}

/**
 * Creates or coalesces a notification for a user.
 *
 * COALESCING RULES (docs/phase-8.md Gap 3 / Decision D-33):
 * - If NEW_BID: unread notifications for the same listing coalesce onto `NEW_BID:${listingId}`,
 *   updating the latest bid amount and bid count without spamming new alerts.
 * - If already read: resets to unread with latest amount and bid count.
 * - Other types: uses unique `(userId, dedupeKey)` to ensure single delivery.
 */
export async function createOrCoalesceNotification(
  input: CreateNotificationInput,
): Promise<NotificationItem | null> {
  if (!ObjectId.isValid(input.userId)) {
    logger.warn({ userId: input.userId }, "Invalid userId supplied for notification");
    return null;
  }

  const userObjectId = new ObjectId(input.userId);
  const clock = getClock();
  const now = clock.now();
  const emitter = getDomainEventEmitter();

  if (input.type === NotificationType.NEW_BID) {
    const existing = await Notification.findOne({
      userId: userObjectId,
      dedupeKey: input.dedupeKey,
    });

    if (existing) {
      if (!existing.isRead) {
        // Coalesce unread notification
        existing.params = { ...(existing.params as Record<string, unknown>), ...input.params };
        existing.title = input.title;
        existing.body = input.body;
        existing.updatedAt = now;
        await existing.save();

        const mapped = mapNotification(existing as unknown as NotificationRecord);
        const unreadCount = await getUnreadCount(input.userId);

        emitter.emit(DomainEventName.NOTIFICATION_UPDATED, {
          userId: input.userId,
          notification: mapped,
          unreadCount,
        });

        return mapped;
      } else {
        // Was previously read: reopen with latest bid details
        existing.isRead = false;
        existing.readAt = null;
        existing.params = input.params;
        existing.title = input.title;
        existing.body = input.body;
        existing.updatedAt = now;
        await existing.save();

        const mapped = mapNotification(existing as unknown as NotificationRecord);
        const unreadCount = await getUnreadCount(input.userId);

        emitter.emit(DomainEventName.NOTIFICATION_CREATED, {
          userId: input.userId,
          notification: mapped,
          unreadCount,
        });

        return mapped;
      }
    }
  }

  try {
    const created = await Notification.create({
      userId: userObjectId,
      type: input.type,
      title: input.title,
      body: input.body,
      params: input.params,
      entityRef: input.entityRef,
      isRead: false,
      readAt: null,
      dedupeKey: input.dedupeKey,
      createdAt: now,
      updatedAt: now,
    });

    const mapped = mapNotification(created as unknown as NotificationRecord);
    const unreadCount = await getUnreadCount(input.userId);

    emitter.emit(DomainEventName.NOTIFICATION_CREATED, {
      userId: input.userId,
      notification: mapped,
      unreadCount,
    });

    return mapped;
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      logger.debug(
        { userId: input.userId, dedupeKey: input.dedupeKey },
        "Notification deduplicated by unique (userId, dedupeKey) index",
      );
      return null;
    }
    throw err;
  }
}

/**
 * Returns paginated notifications for the authenticated user.
 */
export async function getNotificationsForUser(
  userId: string,
  options?: GetNotificationsOptions,
): Promise<NotificationListResponse> {
  const clock = getClock();
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const userObjectId = new ObjectId(userId);
  const filter: Record<string, unknown> = { userId: userObjectId };

  if (options?.unreadOnly) {
    filter.isRead = false;
  }

  const [docs, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    getUnreadCount(userId),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: (docs as Array<Parameters<typeof mapNotification>[0]>).map(mapNotification),
    meta: {
      serverTime: clock.iso(),
      page,
      limit,
      total,
      totalPages,
      unreadCount,
    },
  };
}

/**
 * Marks specified notifications or all notifications as read for the user.
 * Ignores IDs belonging to other users.
 */
export async function markNotificationsRead(
  userId: string,
  input: MarkReadInput,
): Promise<MarkReadResult> {
  const clock = getClock();
  const now = clock.now();
  const userObjectId = new ObjectId(userId);

  let markedCount = 0;

  if (input.all) {
    const updateResult = await Notification.updateMany(
      { userId: userObjectId, isRead: false },
      { $set: { isRead: true, readAt: now } },
    );
    markedCount = updateResult.modifiedCount;
  } else if (input.ids && input.ids.length > 0) {
    const validIds = input.ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (validIds.length > 0) {
      const updateResult = await Notification.updateMany(
        { _id: { $in: validIds }, userId: userObjectId, isRead: false },
        { $set: { isRead: true, readAt: now } },
      );
      markedCount = updateResult.modifiedCount;
    }
  }

  const unreadCount = await getUnreadCount(userId);
  return { markedCount, unreadCount };
}

