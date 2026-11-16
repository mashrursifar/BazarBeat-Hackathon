/**
 * Dashboard Golden Dataset (Test Fixture)
 *
 * Ground truth test fixture for validating dashboard aggregations, KPI cards,
 * period-over-period percentage changes, and time-series bucketing across
 * the BazarBeat platform.
 *
 * Characteristics:
 * - 2 Farmers (Rajshahi, Rangpur)
 * - 3 Buyers (Dhaka, Chattogram, Sylhet)
 * - 3 Crops (Onion, Potato, Green Chilli)
 * - 24 Listings (15 SOLD, 3 EXPIRED_UNSOLD, 2 CANCELLED, 4 ACTIVE)
 * - 29 Bids (anonymized, winning, outbid, winning bids awarded)
 * - 15 Orders across every status:
 *     - 4 COMPLETED
 *     - 2 DELIVERED
 *     - 3 CONFIRMED
 *     - 2 PENDING
 *     - 2 CANCELLED
 *     - 2 DISPUTED
 * - Fractional kg orders (e.g., 25.5 kg, 12.5 kg, 100.5 kg, 18.5 kg)
 * - Platform fee rounding edge cases (where subtotal * 200 / 10000 rounds up / down)
 * - Orders occurring exactly at Asia/Dhaka midnight (00:00:00 +06:00 == 18:00:00 UTC)
 * - Zero bucket series filling days (e.g. 2026-11-11 has zero sales)
 * - Period-over-period delta zero checks (null delta when previous value is zero)
 */

export const GOLDEN_REFERENCE_DATE = "2026-11-16T12:00:00.000Z";

export interface GoldenUser {
  id: string;
  name: string;
  phone: string;
  role: "FARMER" | "BUYER";
  division: string;
  district: string;
  upazila?: string;
  organization?: string;
}

export interface GoldenCrop {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  unit: "kg";
  minIncrement: number;
}

export interface GoldenBid {
  id: string;
  listingId: string;
  buyerId: string;
  amountPerKg: number;
  totalAmount: number;
  seq: number;
  status: "ACCEPTED" | "WON" | "LOST";
  placedAt: string;
}

export interface GoldenListing {
  id: string;
  farmerId: string;
  cropId: string;
  quantityKg: number;
  grade: "A" | "B" | "C";
  floorPricePerKg: number;
  expectedPricePerKg: number;
  currentBidPerKg: number;
  bidCount: number;
  status: "ACTIVE" | "SOLD" | "EXPIRED_UNSOLD" | "CANCELLED";
  winningBidId?: string;
  winningBidderId?: string;
  createdAt: string;
  endsAt: string;
  closedAt?: string;
}

export interface GoldenOrder {
  id: string;
  listingId: string;
  farmerId: string;
  buyerId: string;
  cropId: string;
  grade: "A" | "B" | "C";
  quantityKg: number;
  pricePerKg: number;
  expectedPricePerKg: number;
  subtotal: number;
  platformFee: number;
  farmerNet: number;
  status: "PENDING" | "CONFIRMED" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "DISPUTED";
  payment: {
    method: "COD" | "WALLET_SIM";
    status: "UNPAID" | "PAID" | "REFUNDED";
    paidAt?: string;
  };
  createdAt: string;
  confirmedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  dispute?: {
    reason: string;
    note?: string;
    raisedAt: string;
  };
}

export interface GoldenMarketPrice {
  cropId: string;
  division: string;
  date: string; // UTC date midnight
  avgPricePerKg: number;
  minPricePerKg: number;
  maxPricePerKg: number;
  source: "SEED" | "PLATFORM";
}

export const GOLDEN_USERS: readonly GoldenUser[] = [
  {
    id: "670000000000000000000001",
    name: "Rahim Farmer",
    phone: "01700000001",
    role: "FARMER",
    division: "rajshahi",
    district: "bogura",
    upazila: "bogura sadar",
  },
  {
    id: "670000000000000000000002",
    name: "Anwar Farmer",
    phone: "01700000002",
    role: "FARMER",
    division: "rangpur",
    district: "rangpur",
    upazila: "mithapukur",
  },
  {
    id: "670000000000000000000011",
    name: "Karim Buyer",
    phone: "01800000001",
    role: "BUYER",
    organization: "Karim Wholesales Ltd",
    division: "dhaka",
    district: "dhaka",
  },
  {
    id: "670000000000000000000012",
    name: "Salim Buyer",
    phone: "01800000002",
    role: "BUYER",
    organization: "Salim Agro Mart",
    division: "chattogram",
    district: "chattogram",
  },
  {
    id: "670000000000000000000013",
    name: "Tariq Buyer",
    phone: "01800000003",
    role: "BUYER",
    organization: "Sylhet Fresh Direct",
    division: "sylhet",
    district: "sylhet",
  },
] as const;

export const GOLDEN_CROPS: readonly GoldenCrop[] = [
  {
    id: "670000000000000000000101",
    name: "Onion",
    nameBn: "পেঁয়াজ",
    slug: "onion",
    unit: "kg",
    minIncrement: 50,
  },
  {
    id: "670000000000000000000102",
    name: "Potato",
    nameBn: "আলু",
    slug: "potato",
    unit: "kg",
    minIncrement: 50,
  },
  {
    id: "670000000000000000000103",
    name: "Green Chilli",
    nameBn: "কাঁচা মরিচ",
    slug: "green-chilli",
    unit: "kg",
    minIncrement: 100,
  },
] as const;

