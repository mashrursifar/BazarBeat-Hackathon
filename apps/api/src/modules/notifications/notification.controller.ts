import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import {
  markNotificationsReadRequestSchema,
  notificationQuerySchema,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import { getUserStreamHub } from "../realtime/user-stream-hub.js";
import {
  getNotificationsForUser,
  markNotificationsRead,
} from "./notification.service.js";

/**
 * GET /api/v1/notifications
 * Lists notifications for the authenticated user, sorted newest first.
 * Supports ?unreadOnly=true|false, ?page=X, ?limit=Y (max 50).
 */
export const getNotificationsController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const currentUser = res.locals.currentUser;
  const query = notificationQuerySchema.parse(req.query);
  const result = await getNotificationsForUser(currentUser.id, query);
  res.status(200).json(result);
};

/**
 * POST /api/v1/notifications/read
 * Marks specified notification IDs or all notifications as read for the authenticated user.
 * Ignores IDs belonging to other users.
 */
export const markNotificationsReadController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const currentUser = res.locals.currentUser;
  const body = markNotificationsReadRequestSchema.parse(req.body);
  const result = await markNotificationsRead(currentUser.id, body);
  const clock = getClock();

  res.status(200).json({
    data: {
      markedCount: result.markedCount,
      unreadCount: result.unreadCount,
    },
    meta: {
      serverTime: clock.iso(),
      unreadCount: result.unreadCount,
    },
  });
};

/**
 * GET /api/v1/me/stream
 * Server-Sent Events stream for the authenticated user.
 */
export const meStreamController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const currentUser = res.locals.currentUser;
  await getUserStreamHub().registerClient({
    user: currentUser,
    req,
    res,
  });
};
