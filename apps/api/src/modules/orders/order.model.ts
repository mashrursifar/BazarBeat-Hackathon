import mongoose, { type InferSchemaType } from "mongoose";
import {
  CropGrade,
  FulfilmentMethod,
  ORDER_DISPUTE_REASONS,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockReturnDecision,
} from "@bazarbeat/shared";

const orderPaymentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
      required: true,
    },
    method: {
      type: String,
      enum: Object.values(PaymentMethod),
    },
    paidAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
  },
  { _id: false },
);

const orderFulfilmentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: Object.values(FulfilmentMethod),
      default: FulfilmentMethod.PICKUP,
      required: true,
    },
    note: {
      type: String,
      maxlength: 200,
    },
    handoverAt: {
      type: Date,
    },
  },
  { _id: false },
);

const orderDisputeSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      enum: ORDER_DISPUTE_REASONS,
      required: true,
    },
    note: {
      type: String,
      maxlength: 500,
    },
    raisedAt: {
      type: Date,
      required: true,
    },
    resolution: {
      type: String,
      maxlength: 500,
    },
  },
  { _id: false },
);

const orderTimelineEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
    },
    at: {
      type: Date,
      required: true,
    },
    byUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    note: {
      type: String,
      maxlength: 200,
    },
  },
  { _id: false },
);

const orderStockReturnSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: Object.values(StockReturnDecision),
      required: true,
    },
    decidedAt: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
      maxlength: 200,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      unique: true,
      index: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crop",
      required: true,
      index: true,
    },
    quantityKg: {
      type: Number,
      required: true,
      min: 0.1,
      validate: {
        validator: (value: number): boolean => Number.isInteger(value * 10),
        message: "Quantity must have at most one decimal place",
      },
    },
    grade: {
      type: String,
      enum: Object.values(CropGrade),
      required: true,
    },
    pricePerKg: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Price per kg must be an integer in poisha",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Subtotal must be an integer in poisha",
      },
    },
    platformFee: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Platform fee must be an integer in poisha",
      },
    },
    farmerNet: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Farmer net must be an integer in poisha",
      },
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      required: true,
    },
    payment: {
      type: orderPaymentSchema,
      default: (): { status: string } => ({ status: PaymentStatus.UNPAID }),
      required: true,
    },
    fulfilment: {
      type: orderFulfilmentSchema,
      default: (): { method: string } => ({ method: FulfilmentMethod.PICKUP }),
      required: true,
    },
    dispute: {
      type: orderDisputeSchema,
    },
    statusHistory: {
      type: [orderTimelineEntrySchema],
      default: (): [] => [],
    },
    confirmedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelReason: {
      type: String,
      maxlength: 100,
    },
    cancelNote: {
      type: String,
      maxlength: 200,
    },
    stockReturn: {
      type: orderStockReturnSchema,
    },
  },
  {
    timestamps: true,
    collection: "orders",
    versionKey: false,
  },
);

// Indexes defined in DATA_MODEL.md
orderSchema.index({ farmerId: 1, createdAt: -1 });
orderSchema.index({ farmerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

export type OrderRecord = InferSchemaType<typeof orderSchema>;
export const Order = mongoose.models.Order
  ? mongoose.model<OrderRecord>("Order")
  : mongoose.model<OrderRecord>("Order", orderSchema);