export const GOLDEN_ORDERS: readonly GoldenOrder[] = [
  // Order 01: Fractional kg (25.5kg), Fee rounds UP (116025 * 0.02 = 2320.5 -> 2321 poisha)
  {
    id: "670000000000000000000301",
    listingId: "670000000000000000000201",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000011",
    cropId: "670000000000000000000101",
    grade: "A",
    quantityKg: 25.5,
    pricePerKg: 4550,
    expectedPricePerKg: 4000,
    subtotal: 116025,
    platformFee: 2321,
    farmerNet: 113704,
    status: "COMPLETED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-10T06:00:00.000Z" },
    createdAt: "2026-11-10T05:00:00.000Z", // Asia/Dhaka: 2026-11-10 11:00:00
    confirmedAt: "2026-11-10T05:30:00.000Z",
    deliveredAt: "2026-11-10T08:00:00.000Z",
    completedAt: "2026-11-10T09:00:00.000Z",
  },
  // Order 02: Exact Asia/Dhaka MIDNIGHT (2026-11-09T18:00:00.000Z == 2026-11-10 00:00:00 +06:00)
  {
    id: "670000000000000000000302",
    listingId: "670000000000000000000202",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000012",
    cropId: "670000000000000000000102",
    grade: "B",
    quantityKg: 50.0,
    pricePerKg: 3000,
    expectedPricePerKg: 2800,
    subtotal: 150000,
    platformFee: 3000,
    farmerNet: 147000,
    status: "COMPLETED",
    payment: { method: "COD", status: "PAID", paidAt: "2026-11-10T08:00:00.000Z" },
    createdAt: "2026-11-09T18:00:00.000Z", // EXACT MIDNIGHT in Asia/Dhaka -> bucket 2026-11-10
    confirmedAt: "2026-11-09T19:00:00.000Z",
    deliveredAt: "2026-11-10T06:00:00.000Z",
    completedAt: "2026-11-10T08:00:00.000Z",
  },
  // Order 03: Fractional kg (12.5kg), Fee rounds UP (56875 * 0.02 = 1137.5 -> 1138 poisha)
  {
    id: "670000000000000000000303",
    listingId: "670000000000000000000203",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000013",
    cropId: "670000000000000000000101",
    grade: "A",
    quantityKg: 12.5,
    pricePerKg: 4550,
    expectedPricePerKg: 4200,
    subtotal: 56875,
    platformFee: 1138,
    farmerNet: 55737,
    status: "COMPLETED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-12T10:00:00.000Z" },
    createdAt: "2026-11-12T04:00:00.000Z", // Asia/Dhaka: 2026-11-12 10:00:00
    confirmedAt: "2026-11-12T05:00:00.000Z",
    deliveredAt: "2026-11-12T08:00:00.000Z",
    completedAt: "2026-11-12T10:00:00.000Z",
  },
  // Order 04: Fee rounds DOWN (210015 * 0.02 = 4200.3 -> 4200 poisha)
  {
    id: "670000000000000000000304",
    listingId: "670000000000000000000204",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000011",
    cropId: "670000000000000000000103",
    grade: "A",
    quantityKg: 15.0,
    pricePerKg: 14001,
    expectedPricePerKg: 13500,
    subtotal: 210015,
    platformFee: 4200,
    farmerNet: 205815,
    status: "COMPLETED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-14T07:00:00.000Z" },
    createdAt: "2026-11-14T03:00:00.000Z", // Asia/Dhaka: 2026-11-14 09:00:00
    confirmedAt: "2026-11-14T04:00:00.000Z",
    deliveredAt: "2026-11-14T06:00:00.000Z",
    completedAt: "2026-11-14T07:00:00.000Z",
  },
  // Order 05: Fractional kg (100.5kg), Fee rounds UP (296475 * 0.02 = 5929.5 -> 5930 poisha)
  {
    id: "670000000000000000000305",
    listingId: "670000000000000000000205",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000012",
    cropId: "670000000000000000000102",
    grade: "B",
    quantityKg: 100.5,
    pricePerKg: 2950,
    expectedPricePerKg: 2800,
    subtotal: 296475,
    platformFee: 5930,
    farmerNet: 290545,
    status: "DELIVERED",
    payment: { method: "COD", status: "UNPAID" },
    createdAt: "2026-11-14T10:00:00.000Z", // Asia/Dhaka: 2026-11-14 16:00:00
    confirmedAt: "2026-11-14T11:00:00.000Z",
    deliveredAt: "2026-11-15T04:00:00.000Z",
  },
  // Order 06: Exact Asia/Dhaka MIDNIGHT (2026-11-14T18:00:00.000Z == 2026-11-15 00:00:00 +06:00)
  {
    id: "670000000000000000000306",
    listingId: "670000000000000000000206",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000013",
    cropId: "670000000000000000000101",
    grade: "B",
    quantityKg: 40.0,
    pricePerKg: 4800,
    expectedPricePerKg: 4500,
    subtotal: 192000,
    platformFee: 3840,
    farmerNet: 188160,
    status: "DELIVERED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-15T02:00:00.000Z" },
    createdAt: "2026-11-14T18:00:00.000Z", // EXACT MIDNIGHT in Asia/Dhaka -> bucket 2026-11-15
    confirmedAt: "2026-11-14T19:00:00.000Z",
    deliveredAt: "2026-11-15T06:00:00.000Z",
  },
  // Order 07: Status CONFIRMED
  {
    id: "670000000000000000000307",
    listingId: "670000000000000000000207",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000011",
    cropId: "670000000000000000000103",
    grade: "A",
    quantityKg: 20.0,
    pricePerKg: 14500,
    expectedPricePerKg: 14000,
    subtotal: 290000,
    platformFee: 5800,
    farmerNet: 284200,
    status: "CONFIRMED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-15T08:00:00.000Z" },
    createdAt: "2026-11-15T06:00:00.000Z", // Asia/Dhaka: 2026-11-15 12:00:00
    confirmedAt: "2026-11-15T07:00:00.000Z",
  },
  // Order 08: Status CANCELLED (Excluded from settled earnings!)
  {
    id: "670000000000000000000308",
    listingId: "670000000000000000000208",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000012",
    cropId: "670000000000000000000101",
    grade: "A",
    quantityKg: 30.0,
    pricePerKg: 4600,
    expectedPricePerKg: 4500,
    subtotal: 138000,
    platformFee: 2760,
    farmerNet: 135240,
    status: "CANCELLED",
    payment: { method: "WALLET_SIM", status: "REFUNDED" },
    createdAt: "2026-11-16T02:00:00.000Z", // Asia/Dhaka: 2026-11-16 08:00:00
    cancelledAt: "2026-11-16T03:00:00.000Z",
  },
  // Order 09: Status DISPUTED (Held in dispute, excluded from settled earnings!)
  {
    id: "670000000000000000000309",
    listingId: "670000000000000000000209",
    farmerId: "670000000000000000000001",
    buyerId: "670000000000000000000013",
    cropId: "670000000000000000000102",
    grade: "B",
    quantityKg: 60.0,
    pricePerKg: 3100,
    expectedPricePerKg: 3000,
    subtotal: 186000,
    platformFee: 3720,
    farmerNet: 182280,
    status: "DISPUTED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-16T05:00:00.000Z" },
    createdAt: "2026-11-16T04:00:00.000Z", // Asia/Dhaka: 2026-11-16 10:00:00
    confirmedAt: "2026-11-16T04:30:00.000Z",
    deliveredAt: "2026-11-16T06:00:00.000Z",
    dispute: {
      reason: "GRADE_LOWER_THAN_LISTED",
      note: "Visible bruising and smaller size than grade B specification",
      raisedAt: "2026-11-16T07:00:00.000Z",
    },
  },
  // Farmer 2 Orders:
  // Order 10: In PREVIOUS 7-day period (2026-11-04T06:00:00Z -> Asia/Dhaka 2026-11-04 12:00:00)
  // Provides non-zero previous value for Farmer 2 on 7d range!
  {
    id: "670000000000000000000310",
    listingId: "670000000000000000000210",
    farmerId: "670000000000000000000002",
    buyerId: "670000000000000000000011",
    cropId: "670000000000000000000101",
    grade: "B",
    quantityKg: 80.0,
    pricePerKg: 4400,
    expectedPricePerKg: 4200,
    subtotal: 352000,
    platformFee: 7040,
    farmerNet: 344960,
    status: "CONFIRMED",
    payment: { method: "COD", status: "UNPAID" },
    createdAt: "2026-11-04T06:00:00.000Z", // PREVIOUS 7d period (Nov 03 - Nov 09)
    confirmedAt: "2026-11-04T07:00:00.000Z",
  },
  // Order 11: Fractional kg (18.5kg), Fee rounds UP (256225 * 0.02 = 5124.5 -> 5125 poisha)
  {
    id: "670000000000000000000311",
    listingId: "670000000000000000000211",
    farmerId: "670000000000000000000002",
    buyerId: "670000000000000000000012",
    cropId: "670000000000000000000103",
    grade: "A",
    quantityKg: 18.5,
    pricePerKg: 13850,
    expectedPricePerKg: 13500,
    subtotal: 256225,
    platformFee: 5125,
    farmerNet: 251100,
    status: "CONFIRMED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-15T04:00:00.000Z" },
    createdAt: "2026-11-15T02:00:00.000Z", // Asia/Dhaka: 2026-11-15 08:00:00
    confirmedAt: "2026-11-15T03:00:00.000Z",
  },
  // Order 12: Status PENDING
  {
    id: "670000000000000000000312",
    listingId: "670000000000000000000212",
    farmerId: "670000000000000000000002",
    buyerId: "670000000000000000000011",
    cropId: "670000000000000000000102",
    grade: "C",
    quantityKg: 50.0,
    pricePerKg: 3200,
    expectedPricePerKg: 3000,
    subtotal: 160000,
    platformFee: 3200,
    farmerNet: 156800,
    status: "PENDING",
    payment: { method: "WALLET_SIM", status: "UNPAID" },
    createdAt: "2026-11-16T08:00:00.000Z", // Asia/Dhaka: 2026-11-16 14:00:00
  },
  // Order 13: Status PENDING
  {
    id: "670000000000000000000313",
    listingId: "670000000000000000000213",
    farmerId: "670000000000000000000002",
    buyerId: "670000000000000000000013",
    cropId: "670000000000000000000101",
    grade: "A",
    quantityKg: 35.0,
    pricePerKg: 4700,
    expectedPricePerKg: 4500,
    subtotal: 164500,
    platformFee: 3290,
    farmerNet: 161210,
    status: "PENDING",
    payment: { method: "COD", status: "UNPAID" },
    createdAt: "2026-11-16T09:00:00.000Z", // Asia/Dhaka: 2026-11-16 15:00:00
  },
  // Order 14: Status CANCELLED in previous 7d period
  {
    id: "670000000000000000000314",
    listingId: "670000000000000000000214",
    farmerId: "670000000000000000000002",
    buyerId: "670000000000000000000011",
    cropId: "670000000000000000000102",
    grade: "B",
    quantityKg: 40.0,
    pricePerKg: 2900,
    expectedPricePerKg: 2800,
    subtotal: 116000,
    platformFee: 2320,
    farmerNet: 113680,
    status: "CANCELLED",
    payment: { method: "WALLET_SIM", status: "REFUNDED" },
    createdAt: "2026-11-05T06:00:00.000Z", // PREVIOUS 7d period
    cancelledAt: "2026-11-05T08:00:00.000Z",
  },
  // Order 15: Status DISPUTED in previous 7d period
  {
    id: "670000000000000000000315",
    listingId: "670000000000000000000215",
    farmerId: "670000000000000000000002",
    buyerId: "670000000000000000000012",
    cropId: "670000000000000000000103",
    grade: "B",
    quantityKg: 10.0,
    pricePerKg: 13500,
    expectedPricePerKg: 13000,
    subtotal: 135000,
    platformFee: 2700,
    farmerNet: 132300,
    status: "DISPUTED",
    payment: { method: "WALLET_SIM", status: "PAID", paidAt: "2026-11-06T10:00:00.000Z" },
    createdAt: "2026-11-06T08:00:00.000Z", // PREVIOUS 7d period
    confirmedAt: "2026-11-06T09:00:00.000Z",
    deliveredAt: "2026-11-06T12:00:00.000Z",
    dispute: {
      reason: "QUANTITY_SHORT",
      note: "Scale measured 9.1kg upon handover",
      raisedAt: "2026-11-06T14:00:00.000Z",
    },
  },
] as const;

