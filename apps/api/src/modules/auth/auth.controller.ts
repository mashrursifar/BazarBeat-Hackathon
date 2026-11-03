import type { RequestHandler } from "express";

import type { PublicUser, RegisterInput } from "@bazarbeat/shared";

import { registerUser } from "./auth.service.js";

export const registerController: RequestHandler<
  Record<string, string>,
  { data: PublicUser },
  RegisterInput
> = async (request, response): Promise<void> => {
  const user = await registerUser(request.body);
  response.status(201).json({ data: user });
};
