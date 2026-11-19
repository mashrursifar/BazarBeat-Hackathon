import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CropGrade,
  DEMO_LISTING_DURATION_PRESET_MINUTES,
  type FarmerListing,
  normalizeBangladeshPhone,
} from "@bazarbeat/shared";

import { logger } from "../shared/logger.js";
import { User } from "../modules/users/user.model.js";
import { toPublicUser } from "../modules/users/user.mapper.js";
import { Crop } from "../modules/crops/crop.model.js";
import { createAndPublishListing } from "../modules/listings/listing.service.js";
import { placeBid } from "../modules/bids/bid.service.js";
import { InventoryItem } from "../modules/inventory/inventory-item.model.js";
import { addStock } from "../modules/inventory/inventory.service.js";
import { assessCropQuality, getGradingProvider } from "../modules/ai/ai.service.js";
import type { MockGradingProvider } from "../modules/ai/mock-grading.provider.js";
import {
  DEMO_BUYER_DEFINITIONS,
  DEMO_FARMER_DEFINITIONS,
  DEMO_LISTING_SEED_PLAN,
  DEV_SEED_CREDENTIALS,
  type SeedDevListingsResult,
  loadSampleImageBuffer,
  seedDevListings,
} from "./dev-listings.js";

/**
 * Asserts that the target database is explicitly permitted for demo seeding.
 * Throws or exits if ALLOW_DEMO_SEED is not 'true'.
 */
export function assertAllowDemoSeed(): void {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    const message = [
      "",
      "============================================================",
      " [BLOCKED] Target database is not explicitly allowed        ",
      "============================================================",
      "Refusing to execute demo seed / reset / spawn.",
      "The target database must be explicitly permitted by setting:",
      "  ALLOW_DEMO_SEED=true",
      "",
      "Examples:",
      "  ALLOW_DEMO_SEED=true npm run seed:demo",
      "  ALLOW_DEMO_SEED=true npm run demo:reset",
      "  ALLOW_DEMO_SEED=true npm run demo:spawn-auctions",
      "============================================================",
      "",
    ].join("\n");
    process.stderr.write(message);
    throw new Error(
      "Refusing to execute demo operations without explicit ALLOW_DEMO_SEED=true in environment.",
    );
  }
}

/**
 * Prints the standardized demo credentials banner.
 */
export function printDemoCredentialsBanner(extraLines: string[] = []): void {
  const banner = [
    "",
    "============================================================",
    "             BazarBeat Demo Platform Credentials            ",
    "============================================================",
    "Demo Credentials (Demo database only — do not reuse real passwords):",
    "  Demo Farmer:",
    `    Phone:    ${DEV_SEED_CREDENTIALS.farmer.phone}`,
    `    Password: ${DEV_SEED_CREDENTIALS.farmer.password}`,
    `    Role:     ${DEV_SEED_CREDENTIALS.farmer.role}`,
    `    Name:     ${DEV_SEED_CREDENTIALS.farmer.name}`,
    `    Location: Savar, Dhaka`,
    "",
    "  Demo Buyer:",
    `    Phone:    ${DEV_SEED_CREDENTIALS.buyer.phone}`,
    `    Password: ${DEV_SEED_CREDENTIALS.buyer.password}`,
    `    Role:     ${DEV_SEED_CREDENTIALS.buyer.role}`,
    `    Name:     ${DEV_SEED_CREDENTIALS.buyer.name}`,
    `    Org:      ${DEV_SEED_CREDENTIALS.buyer.organization}`,
    `    Location: Dhanmondi, Dhaka`,
    "------------------------------------------------------------",
    ...extraLines,
    "============================================================",
    "",
  ].join("\n");
  process.stdout.write(banner);
}

export interface SeedDemoOptions {
  silent?: boolean;
  sampleDir?: string;
  nodeEnv?: string;
  allowDemoSeed?: boolean;
}

/**
 * Seeds the full deterministic demo dataset:
 * - Crop catalog (5 crops)
 * - 12 farmers spanning all 8 divisions (>= 6 required)
 * - 8 buyers with distinct locations and organizations
 * - 60 days of market price history for all crops and divisions
 * - 25 listings in mixed states with competitive bids
 * - 60 to 90 days of completed, cancelled, and in-progress orders (Phase 7.5 golden dataset)
 * - Sample photos uploaded through the active storage provider
 * - Verified ledger reconciliation
 */
