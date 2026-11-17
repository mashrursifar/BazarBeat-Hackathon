import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";

import {
  CropGrade,
  type FarmerListing,
  type PublicUser,
  UserRole,
  normalizeBangladeshPhone,
} from "@bazarbeat/shared";

import { logger } from "../shared/logger.js";
import { User } from "../modules/users/user.model.js";
import { toPublicUser } from "../modules/users/user.mapper.js";
import { Crop } from "../modules/crops/crop.model.js";
import { CROP_SEED_DATA } from "../modules/crops/crop-seed-data.js";
import { seedCropCatalog } from "../modules/crops/crop-seed.js";
import { MarketPrice } from "../modules/market-prices/market-price.model.js";
import { seedMarketPriceHistory } from "../modules/market-prices/market-price-seed.js";
import { Listing } from "../modules/listings/listing.model.js";
import { createAndPublishListing } from "../modules/listings/listing.service.js";
import { Bid } from "../modules/bids/bid.model.js";
import { placeBid } from "../modules/bids/bid.service.js";
import { IdempotencyRecord } from "../modules/bids/idempotency-record.model.js";
import { InventoryItem } from "../modules/inventory/inventory-item.model.js";
import { StockMovement } from "../modules/inventory/stock-movement.model.js";
import { addStock } from "../modules/inventory/inventory.service.js";
import { assessCropQuality, getGradingProvider } from "../modules/ai/ai.service.js";
import type { MockGradingProvider } from "../modules/ai/mock-grading.provider.js";
import { AiAssessmentRecord } from "../modules/ai/ai-assessment-record.model.js";
import { Order } from "../modules/orders/order.model.js";
import {
  type SeedDevHistoryResult,
  seedDevHistory,
} from "./dev-history-seeder.js";

const BCRYPT_COST = 10;

export interface SeedDevListingsOptions {
  silent?: boolean;
  sampleDir?: string;
  nodeEnv?: string;
  history?: boolean;
}

export interface SeedDevListingsResult {
  farmers: PublicUser[];
  buyers: PublicUser[];
  listings: FarmerListing[];
  bidsCount: number;
  reconciliationPassed: boolean;
  history?: SeedDevHistoryResult;
}

export interface UserSeedDefinition {
  phone: string;
  name: string;
  password: string;
  role: UserRole;
  division: string;
  district: string;
  upazila: string;
  organization?: string;
}

/**
 * Demo credentials printed for manual testing, reviewer inspection, and E2E automation.
 */
export const DEV_SEED_CREDENTIALS = {
  farmer: {
    phone: "01700000001",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Rahim Uddin (Demo Farmer)",
    division: "dhaka",
    district: "dhaka",
    upazila: "Savar",
  },
  buyer: {
    phone: "01712345678",
    password: "buyerpassword123",
    role: UserRole.BUYER,
    name: "Demo Buyer (Karim Traders)",
    division: "dhaka",
    district: "dhaka",
    upazila: "Dhanmondi",
    organization: "Bengal Agro Wholesale Ltd",
  },
} as const;

/**
 * 8 farmers spanning all 8 administrative divisions of Bangladesh (>= 6 divisions required).
 */
export const SEED_FARMER_DEFINITIONS: readonly UserSeedDefinition[] = [
  DEV_SEED_CREDENTIALS.farmer,
  {
    phone: "01700000002",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Abul Hossain",
    division: "rajshahi",
    district: "bogura",
    upazila: "Sadar",
  },
  {
    phone: "01700000003",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Tariqul Islam",
    division: "rangpur",
    district: "dinajpur",
    upazila: "Sadar",
  },
  {
    phone: "01700000004",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Kamal Uddin",
    division: "chattogram",
    district: "cumilla",
    upazila: "Sadar",
  },
  {
    phone: "01700000005",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Anisur Rahman",
    division: "khulna",
    district: "jashore",
    upazila: "Sadar",
  },
  {
    phone: "01700000006",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Mizanur Rahman",
    division: "barishal",
    district: "barishal",
    upazila: "Sadar",
  },
  {
    phone: "01700000007",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Jamil Ahmed",
    division: "sylhet",
    district: "sylhet",
    upazila: "Sadar",
  },
  {
    phone: "01700000008",
    password: "farmerpassword123",
    role: UserRole.FARMER,
    name: "Fazlul Haque",
    division: "mymensingh",
    district: "jamalpur",
    upazila: "Sadar",
  },
];

