import type { ParsedQs } from "qs";
import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

import { type PublicUser, UserRole, authenticationCookiesSchema } from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { authenticateAccessToken } from "./auth.service.js";

export interface AuthenticatedLocals {
  currentUser: PublicUser;
}

export interface OptionalAuthLocals {
  currentUser?: PublicUser;
}

export const optionalAuthentication: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  OptionalAuthLocals
> = (request, response, next): void => {
  const cookies = authenticationCookiesSchema.safeParse(request.cookies);
  if (!cookies.success) {
    next();
    return;
  }
  void authenticateAccessToken(cookies.data.accessToken)
    .then((currentUser) => {
      response.locals.currentUser = currentUser;
      next();
    })
    .catch(() => {
      next();
    });
};

export const requireAuthentication: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = (request, response, next): void => {
  const cookies = authenticationCookiesSchema.safeParse(request.cookies);
  if (!cookies.success) {
    next(new AppError(401, "UNAUTHENTICATED", "A valid access session is required"));
    return;
  }
  void authenticateAccessToken(cookies.data.accessToken)
    .then((currentUser) => {
      response.locals.currentUser = currentUser;
      next();
    })
    .catch(next);
};

export function requireRole(
  ...allowedRoles: UserRole[]
): RequestHandler<ParamsDictionary, unknown, unknown, ParsedQs, AuthenticatedLocals> {
  return (_request, response, next): void => {
    if (!allowedRoles.includes(response.locals.currentUser.role)) {
      next(new AppError(403, "FORBIDDEN", "Your role cannot access this resource"));
      return;
    }
    next();
  };
}
