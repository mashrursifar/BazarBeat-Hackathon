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
  BID_TOO_LOW: "BID_TOO_LOW",
  CANNOT_OUTBID_SELF: "CANNOT_OUTBID_SELF",
  HAS_BIDS: "HAS_BIDS",
  BELOW_FLOOR: "BELOW_FLOOR",
  INVALID_TRANSITION: "INVALID_TRANSITION",
} as const;

export type AuctionErrorCode = (typeof AuctionErrorCode)[keyof typeof AuctionErrorCode];

export const DomainEventName = {
  BID_PLACED: "bid.placed",
  AUCTION_EXTENDED: "auction.extended",
  AUCTION_CLOSED: "auction.closed",
  ORDER_CREATED: "order.created",
} as const;

export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];