/**
 * Seed buyers for placing competitive bids across active auctions.
 */
export const SEED_BUYER_DEFINITIONS: readonly UserSeedDefinition[] = [
  DEV_SEED_CREDENTIALS.buyer,
  {
    phone: "01800000002",
    password: "buyerpassword123",
    role: UserRole.BUYER,
    name: "Chittagong Fresh Mart",
    division: "chattogram",
    district: "chattogram",
    upazila: "Kotwali",
    organization: "Chattogram Fresh Mart",
  },
  {
    phone: "01800000003",
    password: "buyerpassword123",
    role: UserRole.BUYER,
    name: "Northern Agro Wholesalers",
    division: "rajshahi",
    district: "rajshahi",
    upazila: "Boalia",
    organization: "Northern Wholesalers Ltd",
  },
];

interface ListingSeedPlanItem {
  cropSlug: string;
  grade: CropGrade;
  farmerIndex: number;
  quantityKg: number;
  floorPricePerKg: number;
  durationMinutes: number;
  bids?: Array<{ buyerIndex: number; markupPerKg: number }>;
}

/**
 * 25 curated listings across all 5 crops and all grades (A, B, C).
 * Varied floors, quantities, and durations (including some ending soon <= 1h).
 */
export const LISTING_SEED_PLAN: readonly ListingSeedPlanItem[] = [
  // --- Onion (5 listings: 2 A, 2 B, 1 C) ---
  {
    cropSlug: "onion",
    grade: CropGrade.A,
    farmerIndex: 0, // Dhaka
    quantityKg: 100,
    floorPricePerKg: 6400,
    durationMinutes: 45, // Ending soon (< 1h)
    bids: [{ buyerIndex: 0, markupPerKg: 0 }],
  },
  {
    cropSlug: "onion",
    grade: CropGrade.A,
    farmerIndex: 1, // Rajshahi
    quantityKg: 250,
    floorPricePerKg: 6200,
    durationMinutes: 180,
    bids: [
      { buyerIndex: 0, markupPerKg: 0 },
      { buyerIndex: 1, markupPerKg: 100 },
    ],
  },
  {
    cropSlug: "onion",
    grade: CropGrade.B,
    farmerIndex: 2, // Rangpur
    quantityKg: 50,
    floorPricePerKg: 5800,
    durationMinutes: 360,
    // No bids
  },
  {
    cropSlug: "onion",
    grade: CropGrade.B,
    farmerIndex: 3, // Chattogram
    quantityKg: 500,
    floorPricePerKg: 6000,
    durationMinutes: 720,
    bids: [{ buyerIndex: 1, markupPerKg: 0 }],
  },
  {
    cropSlug: "onion",
    grade: CropGrade.C,
    farmerIndex: 4, // Khulna
    quantityKg: 800,
    floorPricePerKg: 5100,
    durationMinutes: 1440,
    // No bids
  },

  // --- Green Chilli (5 listings: 2 A, 2 B, 1 C) ---
  {
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    farmerIndex: 5, // Barishal
    quantityKg: 25,
    floorPricePerKg: 15000,
    durationMinutes: 45, // Ending soon
    bids: [
      { buyerIndex: 0, markupPerKg: 0 },
      { buyerIndex: 1, markupPerKg: 100 },
      { buyerIndex: 2, markupPerKg: 200 },
    ],
  },
  {
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    farmerIndex: 6, // Sylhet
    quantityKg: 50,
    floorPricePerKg: 14600,
    durationMinutes: 180,
    bids: [{ buyerIndex: 0, markupPerKg: 0 }],
  },
  {
    cropSlug: "green-chilli",
    grade: CropGrade.B,
    farmerIndex: 7, // Mymensingh
    quantityKg: 15,
    floorPricePerKg: 13800,
    durationMinutes: 360,
    // No bids
  },
  {
    cropSlug: "green-chilli",
    grade: CropGrade.B,
    farmerIndex: 0, // Dhaka
    quantityKg: 100,
    floorPricePerKg: 13400,
    durationMinutes: 720,
    bids: [
      { buyerIndex: 1, markupPerKg: 0 },
      { buyerIndex: 0, markupPerKg: 100 },
    ],
  },
  {
    cropSlug: "green-chilli",
    grade: CropGrade.C,
    farmerIndex: 1, // Rajshahi
    quantityKg: 150,
    floorPricePerKg: 11800,
    durationMinutes: 1440,
    // No bids
  },

  // --- Bitter Gourd (5 listings: 2 A, 2 B, 1 C) ---
  {
    cropSlug: "bitter-gourd",
    grade: CropGrade.A,
    farmerIndex: 2, // Rangpur
    quantityKg: 50,
    floorPricePerKg: 8600,
    durationMinutes: 45, // Ending soon
    bids: [{ buyerIndex: 0, markupPerKg: 0 }],
  },
  {
    cropSlug: "bitter-gourd",
    grade: CropGrade.A,
    farmerIndex: 3, // Chattogram
    quantityKg: 100,
    floorPricePerKg: 8800,
    durationMinutes: 180,
    // No bids
  },
  {
    cropSlug: "bitter-gourd",
    grade: CropGrade.B,
    farmerIndex: 4, // Khulna
    quantityKg: 30,
    floorPricePerKg: 7900,
    durationMinutes: 360,
    bids: [
      { buyerIndex: 2, markupPerKg: 0 },
      { buyerIndex: 0, markupPerKg: 100 },
    ],
  },
  {
    cropSlug: "bitter-gourd",
    grade: CropGrade.B,
    farmerIndex: 5, // Barishal
    quantityKg: 200,
    floorPricePerKg: 8100,
    durationMinutes: 720,
    // No bids
  },
  {
    cropSlug: "bitter-gourd",
    grade: CropGrade.C,
    farmerIndex: 6, // Sylhet
    quantityKg: 350,
    floorPricePerKg: 6900,
    durationMinutes: 1440,
    bids: [{ buyerIndex: 1, markupPerKg: 0 }],
  },

  // --- Eggplant (5 listings: 2 A, 2 B, 1 C) ---
  {
    cropSlug: "eggplant",
    grade: CropGrade.A,
    farmerIndex: 7, // Mymensingh
    quantityKg: 40,
    floorPricePerKg: 6500,
    durationMinutes: 45, // Ending soon
    bids: [
      { buyerIndex: 0, markupPerKg: 0 },
      { buyerIndex: 1, markupPerKg: 100 },
    ],
  },
  {
    cropSlug: "eggplant",
    grade: CropGrade.A,
    farmerIndex: 0, // Dhaka
    quantityKg: 120,
    floorPricePerKg: 6300,
    durationMinutes: 180,
    // No bids
  },
  {
    cropSlug: "eggplant",
    grade: CropGrade.B,
    farmerIndex: 1, // Rajshahi
    quantityKg: 80,
    floorPricePerKg: 5900,
    durationMinutes: 360,
    bids: [{ buyerIndex: 0, markupPerKg: 0 }],
  },
  {
    cropSlug: "eggplant",
    grade: CropGrade.B,
    farmerIndex: 2, // Rangpur
    quantityKg: 250,
    floorPricePerKg: 5800,
    durationMinutes: 720,
    // No bids
  },
  {
    cropSlug: "eggplant",
    grade: CropGrade.C,
    farmerIndex: 3, // Chattogram
    quantityKg: 400,
    floorPricePerKg: 4900,
    durationMinutes: 1440,
    bids: [{ buyerIndex: 2, markupPerKg: 0 }],
  },

  // --- Potato (5 listings: 2 A, 2 B, 1 C) ---
  {
    cropSlug: "potato",
    grade: CropGrade.A,
    farmerIndex: 4, // Khulna
    quantityKg: 200,
    floorPricePerKg: 4300,
    durationMinutes: 45, // Ending soon
    bids: [
      { buyerIndex: 0, markupPerKg: 0 },
      { buyerIndex: 1, markupPerKg: 100 },
      { buyerIndex: 2, markupPerKg: 200 },
    ],
  },
  {
    cropSlug: "potato",
    grade: CropGrade.A,
    farmerIndex: 5, // Barishal
    quantityKg: 500,
    floorPricePerKg: 4400,
    durationMinutes: 180,
    bids: [{ buyerIndex: 1, markupPerKg: 0 }],
  },
  {
    cropSlug: "potato",
    grade: CropGrade.B,
    farmerIndex: 6, // Sylhet
    quantityKg: 150,
    floorPricePerKg: 3900,
    durationMinutes: 360,
    bids: [{ buyerIndex: 0, markupPerKg: 0 }],
  },
  {
    cropSlug: "potato",
    grade: CropGrade.B,
    farmerIndex: 7, // Mymensingh
    quantityKg: 1000,
    floorPricePerKg: 4000,
    durationMinutes: 720,
    // No bids
  },
  {
    cropSlug: "potato",
    grade: CropGrade.C,
    farmerIndex: 0, // Dhaka
    quantityKg: 1500,
    floorPricePerKg: 3300,
    durationMinutes: 1440,
    bids: [{ buyerIndex: 1, markupPerKg: 0 }],
  },
];

