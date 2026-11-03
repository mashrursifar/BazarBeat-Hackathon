import type { RequestHandler } from "express";

import type { PublicUser } from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";

export const meController: RequestHandler<
  Record<string, string>,
  { data: PublicUser },
  unknown,
  unknown,
  AuthenticatedLocals
> = (_request, response): void => {
  response.status(200).json({ data: response.locals.currentUser });
};
