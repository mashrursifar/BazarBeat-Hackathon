import { z } from "zod";

import { Language, UserRole } from "../enums.js";
import { BANGLADESH_DISTRICTS, BANGLADESH_DIVISIONS } from "../locations.js";
import { normalizeBangladeshPhone } from "../phone.js";

const divisionIds = BANGLADESH_DIVISIONS.map(({ id }) => id);
const districtIds = BANGLADESH_DISTRICTS.map(({ id }) => id);
const divisionSchema = z.enum(divisionIds as [string, ...string[]]);
const districtSchema = z.enum(districtIds as [string, ...string[]]);
const phoneSchema = z.string().transform((value, context) => {
  try {
    return normalizeBangladeshPhone(value);
  } catch {
    context.addIssue({ code: "custom", message: "Enter a valid Bangladesh mobile number" });
    return z.NEVER;
  }
});

const registrationBase = z.object({
  name: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  password: z.string().min(8).max(128),
  division: divisionSchema,
  district: districtSchema,
  upazila: z.string().trim().min(1).max(100).optional(),
});

export const registerSchema = z.discriminatedUnion("role", [
  registrationBase.extend({ role: z.literal(UserRole.FARMER) }).strict(),
  registrationBase.extend({
    role: z.literal(UserRole.BUYER),
    organization: z.string().trim().min(1).max(160).optional(),
  }).strict(),
]);

export const loginSchema = z.object({ phone: phoneSchema, password: z.string().min(1).max(128) });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  division: divisionSchema.optional(),
  district: districtSchema.optional(),
  upazila: z.string().trim().min(1).max(100).optional(),
  organization: z.string().trim().min(1).max(160).optional(),
  language: z.enum([Language.EN, Language.BN]).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one profile field is required" });

export const publicUserSchema = z.object({
  id: z.string(),
  role: z.enum([UserRole.FARMER, UserRole.BUYER]),
  name: z.string(),
  division: divisionSchema,
  district: districtSchema,
  upazila: z.string().optional(),
  organization: z.string().optional(),
  language: z.enum([Language.EN, Language.BN]),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