/**
 * Resolves the directory holding sample crop photos.
 */
function resolveSampleBaseDir(customDir?: string): string {
  if (customDir && fs.existsSync(customDir)) {
    return customDir;
  }
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(dirname, "assets/samples"),
    path.resolve(dirname, "../seed/assets/samples"),
    path.resolve(process.cwd(), "apps/api/src/seed/assets/samples"),
    path.resolve(process.cwd(), "src/seed/assets/samples"),
  ];
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return path.resolve(dirname, "assets/samples");
}

/**
 * Loads a real sample photo buffer for the specified crop slug and grade.
 */
function loadSampleImageBuffer(baseDir: string, cropSlug: string, grade: CropGrade): Buffer {
  const cropDirCandidates = [cropSlug];
  if (cropSlug === "bitter-gourd") {
    cropDirCandidates.push("bitter-groud");
  }

  for (const dirName of cropDirCandidates) {
    const cropPath = path.join(baseDir, dirName);
    if (!fs.existsSync(cropPath)) continue;

    const fileCandidates = [
      `${grade}.jpg`,
      `${grade}.jpeg`,
      `${grade.toLowerCase()}.jpg`,
      `${grade.toLowerCase()}.jpeg`,
    ];

    for (const fileName of fileCandidates) {
      const filePath = path.join(cropPath, fileName);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
    }
  }

  // Fallback 1x1 JPEG buffer if disk fixtures are unreachable in isolated test runs
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  );
}

