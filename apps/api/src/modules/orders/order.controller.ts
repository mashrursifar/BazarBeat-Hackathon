import type { RequestHandler } from "express";
import {
  type CancelOrderRequest,
  type CompleteOrderRequest,
  type ConfirmOrderRequest,
  type DecideStockReturnRequest,
  type MarkDeliveredRequest,
  type MarkPaidRequest,
  type MinimalOrder,
  OrderErrorCode,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { AppError } from "../../shared/errors.js";
import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import { mapOrderToMinimalOrder } from "./order.mapper.js";
import { Order } from "./order.model.js";
import { getOrderTransitionService } from "./order-transition.service.js";

export const confirmOrderController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  ConfirmOrderRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const order = await service.confirm(
    request.params.id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const markOrderPaidController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  MarkPaidRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const order = await service.markPaid(
    request.params.id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const markOrderDeliveredController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  MarkDeliveredRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const order = await service.markDelivered(
    request.params.id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const completeOrderController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  CompleteOrderRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const order = await service.complete(
    request.params.id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const cancelOrderController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  CancelOrderRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const order = await service.cancel(
    request.params.id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const decideStockReturnController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  DecideStockReturnRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const order = await service.decideStockReturn(
    request.params.id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const getOrderByIdController: RequestHandler<
  { id: string },
  { data: MinimalOrder; meta: { serverTime: string } },
  unknown,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const clock = getClock();
  const { id } = request.params;
  if (!/^[\da-f]{24}$/i.test(id)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid order ID");
  }

  const order = await Order.findById(id);
  if (!order) {
    throw new AppError(404, OrderErrorCode.ORDER_NOT_FOUND, "Order not found");
  }

  const currentUserId = response.locals.currentUser.id;
  const isParticipant =
    order.farmerId.toString() === currentUserId || order.buyerId.toString() === currentUserId;

  if (!isParticipant) {
    throw new AppError(403, "FORBIDDEN", "Only order participants can view this order");
  }

  response.status(200).json({
    data: mapOrderToMinimalOrder(order as unknown as Parameters<typeof mapOrderToMinimalOrder>[0]),
    meta: { serverTime: clock.iso() },
  });
};
