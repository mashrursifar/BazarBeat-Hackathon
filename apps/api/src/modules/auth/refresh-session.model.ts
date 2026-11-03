import mongoose, { type InferSchemaType } from "mongoose";

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date },
    replacedByTokenHash: { type: String },
  },
  { timestamps: true, collection: "refresh_sessions", versionKey: false },
);

export type RefreshSessionRecord = InferSchemaType<typeof refreshSessionSchema>;
export const RefreshSession = mongoose.models.RefreshSession
  ? mongoose.model<RefreshSessionRecord>("RefreshSession")
  : mongoose.model<RefreshSessionRecord>("RefreshSession", refreshSessionSchema);
