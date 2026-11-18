import mongoose from "mongoose";
import { NOTIFICATION_TIMING, NotificationType } from "@bazarbeat/shared";

const entityRefSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["listing", "order"],
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    params: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    entityRef: {
      type: entityRefSchema,
      required: true,
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  },
);

// Unique deduplication index per user
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });

// Query index for user notifications (filtering unread and sorting newest first)
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// TTL index: expires documents 60 days after createdAt (60 days * 24 * 3600 seconds)
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NOTIFICATION_TIMING.RETENTION_DAYS * 24 * 60 * 60 },
);

export interface NotificationRecord {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  params: Record<string, unknown>;
  entityRef: {
    kind: "listing" | "order";
    id: string;
  };
  isRead: boolean;
  readAt?: Date | null;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Notification: mongoose.Model<NotificationRecord> =
  mongoose.models.Notification
    ? (mongoose.models.Notification as mongoose.Model<NotificationRecord>)
    : mongoose.model<NotificationRecord>("Notification", notificationSchema);


