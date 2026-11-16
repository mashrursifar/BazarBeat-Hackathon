export const UserRole = {
  FARMER: "FARMER",
  BUYER: "BUYER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Language = {
  EN: "en",
  BN: "bn",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export const CropGrade = {
  A: "A",
  B: "B",
  C: "C",
} as const;

export type CropGrade = (typeof CropGrade)[keyof typeof CropGrade];

export const AIProvider = {
  MOCK: "mock",
  HTTP: "http",
} as const;

export type AIProvider = (typeof AIProvider)[keyof typeof AIProvider];

export const AIErrorCode = {
  CROP_MISMATCH: "CROP_MISMATCH",
  GRADE_UNAVAILABLE: "GRADE_UNAVAILABLE",
  GRADE_STALE: "GRADE_STALE",
} as const;

export type AIErrorCode = (typeof AIErrorCode)[keyof typeof AIErrorCode];

export const ListingStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  EXPIRED_UNSOLD: "EXPIRED_UNSOLD",
  CANCELLED: "CANCELLED",
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const StockMovementType = {
  ADD: "ADD",
  LIST: "LIST",
  RELEASE: "RELEASE",
  SELL: "SELL",
  ADJUST: "ADJUST",
  RETURN: "RETURN",
} as const;

export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const StockMovementStatus = {
  PENDING: "PENDING",
  APPLIED: "APPLIED",
} as const;

export type StockMovementStatus = (typeof StockMovementStatus)[keyof typeof StockMovementStatus];

export const MarketPriceSource = {
  SEED: "SEED",
  PLATFORM: "PLATFORM",
} as const;

export type MarketPriceSource = (typeof MarketPriceSource)[keyof typeof MarketPriceSource];

export const BidStatus = {
  ACCEPTED: "ACCEPTED",
  WON: "WON",
  LOST: "LOST",
} as const;

export type BidStatus = (typeof BidStatus)[keyof typeof BidStatus];

export const AuctionErrorCode = {
  OWN_LISTING: "OWN_LISTING",
  AUCTION_CLOSED: "AUCTION_CLOSED",
  AUCTION_NOT_EXPIRED: "AUCTION_NOT_EXPIRED",
  BID_TOO_LOW: "BID_TOO_LOW",
  CANNOT_OUTBID_SELF: "CANNOT_OUTBID_SELF",
  HAS_BIDS: "HAS_BIDS",
  NO_BIDS: "NO_BIDS",
  BELOW_FLOOR: "BELOW_FLOOR",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  GRADE_STALE: "GRADE_STALE",
  COMPARE_MIXED_CROPS: "COMPARE_MIXED_CROPS",
} as const;

export type AuctionErrorCode = (typeof AuctionErrorCode)[keyof typeof AuctionErrorCode];

export const MarketplaceErrorCode = {
  COMPARE_MIXED_CROPS: "COMPARE_MIXED_CROPS",
} as const;

export type MarketplaceErrorCode = (typeof MarketplaceErrorCode)[keyof typeof MarketplaceErrorCode];

export const MarketplaceSort = {
  ENDING_SOONEST: "ending-soonest",
  LOWEST_PRICE: "lowest-price",
  HIGHEST_GRADE: "highest-grade",
  NEWEST: "newest",
} as const;

export type MarketplaceSort = (typeof MarketplaceSort)[keyof typeof MarketplaceSort];

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  UNPAID: "UNPAID",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  COD: "COD",
  WALLET_SIM: "WALLET_SIM",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const FulfilmentMethod = {
  PICKUP: "PICKUP",
  BUYER_ARRANGED: "BUYER_ARRANGED",
} as const;

export type FulfilmentMethod = (typeof FulfilmentMethod)[keyof typeof FulfilmentMethod];

export const OrderAction = {
  CONFIRM: "CONFIRM",
  MARK_PAID: "MARK_PAID",
  MARK_DELIVERED: "MARK_DELIVERED",
  COMPLETE: "COMPLETE",
  DISPUTE: "DISPUTE",
  CANCEL: "CANCEL",
} as const;

export type OrderAction = (typeof OrderAction)[keyof typeof OrderAction];

export const OrderCancelReason = {
  BUYER_CHANGE_OF_MIND: "BUYER_CHANGE_OF_MIND",
  BUYER_CANNOT_COLLECT: "BUYER_CANNOT_COLLECT",
  BUYER_COMMUNICATION_FAILED: "BUYER_COMMUNICATION_FAILED",
  FARMER_CROP_DAMAGED: "FARMER_CROP_DAMAGED",
  FARMER_UNABLE_TO_FULFILL: "FARMER_UNABLE_TO_FULFILL",
  FARMER_COMMUNICATION_FAILED: "FARMER_COMMUNICATION_FAILED",
  CONFIRMATION_TIMEOUT: "CONFIRMATION_TIMEOUT",
  MUTUAL_AGREEMENT: "MUTUAL_AGREEMENT",
  OTHER: "OTHER",
} as const;

export type OrderCancelReason = (typeof OrderCancelReason)[keyof typeof OrderCancelReason];

export const BUYER_CANCEL_REASONS = [
  OrderCancelReason.BUYER_CHANGE_OF_MIND,
  OrderCancelReason.BUYER_CANNOT_COLLECT,
  OrderCancelReason.BUYER_COMMUNICATION_FAILED,
  OrderCancelReason.MUTUAL_AGREEMENT,
  OrderCancelReason.OTHER,
] as const;

export const FARMER_CANCEL_REASONS = [
  OrderCancelReason.FARMER_CROP_DAMAGED,
  OrderCancelReason.FARMER_UNABLE_TO_FULFILL,
  OrderCancelReason.FARMER_COMMUNICATION_FAILED,
  OrderCancelReason.MUTUAL_AGREEMENT,
  OrderCancelReason.OTHER,
] as const;

export const SYSTEM_CANCEL_REASONS = [
  OrderCancelReason.CONFIRMATION_TIMEOUT,
] as const;

export const OrderDisputeReason = {
  GRADE_MISMATCH: "GRADE_MISMATCH",
  WEIGHT_SHORTAGE: "WEIGHT_SHORTAGE",
  DAMAGED_PRODUCE: "DAMAGED_PRODUCE",
  WRONG_CROP: "WRONG_CROP",
  OTHER: "OTHER",
} as const;

export type OrderDisputeReason = (typeof OrderDisputeReason)[keyof typeof OrderDisputeReason];

export const ORDER_DISPUTE_REASONS = [
  OrderDisputeReason.GRADE_MISMATCH,
  OrderDisputeReason.WEIGHT_SHORTAGE,
  OrderDisputeReason.DAMAGED_PRODUCE,
  OrderDisputeReason.WRONG_CROP,
  OrderDisputeReason.OTHER,
] as const;

export const OrderErrorCode = {
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  INVALID_ORDER_TRANSITION: "INVALID_ORDER_TRANSITION",
  ORDER_ACTION_NOT_ALLOWED: "ORDER_ACTION_NOT_ALLOWED",
  ORDER_ALREADY_PAID: "ORDER_ALREADY_PAID",
  HANDOVER_TIME_INVALID: "HANDOVER_TIME_INVALID",
} as const;

export type OrderErrorCode = (typeof OrderErrorCode)[keyof typeof OrderErrorCode];

export const AuctionCloseTrigger = {
  TIMER_EXPIRED: "TIMER_EXPIRED",
  FARMER_ACCEPT: "FARMER_ACCEPT",
  SCHEDULER: "SCHEDULER",
} as const;

export type AuctionCloseTrigger = (typeof AuctionCloseTrigger)[keyof typeof AuctionCloseTrigger];

export const DomainEventName = {
  BID_PLACED: "bid.placed",
  AUCTION_EXTENDED: "auction.extended",
  AUCTION_CLOSED: "auction.closed",
  ORDER_CREATED: "order.created",
} as const;

export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];
