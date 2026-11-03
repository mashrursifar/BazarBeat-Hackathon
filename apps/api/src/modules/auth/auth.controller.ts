import type { RequestHandler, Response } from "express";
import type { ParsedQs } from "qs";
import type { ParamsDictionary } from "express-serve-static-core";

import type { LoginInput, PublicUser, RegisterInput } from "@bazarbeat/shared";

import { env } from "../../config/env.js";
import { loginUser, logoutUser, refreshUserSession, registerUser } from "./auth.service.js";
import { AppError } from "../../shared/errors.js";
import type { AuthenticatedLocals } from "./auth.middleware.js";

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
  ...(env.COOKIE_DOMAIN.length > 0 ? { domain: env.COOKIE_DOMAIN } : {}),
};

export const loginController: RequestHandler<Record<string, string>, { data: PublicUser }, LoginInput> =
  async (request, response): Promise<void> => {
    const session = await loginUser(request.body);
    setSessionCookies(response, session);
    response.status(200).json({ data: session.user });
  };

export const refreshController: RequestHandler<Record<string, string>, { data: PublicUser }> =
  async (request, response): Promise<void> => {
    const refreshToken = request.cookies?.refreshToken;
    if (refreshToken === undefined) {
      throw new AppError(401, "UNAUTHENTICATED", "Refresh session is missing");
    }
    const session = await refreshUserSession(refreshToken);
    setSessionCookies(response, session);
    response.status(200).json({ data: session.user });
  };

export const logoutController: RequestHandler<ParamsDictionary, unknown, unknown, ParsedQs, AuthenticatedLocals> =
  async (request, response): Promise<void> => {
    await logoutUser(response.locals.currentUser.id, request.cookies?.refreshToken);
    response.clearCookie("accessToken", { ...COOKIE_SECURITY_OPTIONS, path: "/" });
    response.clearCookie("refreshToken", { ...COOKIE_SECURITY_OPTIONS, path: "/api/v1/auth" });
    response.status(204).end();
  };

function setSessionCookies(
  response: Response,
  session: { accessToken: string; refreshToken: string },
): void {
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
}