export const GOLDEN_LISTINGS: readonly GoldenListing[] = [
  // Listings 01..15 are SOLD, generating Orders 01..15
  {
    id: "670000000000000000000201",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000101",
    quantityKg: 25.5,
    grade: "A",
    floorPricePerKg: 4000,
    expectedPricePerKg: 4000,
    currentBidPerKg: 4550,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000401",
    winningBidderId: "670000000000000000000011",
    createdAt: "2026-11-09T03:00:00.000Z",
    endsAt: "2026-11-10T05:00:00.000Z",
    closedAt: "2026-11-10T05:00:00.000Z",
  },
  {
    id: "670000000000000000000202",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000102",
    quantityKg: 50.0,
    grade: "B",
    floorPricePerKg: 2800,
    expectedPricePerKg: 2800,
    currentBidPerKg: 3000,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000403",
    winningBidderId: "670000000000000000000012",
    createdAt: "2026-11-08T18:00:00.000Z",
    endsAt: "2026-11-09T18:00:00.000Z",
    closedAt: "2026-11-09T18:00:00.000Z",
  },
  {
    id: "670000000000000000000203",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000101",
    quantityKg: 12.5,
    grade: "A",
    floorPricePerKg: 4200,
    expectedPricePerKg: 4200,
    currentBidPerKg: 4550,
    bidCount: 1,
    status: "SOLD",
    winningBidId: "670000000000000000000405",
    winningBidderId: "670000000000000000000013",
    createdAt: "2026-11-11T04:00:00.000Z",
    endsAt: "2026-11-12T04:00:00.000Z",
    closedAt: "2026-11-12T04:00:00.000Z",
  },
  {
    id: "670000000000000000000204",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000103",
    quantityKg: 15.0,
    grade: "A",
    floorPricePerKg: 13500,
    expectedPricePerKg: 13500,
    currentBidPerKg: 14001,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000407",
    winningBidderId: "670000000000000000000011",
    createdAt: "2026-11-13T03:00:00.000Z",
    endsAt: "2026-11-14T03:00:00.000Z",
    closedAt: "2026-11-14T03:00:00.000Z",
  },
  {
    id: "670000000000000000000205",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000102",
    quantityKg: 100.5,
    grade: "B",
    floorPricePerKg: 2800,
    expectedPricePerKg: 2800,
    currentBidPerKg: 2950,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000409",
    winningBidderId: "670000000000000000000012",
    createdAt: "2026-11-13T10:00:00.000Z",
    endsAt: "2026-11-14T10:00:00.000Z",
    closedAt: "2026-11-14T10:00:00.000Z",
  },
  {
    id: "670000000000000000000206",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000101",
    quantityKg: 40.0,
    grade: "B",
    floorPricePerKg: 4500,
    expectedPricePerKg: 4500,
    currentBidPerKg: 4800,
    bidCount: 1,
    status: "SOLD",
    winningBidId: "670000000000000000000411",
    winningBidderId: "670000000000000000000013",
    createdAt: "2026-11-13T18:00:00.000Z",
    endsAt: "2026-11-14T18:00:00.000Z",
    closedAt: "2026-11-14T18:00:00.000Z",
  },
  {
    id: "670000000000000000000207",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000103",
    quantityKg: 20.0,
    grade: "A",
    floorPricePerKg: 14000,
    expectedPricePerKg: 14000,
    currentBidPerKg: 14500,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000413",
    winningBidderId: "670000000000000000000011",
    createdAt: "2026-11-14T06:00:00.000Z",
    endsAt: "2026-11-15T06:00:00.000Z",
    closedAt: "2026-11-15T06:00:00.000Z",
  },
  {
    id: "670000000000000000000208",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000101",
    quantityKg: 30.0,
    grade: "A",
    floorPricePerKg: 4500,
    expectedPricePerKg: 4500,
    currentBidPerKg: 4600,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000415",
    winningBidderId: "670000000000000000000012",
    createdAt: "2026-11-15T02:00:00.000Z",
    endsAt: "2026-11-16T02:00:00.000Z",
    closedAt: "2026-11-16T02:00:00.000Z",
  },
  {
    id: "670000000000000000000209",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000102",
    quantityKg: 60.0,
    grade: "B",
    floorPricePerKg: 3000,
    expectedPricePerKg: 3000,
    currentBidPerKg: 3100,
    bidCount: 1,
    status: "SOLD",
    winningBidId: "670000000000000000000417",
    winningBidderId: "670000000000000000000013",
    createdAt: "2026-11-15T04:00:00.000Z",
    endsAt: "2026-11-16T04:00:00.000Z",
    closedAt: "2026-11-16T04:00:00.000Z",
  },
  // Farmer 2 SOLD listings:
  {
    id: "670000000000000000000210",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000101",
    quantityKg: 80.0,
    grade: "B",
    floorPricePerKg: 4200,
    expectedPricePerKg: 4200,
    currentBidPerKg: 4400,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000419",
    winningBidderId: "670000000000000000000011",
    createdAt: "2026-11-03T06:00:00.000Z",
    endsAt: "2026-11-04T06:00:00.000Z",
    closedAt: "2026-11-04T06:00:00.000Z",
  },
  {
    id: "670000000000000000000211",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000103",
    quantityKg: 18.5,
    grade: "A",
    floorPricePerKg: 13500,
    expectedPricePerKg: 13500,
    currentBidPerKg: 13850,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000421",
    winningBidderId: "670000000000000000000012",
    createdAt: "2026-11-14T02:00:00.000Z",
    endsAt: "2026-11-15T02:00:00.000Z",
    closedAt: "2026-11-15T02:00:00.000Z",
  },
  {
    id: "670000000000000000000212",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000102",
    quantityKg: 50.0,
    grade: "C",
    floorPricePerKg: 3000,
    expectedPricePerKg: 3000,
    currentBidPerKg: 3200,
    bidCount: 2,
    status: "SOLD",
    winningBidId: "670000000000000000000423",
    winningBidderId: "670000000000000000000011",
    createdAt: "2026-11-15T08:00:00.000Z",
    endsAt: "2026-11-16T08:00:00.000Z",
    closedAt: "2026-11-16T08:00:00.000Z",
  },
  {
    id: "670000000000000000000213",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000101",
    quantityKg: 35.0,
    grade: "A",
    floorPricePerKg: 4500,
    expectedPricePerKg: 4500,
    currentBidPerKg: 4700,
    bidCount: 1,
    status: "SOLD",
    winningBidId: "670000000000000000000425",
    winningBidderId: "670000000000000000000013",
    createdAt: "2026-11-15T09:00:00.000Z",
    endsAt: "2026-11-16T09:00:00.000Z",
    closedAt: "2026-11-16T09:00:00.000Z",
  },
  {
    id: "670000000000000000000214",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000102",
    quantityKg: 40.0,
    grade: "B",
    floorPricePerKg: 2800,
    expectedPricePerKg: 2800,
    currentBidPerKg: 2900,
    bidCount: 1,
    status: "SOLD",
    winningBidId: "670000000000000000000426",
    winningBidderId: "670000000000000000000011",
    createdAt: "2026-11-04T06:00:00.000Z",
    endsAt: "2026-11-05T06:00:00.000Z",
    closedAt: "2026-11-05T06:00:00.000Z",
  },
  {
    id: "670000000000000000000215",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000103",
    quantityKg: 10.0,
    grade: "B",
    floorPricePerKg: 13000,
    expectedPricePerKg: 13000,
    currentBidPerKg: 13500,
    bidCount: 1,
    status: "SOLD",
    winningBidId: "670000000000000000000427",
    winningBidderId: "670000000000000000000012",
    createdAt: "2026-11-05T08:00:00.000Z",
    endsAt: "2026-11-06T08:00:00.000Z",
    closedAt: "2026-11-06T08:00:00.000Z",
  },
  // Listings 16..18: EXPIRED_UNSOLD
  {
    id: "670000000000000000000216",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000102",
    quantityKg: 70.0,
    grade: "C",
    floorPricePerKg: 3500,
    expectedPricePerKg: 3000,
    currentBidPerKg: 3500,
    bidCount: 0,
    status: "EXPIRED_UNSOLD",
    createdAt: "2026-11-07T08:00:00.000Z",
    endsAt: "2026-11-08T08:00:00.000Z",
    closedAt: "2026-11-08T08:00:00.000Z",
  },
  {
    id: "670000000000000000000217",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000103",
    quantityKg: 25.0,
    grade: "B",
    floorPricePerKg: 16000,
    expectedPricePerKg: 14000,
    currentBidPerKg: 16000,
    bidCount: 0,
    status: "EXPIRED_UNSOLD",
    createdAt: "2026-11-08T09:00:00.000Z",
    endsAt: "2026-11-09T09:00:00.000Z",
    closedAt: "2026-11-09T09:00:00.000Z",
  },
  {
    id: "670000000000000000000218",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000103",
    quantityKg: 20.0,
    grade: "C",
    floorPricePerKg: 15500,
    expectedPricePerKg: 13500,
    currentBidPerKg: 15500,
    bidCount: 0,
    status: "EXPIRED_UNSOLD",
    createdAt: "2026-11-06T10:00:00.000Z",
    endsAt: "2026-11-07T10:00:00.000Z",
    closedAt: "2026-11-07T10:00:00.000Z",
  },
  // Listings 19..20: CANCELLED
  {
    id: "670000000000000000000219",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000101",
    quantityKg: 45.0,
    grade: "B",
    floorPricePerKg: 4800,
    expectedPricePerKg: 4400,
    currentBidPerKg: 4800,
    bidCount: 0,
    status: "CANCELLED",
    createdAt: "2026-11-06T03:00:00.000Z",
    endsAt: "2026-11-07T03:00:00.000Z",
    closedAt: "2026-11-06T04:00:00.000Z",
  },
  {
    id: "670000000000000000000220",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000102",
    quantityKg: 30.0,
    grade: "A",
    floorPricePerKg: 3300,
    expectedPricePerKg: 3000,
    currentBidPerKg: 3300,
    bidCount: 0,
    status: "CANCELLED",
    createdAt: "2026-11-06T05:00:00.000Z",
    endsAt: "2026-11-07T05:00:00.000Z",
    closedAt: "2026-11-06T06:00:00.000Z",
  },
  // Listings 21..24: ACTIVE
  {
    id: "670000000000000000000221",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000101",
    quantityKg: 65.0,
    grade: "A",
    floorPricePerKg: 4000,
    expectedPricePerKg: 4000,
    currentBidPerKg: 4500,
    bidCount: 2,
    status: "ACTIVE",
    createdAt: "2026-11-16T10:00:00.000Z",
    endsAt: "2026-11-16T14:00:00.000Z",
  },
  {
    id: "670000000000000000000222",
    farmerId: "670000000000000000000001",
    cropId: "670000000000000000000103",
    quantityKg: 30.0,
    grade: "A",
    floorPricePerKg: 13000,
    expectedPricePerKg: 13000,
    currentBidPerKg: 14000,
    bidCount: 2,
    status: "ACTIVE",
    createdAt: "2026-11-16T11:00:00.000Z",
    endsAt: "2026-11-16T17:00:00.000Z",
  },
  {
    id: "670000000000000000000223",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000102",
    quantityKg: 50.0,
    grade: "B",
    floorPricePerKg: 2800,
    expectedPricePerKg: 2800,
    currentBidPerKg: 3100,
    bidCount: 1,
    status: "ACTIVE",
    createdAt: "2026-11-16T11:30:00.000Z",
    endsAt: "2026-11-16T15:30:00.000Z",
  },
  {
    id: "670000000000000000000224",
    farmerId: "670000000000000000000002",
    cropId: "670000000000000000000101",
    quantityKg: 40.0,
    grade: "B",
    floorPricePerKg: 4200,
    expectedPricePerKg: 4200,
    currentBidPerKg: 4200,
    bidCount: 0,
    status: "ACTIVE",
    createdAt: "2026-11-16T12:00:00.000Z",
    endsAt: "2026-11-17T00:00:00.000Z",
  },
] as const;

