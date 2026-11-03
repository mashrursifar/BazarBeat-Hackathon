import { type PublicUser, publicUserSchema } from "@bazarbeat/shared";

import type { UserDocument } from "./user.model.js";

export function toPublicUser(user: UserDocument): PublicUser {
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
