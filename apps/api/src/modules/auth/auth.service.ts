import bcrypt from "bcrypt";

import { type PublicUser, type RegisterInput, UserRole, publicUserSchema } from "@bazarbeat/shared";

import { User } from "../users/user.model.js";
import { AppError } from "../../shared/errors.js";

const BCRYPT_COST = 12;

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
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, "CONFLICT", "An account with this phone number already exists");
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