export const GOLDEN_BIDS: readonly GoldenBid[] = [
  // Bids for Listing 01:
  {
    id: "670000000000000000000400",
    listingId: "670000000000000000000201",
    buyerId: "670000000000000000000012",
    amountPerKg: 4200,
    totalAmount: 107100,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-09T04:00:00.000Z",
  },
  {
    id: "670000000000000000000401",
    listingId: "670000000000000000000201",
    buyerId: "670000000000000000000011",
    amountPerKg: 4550,
    totalAmount: 116025,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-09T06:00:00.000Z",
  },
  // Bids for Listing 02:
  {
    id: "670000000000000000000402",
    listingId: "670000000000000000000202",
    buyerId: "670000000000000000000011",
    amountPerKg: 2900,
    totalAmount: 145000,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-09T08:00:00.000Z",
  },
  {
    id: "670000000000000000000403",
    listingId: "670000000000000000000202",
    buyerId: "670000000000000000000012",
    amountPerKg: 3000,
    totalAmount: 150000,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-09T17:00:00.000Z",
  },
  // Listing 03:
  {
    id: "670000000000000000000405",
    listingId: "670000000000000000000203",
    buyerId: "670000000000000000000013",
    amountPerKg: 4550,
    totalAmount: 56875,
    seq: 1,
    status: "WON",
    placedAt: "2026-11-11T06:00:00.000Z",
  },
  // Listing 04:
  {
    id: "670000000000000000000406",
    listingId: "670000000000000000000204",
    buyerId: "670000000000000000000012",
    amountPerKg: 13800,
    totalAmount: 207000,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-13T06:00:00.000Z",
  },
  {
    id: "670000000000000000000407",
    listingId: "670000000000000000000204",
    buyerId: "670000000000000000000011",
    amountPerKg: 14001,
    totalAmount: 210015,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-13T08:00:00.000Z",
  },
  // Listing 05:
  {
    id: "670000000000000000000408",
    listingId: "670000000000000000000205",
    buyerId: "670000000000000000000011",
    amountPerKg: 2850,
    totalAmount: 286425,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-13T12:00:00.000Z",
  },
  {
    id: "670000000000000000000409",
    listingId: "670000000000000000000205",
    buyerId: "670000000000000000000012",
    amountPerKg: 2950,
    totalAmount: 296475,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-14T02:00:00.000Z",
  },
  // Listing 06:
  {
    id: "670000000000000000000411",
    listingId: "670000000000000000000206",
    buyerId: "670000000000000000000013",
    amountPerKg: 4800,
    totalAmount: 192000,
    seq: 1,
    status: "WON",
    placedAt: "2026-11-14T12:00:00.000Z",
  },
  // Listing 07:
  {
    id: "670000000000000000000412",
    listingId: "670000000000000000000207",
    buyerId: "670000000000000000000013",
    amountPerKg: 14200,
    totalAmount: 284000,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-14T10:00:00.000Z",
  },
  {
    id: "670000000000000000000413",
    listingId: "670000000000000000000207",
    buyerId: "670000000000000000000011",
    amountPerKg: 14500,
    totalAmount: 290000,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-14T16:00:00.000Z",
  },
  // Listing 08:
  {
    id: "670000000000000000000414",
    listingId: "670000000000000000000208",
    buyerId: "670000000000000000000013",
    amountPerKg: 4500,
    totalAmount: 135000,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-15T04:00:00.000Z",
  },
  {
    id: "670000000000000000000415",
    listingId: "670000000000000000000208",
    buyerId: "670000000000000000000012",
    amountPerKg: 4600,
    totalAmount: 138000,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-15T08:00:00.000Z",
  },
  // Listing 09:
  {
    id: "670000000000000000000417",
    listingId: "670000000000000000000209",
    buyerId: "670000000000000000000013",
    amountPerKg: 3100,
    totalAmount: 186000,
    seq: 1,
    status: "WON",
    placedAt: "2026-11-15T10:00:00.000Z",
  },
  // Listing 10:
  {
    id: "670000000000000000000418",
    listingId: "670000000000000000000210",
    buyerId: "670000000000000000000012",
    amountPerKg: 4300,
    totalAmount: 344000,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-03T08:00:00.000Z",
  },
  {
    id: "670000000000000000000419",
    listingId: "670000000000000000000210",
    buyerId: "670000000000000000000011",
    amountPerKg: 4400,
    totalAmount: 352000,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-03T12:00:00.000Z",
  },
  // Listing 11:
  {
    id: "670000000000000000000420",
    listingId: "670000000000000000000211",
    buyerId: "670000000000000000000013",
    amountPerKg: 13600,
    totalAmount: 251600,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-14T06:00:00.000Z",
  },
  {
    id: "670000000000000000000421",
    listingId: "670000000000000000000211",
    buyerId: "670000000000000000000012",
    amountPerKg: 13850,
    totalAmount: 256225,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-14T10:00:00.000Z",
  },
  // Listing 12:
  {
    id: "670000000000000000000422",
    listingId: "670000000000000000000212",
    buyerId: "670000000000000000000013",
    amountPerKg: 3100,
    totalAmount: 155000,
    seq: 1,
    status: "LOST",
    placedAt: "2026-11-15T12:00:00.000Z",
  },
  {
    id: "670000000000000000000423",
    listingId: "670000000000000000000212",
    buyerId: "670000000000000000000011",
    amountPerKg: 3200,
    totalAmount: 160000,
    seq: 2,
    status: "WON",
    placedAt: "2026-11-15T16:00:00.000Z",
  },
  // Listing 13:
  {
    id: "670000000000000000000425",
    listingId: "670000000000000000000213",
    buyerId: "670000000000000000000013",
    amountPerKg: 4700,
    totalAmount: 164500,
    seq: 1,
    status: "WON",
    placedAt: "2026-11-15T18:00:00.000Z",
  },
  // Listing 14:
  {
    id: "670000000000000000000426",
    listingId: "670000000000000000000214",
    buyerId: "670000000000000000000011",
    amountPerKg: 2900,
    totalAmount: 116000,
    seq: 1,
    status: "WON",
    placedAt: "2026-11-04T12:00:00.000Z",
  },
  // Listing 15:
  {
    id: "670000000000000000000427",
    listingId: "670000000000000000000215",
    buyerId: "670000000000000000000012",
    amountPerKg: 13500,
    totalAmount: 135000,
    seq: 1,
    status: "WON",
    placedAt: "2026-11-05T12:00:00.000Z",
  },
  // Active listing bids (Listings 21..23):
  {
    id: "670000000000000000000430",
    listingId: "670000000000000000000221",
    buyerId: "670000000000000000000012",
    amountPerKg: 4200,
    totalAmount: 273000,
    seq: 1,
    status: "ACCEPTED",
    placedAt: "2026-11-16T10:15:00.000Z",
  },
  {
    id: "670000000000000000000431",
    listingId: "670000000000000000000221",
    buyerId: "670000000000000000000011",
    amountPerKg: 4500,
    totalAmount: 292500,
    seq: 2,
    status: "ACCEPTED",
    placedAt: "2026-11-16T10:45:00.000Z",
  },
  {
    id: "670000000000000000000432",
    listingId: "670000000000000000000222",
    buyerId: "670000000000000000000011",
    amountPerKg: 13500,
    totalAmount: 405000,
    seq: 1,
    status: "ACCEPTED",
    placedAt: "2026-11-16T11:15:00.000Z",
  },
  {
    id: "670000000000000000000433",
    listingId: "670000000000000000000222",
    buyerId: "670000000000000000000012",
    amountPerKg: 14000,
    totalAmount: 420000,
    seq: 2,
    status: "ACCEPTED",
    placedAt: "2026-11-16T11:45:00.000Z",
  },
  {
    id: "670000000000000000000434",
    listingId: "670000000000000000000223",
    buyerId: "670000000000000000000013",
    amountPerKg: 3100,
    totalAmount: 155000,
    seq: 1,
    status: "ACCEPTED",
    placedAt: "2026-11-16T11:45:00.000Z",
  },
] as const;