/**
 * Ensures a user exists, creating with hashed password if missing.
 */
async function getOrCreateUser(definition: UserSeedDefinition): Promise<PublicUser> {
  const normalizedPhone = normalizeBangladeshPhone(definition.phone);
  const existing = await User.findOne({ phone: normalizedPhone });
  if (existing) {
    return toPublicUser(existing);
  }

  const passwordHash = await bcrypt.hash(definition.password, BCRYPT_COST);
  const user = await User.create({
    role: definition.role,
    name: definition.name,
    phone: normalizedPhone,
    passwordHash,
    division: definition.division,
    district: definition.district,
    upazila: definition.upazila,
    organization: definition.organization,
  });

  return toPublicUser(user);
}

/**
 * Verifies that the InventoryItem balances match the sum of applied ledger StockMovements.
 */
export async function verifyFarmerCropLedger(
  farmerId: string,
  cropId: string,
): Promise<{ availableKg: number; listedKg: number; soldKg: number }> {
  const inventory = await InventoryItem.findOne({ farmerId, cropId }).lean();
  if (!inventory) {
    throw new Error(`InventoryItem not found for farmer ${farmerId} and crop ${cropId}`);
  }

  const movements = await StockMovement.find({ farmerId, cropId, status: "APPLIED" }).lean();
  const ledgerTotals = movements.reduce(
    (totals, movement) => {
      const quantity = movement.quantityKg;
      if (movement.type === "ADD" || movement.type === "ADJUST") {
        totals.availableKg += quantity;
      }
      if (movement.type === "LIST") {
        totals.availableKg -= quantity;
        totals.listedKg += quantity;
      }
      if (movement.type === "RELEASE") {
        totals.availableKg += quantity;
        totals.listedKg -= quantity;
      }
      if (movement.type === "SELL") {
        totals.listedKg -= quantity;
        totals.soldKg += quantity;
      }
      if (movement.type === "RETURN") {
        totals.availableKg += quantity;
        totals.soldKg -= quantity;
      }
      return totals;
    },
    { availableKg: 0, listedKg: 0, soldKg: 0 },
  );

  if (
    Math.abs(inventory.availableKg - ledgerTotals.availableKg) > 1e-4 ||
    Math.abs(inventory.listedKg - ledgerTotals.listedKg) > 1e-4 ||
    Math.abs(inventory.soldKg - ledgerTotals.soldKg) > 1e-4
  ) {
    throw new Error(
      `Ledger reconciliation mismatch for farmer ${farmerId}, crop ${cropId}: ` +
        `inventory=(${inventory.availableKg}, ${inventory.listedKg}, ${inventory.soldKg}) ` +
        `ledger=(${ledgerTotals.availableKg}, ${ledgerTotals.listedKg}, ${ledgerTotals.soldKg})`,
    );
  }

  return {
    availableKg: inventory.availableKg,
    listedKg: inventory.listedKg,
    soldKg: inventory.soldKg,
  };
}

