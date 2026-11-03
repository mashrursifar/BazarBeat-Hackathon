import type { RequestHandler } from "express";

import type { PublicUser } from "@bazarbeat/shared";
import type { UpdateProfileInput } from "@bazarbeat/shared";

import { updateUserProfile } from "./users.service.js";
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

export const updateMeController: RequestHandler<
  Record<string, string>,
  { data: PublicUser },
  UpdateProfileInput,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const user = await updateUserProfile(response.locals.currentUser.id, request.body);
  response.status(200).json({ data: user });
};