export const GOLDEN_MARKET_PRICES: readonly GoldenMarketPrice[] = [
  // Onion (Rajshahi)
  { cropId: "670000000000000000000101", division: "rajshahi", date: "2026-11-10T00:00:00.000Z", avgPricePerKg: 4500, minPricePerKg: 4200, maxPricePerKg: 4800, source: "PLATFORM" },
  { cropId: "670000000000000000000101", division: "rajshahi", date: "2026-11-12T00:00:00.000Z", avgPricePerKg: 4550, minPricePerKg: 4300, maxPricePerKg: 4900, source: "PLATFORM" },
  { cropId: "670000000000000000000101", division: "rajshahi", date: "2026-11-15T00:00:00.000Z", avgPricePerKg: 4700, minPricePerKg: 4500, maxPricePerKg: 5000, source: "PLATFORM" },
  { cropId: "670000000000000000000101", division: "rajshahi", date: "2026-11-16T00:00:00.000Z", avgPricePerKg: 4600, minPricePerKg: 4400, maxPricePerKg: 4900, source: "PLATFORM" },
  // Onion (Rangpur)
  { cropId: "670000000000000000000101", division: "rangpur", date: "2026-11-04T00:00:00.000Z", avgPricePerKg: 4400, minPricePerKg: 4100, maxPricePerKg: 4600, source: "PLATFORM" },
  { cropId: "670000000000000000000101", division: "rangpur", date: "2026-11-16T00:00:00.000Z", avgPricePerKg: 4700, minPricePerKg: 4500, maxPricePerKg: 5000, source: "PLATFORM" },
  // Onion (Dhaka)
  { cropId: "670000000000000000000101", division: "dhaka", date: "2026-11-16T00:00:00.000Z", avgPricePerKg: 5200, minPricePerKg: 4800, maxPricePerKg: 5500, source: "SEED" },
  // Potato (Rajshahi)
  { cropId: "670000000000000000000102", division: "rajshahi", date: "2026-11-10T00:00:00.000Z", avgPricePerKg: 3000, minPricePerKg: 2800, maxPricePerKg: 3200, source: "PLATFORM" },
  { cropId: "670000000000000000000102", division: "rajshahi", date: "2026-11-14T00:00:00.000Z", avgPricePerKg: 2950, minPricePerKg: 2750, maxPricePerKg: 3150, source: "PLATFORM" },
  { cropId: "670000000000000000000102", division: "rajshahi", date: "2026-11-16T00:00:00.000Z", avgPricePerKg: 3100, minPricePerKg: 2900, maxPricePerKg: 3300, source: "PLATFORM" },
  // Potato (Rangpur)
  { cropId: "670000000000000000000102", division: "rangpur", date: "2026-11-05T00:00:00.000Z", avgPricePerKg: 2900, minPricePerKg: 2700, maxPricePerKg: 3100, source: "PLATFORM" },
  { cropId: "670000000000000000000102", division: "rangpur", date: "2026-11-16T00:00:00.000Z", avgPricePerKg: 3200, minPricePerKg: 3000, maxPricePerKg: 3400, source: "PLATFORM" },
  // Green Chilli (Rajshahi)
  { cropId: "670000000000000000000103", division: "rajshahi", date: "2026-11-14T00:00:00.000Z", avgPricePerKg: 14000, minPricePerKg: 13000, maxPricePerKg: 15000, source: "PLATFORM" },
  { cropId: "670000000000000000000103", division: "rajshahi", date: "2026-11-15T00:00:00.000Z", avgPricePerKg: 14500, minPricePerKg: 13500, maxPricePerKg: 15500, source: "PLATFORM" },
  // Green Chilli (Rangpur)
  { cropId: "670000000000000000000103", division: "rangpur", date: "2026-11-06T00:00:00.000Z", avgPricePerKg: 13500, minPricePerKg: 12500, maxPricePerKg: 14500, source: "PLATFORM" },
  { cropId: "670000000000000000000103", division: "rangpur", date: "2026-11-15T00:00:00.000Z", avgPricePerKg: 13850, minPricePerKg: 13000, maxPricePerKg: 14800, source: "PLATFORM" },
] as const;

