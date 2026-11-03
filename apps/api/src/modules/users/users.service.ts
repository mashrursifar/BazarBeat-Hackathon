import { type PublicUser, type UpdateProfileInput, UserRole, districtBelongsToDivision } from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { User } from "./user.model.js";
import { toPublicUser } from "./user.mapper.js";

export async function updateUserProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (user === null || !user.isActive) {
    throw new AppError(401, "UNAUTHENTICATED", "A valid access session is required");
  }
  if (user.role === UserRole.FARMER && input.organization !== undefined) {
    throw new AppError(403, "FORBIDDEN", "Only buyers can update an organization");
  }
  const nextDivision = input.division ?? user.division;
  const nextDistrict = input.district ?? user.district;
  if ((input.division !== undefined || input.district !== undefined) &&
    !districtBelongsToDivision(nextDistrict, nextDivision)) {
    throw new AppError(400, "VALIDATION_ERROR", "District must belong to the selected division");
  }

  const updates = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.division === undefined ? {} : { division: input.division }),
    ...(input.district === undefined ? {} : { district: input.district }),
    ...(input.upazila === undefined ? {} : { upazila: input.upazila }),
    ...(input.organization === undefined ? {} : { organization: input.organization }),
    ...(input.language === undefined ? {} : { language: input.language }),
  };
  user.set(updates);
  return toPublicUser(await user.save());
}