export async function seedDemo(options: SeedDemoOptions = {}): Promise<SeedDevListingsResult> {
  const allowDemo = options.allowDemoSeed ?? process.env.ALLOW_DEMO_SEED === "true";
  if (!allowDemo) {
    assertAllowDemoSeed();
  }

  const result = await seedDevListings({
    silent: true,
    sampleDir: options.sampleDir,
    nodeEnv: options.nodeEnv,
    farmers: DEMO_FARMER_DEFINITIONS,
    buyers: DEMO_BUYER_DEFINITIONS,
    listingPlan: DEMO_LISTING_SEED_PLAN,
    history: true,
    refreshMarketPrices: true,
    allowDemoSeed: true,
  });

  if (!options.silent) {
    const summaryLines = [
      "Seeded Demo Dataset Summary:",
      `  Farmers:        ${result.farmers.length} across ${new Set(result.farmers.map((f) => f.division)).size} divisions`,
      `  Buyers:         ${result.buyers.length}`,
      `  Active Lots:    ${result.listings.length} across all 5 crops & grades (A, B, C)`,
      `  Active Bids:    ${result.bidsCount} placed on active auctions`,
      ...(result.history
        ? [
            `  Past Auctions:  ${result.history.listingsCount} (${result.history.soldCount} sold, ${result.history.unsoldCount} unsold, ${result.history.cancelledCount} cancelled)`,
            `  Past Orders:    ${result.history.ordersCount} completed & in-progress orders across 75 days`,
            `  Past Bids:      ${result.history.bidsCount} past bids across history`,
          ]
        : []),
      `  Ledger Audit:   RECONCILIATION VERIFIED (all movements balance)`,
    ];
    printDemoCredentialsBanner(summaryLines);
  }

  return result;
}

export interface SpawnDemoAuctionsOptions {
  silent?: boolean;
  sampleDir?: string;
  allowDemoSeed?: boolean;
}

export interface SpawnDemoAuctionsResult {
  listings: FarmerListing[];
  bidsCount: number;
}

interface SpawnPlanItem {
  cropSlug: string;
  grade: CropGrade;
  quantityKg: number;
  floorPricePerKg: number;
  bidAmountPerKg?: number;
}

const DEMO_SPAWN_PLANS: readonly SpawnPlanItem[] = [
  {
    cropSlug: "onion",
    grade: CropGrade.A,
    quantityKg: 100,
    floorPricePerKg: 6200, // ৳62.00/kg
    bidAmountPerKg: 6400, // ৳64.00/kg from Demo Buyer (sells & closes into order)
  },
  {
    cropSlug: "green-chilli",
    grade: CropGrade.A,
    quantityKg: 25,
    floorPricePerKg: 14000, // ৳140.00/kg (open for live bidding in presentation)
  },
  {
    cropSlug: "potato",
    grade: CropGrade.B,
    quantityKg: 200,
    floorPricePerKg: 3800, // ৳38.00/kg (unbid lot; closes EXPIRED_UNSOLD with no farmer risk)
  },
];

/**
 * Publishes a few fresh auctions that end within minutes in demo mode,
 * using demo farmer Rahim Uddin and placing an initial bid from Demo Buyer Karim Traders.
 */
