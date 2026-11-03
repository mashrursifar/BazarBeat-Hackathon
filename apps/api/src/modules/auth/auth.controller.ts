import type { RequestHandler } from "express";

import type { LoginInput, PublicUser, RegisterInput } from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { loginUser, registerUser } from "./auth.service.js";

export const registerController: RequestHandler<
  Record<string, string>,
  { data: PublicUser },
  RegisterInput
> = async (request, response): Promise<void> => {
  const user = await registerUser(request.body);
  response.status(201).json({ data: user });
};

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_SECURITY_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  domain: env.COOKIE_DOMAIN,
};

export const loginController: RequestHandler<Record<string, string>, { data: PublicUser }, LoginInput> =
  async (request, response): Promise<void> => {
    const session = await loginUser(request.body);
    response.cookie("accessToken", session.accessToken, {
      ...COOKIE_SECURITY_OPTIONS,
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
      path: "/",
    });
    response.cookie("refreshToken", session.refreshToken, {
      ...COOKIE_SECURITY_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: "/api/v1/auth",
    });
    response.status(200).json({ data: session.user });
  };
