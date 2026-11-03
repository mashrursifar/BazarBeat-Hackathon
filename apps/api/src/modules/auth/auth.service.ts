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
import { createSessionTokens, hashRefreshToken } from "./tokens.js";
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
