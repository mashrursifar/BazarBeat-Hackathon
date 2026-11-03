import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

import {
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  UserRole,
  publicUserSchema,
} from "@bazarbeat/shared";

import { RefreshSession } from "./refresh-session.model.js";
import { createSessionTokens, hashRefreshToken, verifyRefreshToken } from "./tokens.js";
import { User, type UserDocument } from "../users/user.model.js";
import { AppError } from "../../shared/errors.js";

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = "$2b$12$jc5f1L40ywUr.dxgA5AT5OwiO6DiCg8Lx/gX2wKy0OFCjoln5SWnK";

export interface LoginSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  try {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const profile = {
      name: input.name,
      phone: input.phone,
      division: input.division,
      district: input.district,
      upazila: input.upazila,
    };
    const user = input.role === UserRole.BUYER
      ? await User.create({ ...profile, role: input.role, organization: input.organization, passwordHash })
      : await User.create({ ...profile, role: input.role, passwordHash });
    return toPublicUser(user);
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, "CONFLICT", "An account with this phone number already exists");
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<LoginSession> {
  const user = await User.findOne({ phone: input.phone }).select("+passwordHash");
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (user === null || !user.isActive || !passwordMatches) {
    throw new AppError(401, "UNAUTHENTICATED", "Phone number or password is incorrect");
  }

  const tokens = createSessionTokens(user.id);
  const refreshTokenHash = hashRefreshToken(tokens.refreshToken);
  await RefreshSession.create({
    userId: user._id,
    tokenHash: refreshTokenHash,
    familyId: randomUUID(),
    expiresAt: tokens.refreshExpiresAt,
  });

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function refreshUserSession(token: string): Promise<LoginSession> {
  const claims = verifyRefreshToken(token);
  if (claims === null) throw invalidCredentialsError();

  const tokenHash = hashRefreshToken(token);
  const session = await RefreshSession.findOne({ tokenHash }).lean();
  if (session === null) throw invalidCredentialsError();
  if (session.revokedAt !== undefined && session.revokedAt !== null) {
    await revokeSessionFamily(session.familyId);
    throw invalidCredentialsError();
  }

  const now = new Date();
  if (session.expiresAt <= now || session.userId.toString() !== claims.sub) throw invalidCredentialsError();
  const user = await User.findById(claims.sub);
  if (user === null || !user.isActive) {
    await revokeSessionFamily(session.familyId);
    throw invalidCredentialsError();
  }

  const tokens = createSessionTokens(user.id);
  const nextTokenHash = hashRefreshToken(tokens.refreshToken);
  await RefreshSession.create({
    userId: user._id,
    tokenHash: nextTokenHash,
    familyId: session.familyId,
    expiresAt: tokens.refreshExpiresAt,
  });
  const rotated = await RefreshSession.findOneAndUpdate(
    { _id: session._id, tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, replacedByTokenHash: nextTokenHash } },
    { new: false },
  );
  if (rotated === null) {
    await RefreshSession.deleteOne({ tokenHash: nextTokenHash });
    await revokeSessionFamily(session.familyId);
    throw invalidCredentialsError();
  }

  return { user: toPublicUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

async function revokeSessionFamily(familyId: string): Promise<void> {
  await RefreshSession.updateMany(
    { familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

function invalidCredentialsError(): AppError {
  return new AppError(401, "UNAUTHENTICATED", "Session is invalid or expired");
}

function toPublicUser(user: UserDocument): PublicUser {
  return publicUserSchema.parse({
    id: user.id,
    role: user.role,
    name: user.name,
    division: user.division,
    district: user.district,
    ...(user.upazila === undefined ? {} : { upazila: user.upazila }),
    ...(user.organization === undefined ? {} : { organization: user.organization }),
    language: user.language,
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