/**
 * Core dev listings seeder.
 * - Refuses to run in production.
 * - Cleans up previous seed data (idempotent & repeatable).
 * - Creates/finds farmers across >= 6 divisions and buyers.
 * - Adds stock via addStock service.
 * - Assesses sample photos via mock grader and AI service.
 * - Publishes ~25 listings across all 5 crops and grades A, B, C.
 * - Places bids using bid service.
 * - Verifies ledger reconciliation.
 * - Prints demo credentials banner.
 */
export async function seedDevListings(
  options: SeedDevListingsOptions = {},
): Promise<SeedDevListingsResult> {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === "production") {
    const errorMsg =
      "Refusing to run seed:dev-listings in production environment (NODE_ENV=production)";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const sampleBaseDir = resolveSampleBaseDir(options.sampleDir);

  // 1. Ensure Crop catalog and base MarketPrice reference data are present
  await Crop.updateOne({ slug: "tomato" }, { $set: { isActive: false } });
  await seedCropCatalog(async (crop) => {
    await Crop.updateOne({ slug: crop.slug }, { $set: crop }, { upsert: true });
  });

  const crops = await Crop.find({
    slug: { $in: CROP_SEED_DATA.map(({ slug }) => slug) },
    isActive: true,
  })
    .select("_id slug nameEn minLotKg maxLotKg shelfLifeHours minIncrementPerKg")
    .lean();

  if (crops.length !== CROP_SEED_DATA.length) {
    throw new Error("Active crop catalog is incomplete");
  }

  const cropMap = new Map(crops.map((c) => [c.slug, c]));

  const marketPriceCount = await MarketPrice.countDocuments();
  if (marketPriceCount === 0) {
    await seedMarketPriceHistory(
      crops.map(({ _id, slug }) => ({ id: _id, slug })),
      new Date(),
    );
  }

  // 2. Ensure farmers and buyers exist
  const farmers: PublicUser[] = [];
  for (const def of SEED_FARMER_DEFINITIONS) {
    const farmer = await getOrCreateUser(def);
    farmers.push(farmer);
  }

  const buyers: PublicUser[] = [];
  for (const def of SEED_BUYER_DEFINITIONS) {
    const buyer = await getOrCreateUser(def);
    buyers.push(buyer);
  }

  const farmerIds = farmers.map((f) => f.id);
  const buyerIds = buyers.map((b) => b.id);

  // 3. Cleanup previous dev-listing seed data for repeatability
  const existingListings = await Listing.find({ farmerId: { $in: farmerIds } })
    .select("_id")
    .lean();
  const existingListingIds = existingListings.map((l) => l._id.toString());

  if (existingListingIds.length > 0) {
    await Bid.deleteMany({ listingId: { $in: existingListingIds } });
    await IdempotencyRecord.deleteMany({ listingId: { $in: existingListingIds } });
    await Order.deleteMany({ listingId: { $in: existingListingIds } });
    await Listing.deleteMany({ _id: { $in: existingListingIds } });
  }

  await Order.deleteMany({
    $or: [{ farmerId: { $in: farmerIds } }, { buyerId: { $in: buyerIds } }],
  });
  await AiAssessmentRecord.deleteMany({ farmerId: { $in: farmerIds } });
  await StockMovement.deleteMany({ farmerId: { $in: farmerIds } });
  await InventoryItem.deleteMany({ farmerId: { $in: farmerIds } });

  // 4. Calculate stock needs per (farmer, crop) and add harvested stock
  const stockRequirements = new Map<string, number>();
  for (const plan of LISTING_SEED_PLAN) {
    const farmer = farmers[plan.farmerIndex];
    if (!farmer) continue;
    const crop = cropMap.get(plan.cropSlug);
    if (!crop) continue;

    const key = `${farmer.id}:${crop._id.toString()}`;
    const current = stockRequirements.get(key) ?? 0;
    stockRequirements.set(key, current + plan.quantityKg);
  }

  for (const [key, totalLotKg] of stockRequirements.entries()) {
    const [farmerId, cropId] = key.split(":");
    if (!farmerId || !cropId) continue;
    // Buffer of 100 kg available stock left over after listing reservations
    const initialHarvestKg = totalLotKg + 100;
    await addStock({
      farmerId,
      cropId,
      quantityKg: initialHarvestKg,
      operationId: `dev-seed-add-${farmerId}-${cropId}`,
      note: "Dev seeder initial stock allocation",
    });
  }

  // 5. Publish the 25 listings using the real services
  const publishedListings: FarmerListing[] = [];
  const grader = getGradingProvider() as MockGradingProvider;

  for (let index = 0; index < LISTING_SEED_PLAN.length; index += 1) {
    const plan = LISTING_SEED_PLAN[index];
    if (!plan) continue;

    const farmer = farmers[plan.farmerIndex];
    const crop = cropMap.get(plan.cropSlug);
    if (!farmer || !crop) {
      throw new Error(`Plan item at index ${index} references invalid farmer or crop`);
    }

    // Load sample image and configure mock grader override for exact grade match
    const imageBuffer = loadSampleImageBuffer(sampleBaseDir, plan.cropSlug, plan.grade);

    if (typeof grader.setNextOverride === "function") {
      grader.setNextOverride({
        grade: plan.grade,
        confidence: 0.95,
        confidenceBand: "HIGH",
        cropMatch: true,
        modelVersion: "mock-1.0",
        qualityNotes: [
          `Visual quality evaluated by AI for ${crop.nameEn}`,
          "Sound skin, consistent color, and healthy texture",
        ],
      });
    }

    const multerFile: Express.Multer.File = {
      fieldname: "photos",
      originalname: `${plan.grade}.jpg`,
      encoding: "7bit",
      mimetype: "image/jpeg",
      size: imageBuffer.length,
      buffer: imageBuffer,
      destination: "",
      filename: "",
      path: "",
      stream: null as unknown as Express.Multer.File["stream"],
    };

    const assessmentResult = await assessCropQuality(farmer.id, crop._id.toString(), [multerFile]);

    const { listing } = await createAndPublishListing(farmer, {
      cropId: crop._id.toString(),
      assessmentToken: assessmentResult.assessmentToken,
      quantityKg: plan.quantityKg,
      floorPricePerKg: plan.floorPricePerKg,
      durationMinutes: plan.durationMinutes,
    });

    publishedListings.push(listing);
  }

  // 6. Place bids on planned listings using the real bid service
  let bidsCount = 0;
  for (let index = 0; index < LISTING_SEED_PLAN.length; index += 1) {
    const plan = LISTING_SEED_PLAN[index];
    const listing = publishedListings[index];
    if (!plan || !listing || !plan.bids || plan.bids.length === 0) continue;

    for (let bidIdx = 0; bidIdx < plan.bids.length; bidIdx += 1) {
      const bidSpec = plan.bids[bidIdx];
      if (!bidSpec) continue;
      const buyer = buyers[bidSpec.buyerIndex];
      if (!buyer) continue;

      const bidAmountPerKg = listing.floorPricePerKg + bidSpec.markupPerKg;
      await placeBid(buyer, listing.id, {
        amountPerKg: bidAmountPerKg,
        idempotencyKey: `dev-seed-bid-${listing.id}-${buyer.id}-${bidIdx}`,
      });
      bidsCount += 1;
    }
  }

  // 7. Verify inventory ledger reconciliation for all seeded farmer-crop pairs
  for (const [key] of stockRequirements.entries()) {
    const [farmerId, cropId] = key.split(":");
    if (!farmerId || !cropId) continue;
    await verifyFarmerCropLedger(farmerId, cropId);
  }

  // 7b. Seed historical activity (60 to 90 days) if history mode is enabled
  let historyResult: SeedDevHistoryResult | undefined;
  if (options.history) {
    const demoFarmerUser = await User.findById(farmers[0]!.id);
    const buyerUsers = await User.find({ _id: { $in: buyers.map((b) => b.id) } });

    if (!demoFarmerUser) {
      throw new Error("Demo farmer user not found for historical seeding");
    }

    historyResult = await seedDevHistory(
      demoFarmerUser,
      buyerUsers,
      crops,
    );

    // Re-verify inventory ledger reconciliation for demo farmer across all crops
    for (const crop of crops) {
      await verifyFarmerCropLedger(farmers[0]!.id, crop._id.toString());
    }
  }

  // 8. Output demo credentials and summary banner unless silent
  if (!options.silent) {
    const banner = [
      "",
      "============================================================",
      "             BazarBeat Dev Listing Seeder                   ",
      "============================================================",
      "Demo Credentials:",
      "  Demo Farmer:",
      `    Phone:    ${DEV_SEED_CREDENTIALS.farmer.phone}`,
      `    Password: ${DEV_SEED_CREDENTIALS.farmer.password}`,
      `    Role:     ${DEV_SEED_CREDENTIALS.farmer.role}`,
      `    Location: Dhaka (Savar)`,
      "",
      "  Demo Buyer:",
      `    Phone:    ${DEV_SEED_CREDENTIALS.buyer.phone}`,
      `    Password: ${DEV_SEED_CREDENTIALS.buyer.password}`,
      `    Role:     ${DEV_SEED_CREDENTIALS.buyer.role}`,
      `    Org:      ${DEV_SEED_CREDENTIALS.buyer.organization}`,
      "------------------------------------------------------------",
      `Seeded:`,
      `  Farmers:  ${farmers.length} across ${new Set(farmers.map((f) => f.division)).size} divisions`,
      `  Buyers:   ${buyers.length}`,
      `  Listings: ${publishedListings.length} active across all 5 crops & grades (A, B, C)`,
      `  Bids:     ${bidsCount} placed on active auctions`,
      ...(historyResult
        ? [
            `  History:  ${historyResult.listingsCount} past auctions (${historyResult.soldCount} sold, ${historyResult.unsoldCount} unsold, ${historyResult.cancelledCount} cancelled)`,
            `            ${historyResult.ordersCount} past/in-progress orders, ${historyResult.bidsCount} past bids across 75 days`,
          ]
        : []),
      `  Ledger:   RECONCILIATION VERIFIED`,
      "============================================================",
      "",
    ].join("\n");
    // Output demo banner
    process.stdout.write(banner + "\n");
  }

  return {
    farmers,
    buyers,
    listings: publishedListings,
    bidsCount,
    reconciliationPassed: true,
    history: historyResult,
  };
}