/**
 * Expected values for human review and automated test assertions.
 */
export const GOLDEN_EXPECTED_VALUES = {
  referenceDate: GOLDEN_REFERENCE_DATE,
  farmer1: {
    // Farmer 1 (30d range: 2026-10-18 to 2026-11-16)
    // Orders 1..7 are valid non-cancelled non-disputed orders
    // Subtotal = 116025 + 150000 + 56875 + 210015 + 296475 + 192000 + 290000 = 1,311,390 poisha
    // Net = 113704 + 147000 + 55737 + 205815 + 290545 + 188160 + 284200 = 1,285,161 poisha
    // Fees = 2321 + 3000 + 1138 + 4200 + 5930 + 3840 + 5800 = 26,229 poisha
    // Order 8 is CANCELLED (excluded)
    // Order 9 is DISPUTED (excluded from settled)
    kpis30d: {
      totalSales: { value: 1311390, previous: 0, changePercent: null },
      earnings: { value: 1285161, previous: 0, changePercent: null },
      activeAuctions: { value: 2, previous: 0, changePercent: null },
      pendingOrders: { value: 0, previous: 0, changePercent: null },
      winRate: { value: 75.0, previous: null, changePercent: null }, // 9 sold / 12 closed = 75.0%
      topCrop: {
        cropId: "670000000000000000000103", // Green Chilli has highest total sales (500,015)
        cropName: "Green Chilli",
        quantityKg: 35.0,
        totalSales: 500015,
        earnings: 490015,
        orderCount: 2,
      },
    },
    // Farmer 1 (7d range: 2026-11-10 to 2026-11-16)
    // Current period has all 7 orders; previous period (Nov 03 - Nov 09) has 0 orders.
    // Previous is 0 => changePercent is null!
    kpis7d: {
      totalSales: { value: 1311390, previous: 0, changePercent: null },
      earnings: { value: 1285161, previous: 0, changePercent: null },
      activeAuctions: { value: 2, previous: 0, changePercent: null },
      pendingOrders: { value: 0, previous: 0, changePercent: null },
      winRate: { value: 75.0, previous: null, changePercent: null },
    },
    salesTrend7d: [
      { bucket: "2026-11-10", date: "2026-11-10", sales: 266025, quantityKg: 75.5, orderCount: 2 },
      { bucket: "2026-11-11", date: "2026-11-11", sales: 0, quantityKg: 0, orderCount: 0 }, // ZERO BUCKET
      { bucket: "2026-11-12", date: "2026-11-12", sales: 56875, quantityKg: 12.5, orderCount: 1 },
      { bucket: "2026-11-13", date: "2026-11-13", sales: 0, quantityKg: 0, orderCount: 0 }, // ZERO BUCKET
      { bucket: "2026-11-14", date: "2026-11-14", sales: 506490, quantityKg: 115.5, orderCount: 2 },
      { bucket: "2026-11-15", date: "2026-11-15", sales: 482000, quantityKg: 60.0, orderCount: 2 }, // Order 6 (midnight: 192,000) + Order 7 (290,000)
      { bucket: "2026-11-16", date: "2026-11-16", sales: 0, quantityKg: 0, orderCount: 0 }, // Orders 8 & 9 are cancelled/disputed
    ],
  },
  farmer2: {
    // Farmer 2:
    // Orders 10, 11, 12, 13 are valid non-cancelled non-disputed orders
    // Subtotal (30d) = 352000 (Order 10) + 256225 (Order 11) + 160000 (Order 12) + 164500 (Order 13) = 932,725 poisha
    // Net (30d) = 344960 + 251100 + 156800 + 161210 = 914,070 poisha
    // Fees (30d) = 7040 + 5125 + 3200 + 3290 = 18,655 poisha
    // Order 14 is CANCELLED (Nov 05)
    // Order 15 is DISPUTED (Nov 06)
    kpis30d: {
      totalSales: { value: 932725, previous: 0, changePercent: null },
      earnings: { value: 914070, previous: 0, changePercent: null },
      activeAuctions: { value: 2, previous: 0, changePercent: null },
      pendingOrders: { value: 2, previous: 0, changePercent: null }, // Orders 12 & 13 are PENDING
      winRate: { value: 75.0, previous: null, changePercent: null }, // 6 sold / 8 closed = 75.0%
      topCrop: {
        cropId: "670000000000000000000101", // Onion: Order 10 (352k) + Order 13 (164.5k) = 516.5k
        cropName: "Onion",
        quantityKg: 115.0,
        totalSales: 516500,
        earnings: 506170,
        orderCount: 2,
      },
    },
    // Farmer 2 (7d range: 2026-11-10 to 2026-11-16 vs previous 2026-11-03 to 2026-11-09):
    // Current 7d sales: Order 11 (256,225) + Order 12 (160,000) + Order 13 (164,500) = 580,725 poisha
    // Previous 7d sales: Order 10 (352,000 poisha on Nov 04)
    // Change % = ((580725 - 352000) / 352000) * 100 = +65.0%
    kpis7d: {
      totalSales: { value: 580725, previous: 352000, changePercent: 65.0 },
      earnings: { value: 569110, previous: 344960, changePercent: 65.0 },
      activeAuctions: { value: 2, previous: 0, changePercent: null },
      pendingOrders: { value: 2, previous: 0, changePercent: null },
      winRate: { value: 75.0, previous: null, changePercent: null },
    },
  },
  buyer1: {
    // Buyer 1:
    // Won Orders: 01, 04, 07, 10, 12 (Order 14 cancelled)
    // Total Spend (30d): 116025 + 210015 + 290000 + 352000 + 160000 = 1,128,040 poisha
    // Active Bids: 2 (Listing 21 WINNING, Listing 22 OUTBID)
    // Pending Orders: 1 (Order 12)
    // Win Rate: 6 won / 8 ended = 75.0%
    kpis30d: {
      totalSpend: { value: 1128040, previous: 0, changePercent: null },
      activeBids: { value: 2, previous: 0, changePercent: null },
      winRate: { value: 75.0, previous: null, changePercent: null },
      pendingOrders: { value: 1, previous: 0, changePercent: null },
      avgPriceVsMarket: { value: 6.8, previous: null, changePercent: null },
    },
  },
  buyer2: {
    // Buyer 2:
    // Won Orders: 02, 05, 11 (Order 08 cancelled, Order 15 disputed)
    // Total Spend (30d, uncancelled): 150000 + 296475 + 256225 = 702,700 poisha (or 837,700 with disputed)
    // Active Bids: 2 (Listing 21 OUTBID, Listing 22 WINNING)
    // Pending Orders: 0
    // Win Rate: 5 won / 8 ended = 62.5%
    kpis30d: {
      totalSpend: { value: 702700, previous: 0, changePercent: null },
      activeBids: { value: 2, previous: 0, changePercent: null },
      winRate: { value: 62.5, previous: null, changePercent: null },
      pendingOrders: { value: 0, previous: 0, changePercent: null },
      avgPriceVsMarket: { value: 4.7, previous: null, changePercent: null },
    },
  },
  buyer3: {
    // Buyer 3:
    // Won Orders: 03, 06, 09, 13
    // Total Spend (30d, uncancelled): 56875 + 192000 + 186000 + 164500 = 599,375 poisha
    // Active Bids: 1 (Listing 23 WINNING)
    // Pending Orders: 1 (Order 13)
    // Win Rate: 4 won / 8 ended = 50.0%
    kpis30d: {
      totalSpend: { value: 599375, previous: 0, changePercent: null },
      activeBids: { value: 1, previous: 0, changePercent: null },
      winRate: { value: 50.0, previous: null, changePercent: null },
      pendingOrders: { value: 1, previous: 0, changePercent: null },
      avgPriceVsMarket: { value: 5.7, previous: null, changePercent: null },
    },
  },
} as const;