export async function spawnDemoAuctions(
  options: SpawnDemoAuctionsOptions = {},
): Promise<SpawnDemoAuctionsResult> {
  const allowDemo = options.allowDemoSeed ?? process.env.ALLOW_DEMO_SEED === "true";
  if (!allowDemo) {
    assertAllowDemoSeed();
  }

  const demoFarmerDoc = await User.findOne({
    phone: normalizeBangladeshPhone(DEV_SEED_CREDENTIALS.farmer.phone),
  });
  if (!demoFarmerDoc) {
    throw new Error(
      "Demo farmer Rahim Uddin was not found in the database. Run npm run seed:demo first.",
    );
  }

  const demoBuyerDoc = await User.findOne({
    phone: normalizeBangladeshPhone(DEV_SEED_CREDENTIALS.buyer.phone),
  });
  if (!demoBuyerDoc) {
    throw new Error(
      "Demo buyer Karim Traders was not found in the database. Run npm run seed:demo first.",
    );
  }

  const demoFarmer = toPublicUser(demoFarmerDoc);
  const demoBuyer = toPublicUser(demoBuyerDoc);

  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const sampleBaseDir =
    options.sampleDir && options.sampleDir.length > 0
      ? options.sampleDir
      : path.resolve(dirname, "assets/samples");

  const crops = await Crop.find({ isActive: true }).select("_id slug nameEn shelfLifeHours").lean();
  const cropMap = new Map(crops.map((c) => [c.slug, c]));

  const grader = getGradingProvider() as MockGradingProvider;
  const spawnedListings: FarmerListing[] = [];
  let bidsCount = 0;

  for (let i = 0; i < DEMO_SPAWN_PLANS.length; i += 1) {
    const plan = DEMO_SPAWN_PLANS[i];
    if (!plan) continue;
    const crop = cropMap.get(plan.cropSlug);
    if (!crop) {
      throw new Error(`Crop ${plan.cropSlug} not found in catalog`);
    }

    // Ensure inventory has enough available stock for this demo listing
    const existingInventory = await InventoryItem.findOne({
      farmerId: demoFarmer.id,
      cropId: crop._id,
    });
    const currentAvailable = existingInventory ? existingInventory.availableKg : 0;
    if (currentAvailable < plan.quantityKg) {
      const neededKg = plan.quantityKg - currentAvailable + 50;
      await addStock({
        farmerId: demoFarmer.id,
        cropId: crop._id.toString(),
        quantityKg: neededKg,
        operationId: `spawn-stock-${demoFarmer.id}-${crop._id.toString()}-${randomUUID()}`,
        note: `Demo spawn stock top-up for ${crop.nameEn}`,
      });
    }

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

    const assessmentResult = await assessCropQuality(demoFarmer.id, crop._id.toString(), [
      multerFile,
    ]);

    const { listing } = await createAndPublishListing(demoFarmer, {
      cropId: crop._id.toString(),
      assessmentToken: assessmentResult.assessmentToken,
      quantityKg: plan.quantityKg,
      floorPricePerKg: plan.floorPricePerKg,
      durationMinutes: DEMO_LISTING_DURATION_PRESET_MINUTES,
      pickupNote: "Fresh harvest ready for instant demo pickup in Savar",
    });

    spawnedListings.push(listing);

    // Place an initial bid on specified auction so it sells and closes on schedule
    if (plan.bidAmountPerKg) {
      await placeBid(demoBuyer, listing.id, {
        amountPerKg: plan.bidAmountPerKg,
        idempotencyKey: `spawn-bid-${listing.id}-${demoBuyer.id}-${randomUUID()}`,
      });
      bidsCount += 1;
    }
  }

  if (!options.silent) {
    const tableLines = [
      "Spawned Demo Auctions (2-Minute Timers):",
      ...spawnedListings.map((l, idx) => {
        const plan = DEMO_SPAWN_PLANS[idx];
        const statusNote = plan?.bidAmountPerKg
          ? `[SOLD ON EXPIRY] Bid ৳${(plan.bidAmountPerKg / 100).toFixed(2)} placed`
          : "[OPEN] Ready for bidding / expires unsold";
        const crop = crops.find((c) => c._id.toString() === l.cropId);
        const cropName = crop?.nameEn ?? plan?.cropSlug ?? l.cropId;
        return `  ${idx + 1}. [${cropName}] ${l.quantityKg} kg (Grade ${l.aiAssessment.grade}) | Floor: ৳${(l.floorPricePerKg / 100).toFixed(2)} | Ends: ${l.endsAt} | ${statusNote}`;
      }),
      "",
      `Total Spawned: ${spawnedListings.length} auctions (${bidsCount} bid placed) | Duration: ${DEMO_LISTING_DURATION_PRESET_MINUTES} minutes each`,
    ];
    printDemoCredentialsBanner(tableLines);
  }

  logger.info(
    { count: spawnedListings.length, bidsCount },
    "Spawned fresh demo auctions successfully",
  );

  return {
    listings: spawnedListings,
    bidsCount,
  };
}
