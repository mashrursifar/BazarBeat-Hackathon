import type { RequestHandler } from "express";
import {
  type CancelOrderRequest,
  type CompleteOrderRequest,
  type ConfirmOrderRequest,
  type DecideStockReturnRequest,
  type MarkDeliveredRequest,
  type MarkPaidRequest,
  type OrderListQuery,
} from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { getOrderTransitionService } from "./order-transition.service.js";
import { getOrderService } from "./order.service.js";

export const listOrdersController: RequestHandler = async (request, response): Promise<void> => {
  const service = getOrderService();
  const query = (response.locals.validatedQuery ?? request.query) as OrderListQuery;
  const result = await service.listOrders(
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    query,
  );
  response.status(200).json(result);
};

export const getOrderByIdController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderService();
  const id = request.params.id as string;
  const detail = await service.getOrderById(id, {
    userId: response.locals.currentUser.id,
    role: response.locals.currentUser.role,
  });
  response.status(200).json({
    data: detail,
    meta: { serverTime: clock.iso() },
  });
};

export const confirmOrderController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const id = request.params.id as string;
  const order = await service.confirm(
    id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body as ConfirmOrderRequest,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const markOrderPaidController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const id = request.params.id as string;
  const order = await service.markPaid(
    id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body as MarkPaidRequest,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const markOrderDeliveredController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const id = request.params.id as string;
  const order = await service.markDelivered(
    id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body as MarkDeliveredRequest,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const completeOrderController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const id = request.params.id as string;
  const order = await service.complete(
    id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body as CompleteOrderRequest,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const cancelOrderController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const id = request.params.id as string;
  const order = await service.cancel(
    id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body as CancelOrderRequest,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};

export const decideStockReturnController: RequestHandler = async (request, response): Promise<void> => {
  const clock = getClock();
  const service = getOrderTransitionService();
  const id = request.params.id as string;
  const order = await service.decideStockReturn(
    id,
    {
      userId: response.locals.currentUser.id,
      role: response.locals.currentUser.role,
    },
    request.body as DecideStockReturnRequest,
  );
  response.status(200).json({ data: order, meta: { serverTime: clock.iso() } });
};
