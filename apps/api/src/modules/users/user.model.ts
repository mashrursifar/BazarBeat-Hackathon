import mongoose, { type InferSchemaType } from "mongoose";

import { Language, UserRole, normalizeBangladeshPhone } from "@bazarbeat/shared";

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: Object.values(UserRole), required: true, immutable: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    phone: {
      type: String,
      required: true,
      unique: true,
      set: (value: string): string => normalizeBangladeshPhone(value),
    },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    division: { type: String, required: true },
    district: { type: String, required: true },
    upazila: { type: String, trim: true },
    organization: { type: String, trim: true, maxlength: 160 },
    language: { type: String, enum: Object.values(Language), default: Language.EN, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, collection: "users", versionKey: false },
);

userSchema.pre("validate", function () {
  if (this.role === UserRole.FARMER && this.organization !== undefined) {
    this.invalidate("organization", "Only buyers can have an organization");
  }
});

export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = mongoose.models.User
  ? mongoose.model<UserRecord>("User")
  : mongoose.model<UserRecord>("User", userSchema);
