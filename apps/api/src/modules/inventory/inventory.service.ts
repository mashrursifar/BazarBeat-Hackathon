import mongoose from "mongoose";

import {
  type StockMovementType as MovementType,
  inventoryQuantityKgSchema,
} from "@bazarbeat/shared";

import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { InventoryItem } from "./inventory-item.model.js";
import { getInventoryDeltas } from "./inventory-movement.js";
import { StockMovement, type StockMovementRecord } from "./stock-movement.model.js";

interface MovementInput {
  farmerId: string;
  cropId: string;
  quantityKg: number;
  operationId: string;
  listingId?: string;
  orderId?: string;
  note?: string;
  session?: mongoose.ClientSession;
}

interface MovementCommand extends MovementInput {
  type: MovementType;
}

interface MovementDocumentInput {
  farmerId: string;
  cropId: string;
  type: MovementType;
  quantityKg: number;
  operationId: string;
  status: "PENDING" | "APPLIED";
  listingId?: string;
  orderId?: string;
  note?: string;
}

class FallbackRequiredError extends Error {}

function ensureObjectId(value: string): string {
  if (!/^[\da-f]{24}$/i.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "Inventory references must be valid database IDs");
  }
  return value.toLowerCase();
}

function validateMovement(command: MovementCommand): void {
  inventoryQuantityKgSchema.parse(command.quantityKg);
  if (command.operationId.trim().length === 0 || command.operationId.length > 128) {
    throw new AppError(400, "VALIDATION_ERROR", "Movement operation ID must be 1–128 characters");
  }
  ensureObjectId(command.farmerId);
  ensureObjectId(command.cropId);
  if (command.listingId !== undefined) ensureObjectId(command.listingId);
  if (command.orderId !== undefined) ensureObjectId(command.orderId);
  if (command.note !== undefined && command.note.length > 200) {
    throw new AppError(400, "VALIDATION_ERROR", "Movement note must be at most 200 characters");
  }
}

function movementDocument(command: MovementCommand, status: "PENDING" | "APPLIED"): MovementDocumentInput {
  return {
    farmerId: ensureObjectId(command.farmerId),
    cropId: ensureObjectId(command.cropId),
    type: command.type,
    quantityKg: command.quantityKg,
    operationId: command.operationId,
    status,
    ...(command.listingId === undefined ? {} : { listingId: ensureObjectId(command.listingId) }),
    ...(command.orderId === undefined ? {} : { orderId: ensureObjectId(command.orderId) }),
    ...(command.note === undefined ? {} : { note: command.note }),
  };
}

function assertSameOperation(
  existing: Pick<StockMovementRecord, "farmerId" | "cropId" | "type" | "quantityKg" | "listingId" | "orderId" | "note">,
  command: MovementCommand,
): void {
  const same = String(existing.farmerId).toLowerCase() === command.farmerId.toLowerCase() &&
    String(existing.cropId).toLowerCase() === command.cropId.toLowerCase() &&
    existing.type === command.type &&
    existing.quantityKg === command.quantityKg &&
    String(existing.listingId ?? "").toLowerCase() === (command.listingId ?? "").toLowerCase() &&
    String(existing.orderId ?? "").toLowerCase() === (command.orderId ?? "").toLowerCase() &&
    (existing.note ?? "") === (command.note ?? "");
  if (!same) throw new AppError(409, "CONFLICT", "Movement operation ID was already used for another change");
}

async function ensureInventoryItem(command: MovementCommand, session?: mongoose.ClientSession): Promise<void> {
  const options = session === undefined ? { upsert: true } : { upsert: true, session };
  try {
    await InventoryItem.updateOne(
      { farmerId: ensureObjectId(command.farmerId), cropId: ensureObjectId(command.cropId) },
      { $setOnInsert: { availableKg: 0, listedKg: 0, soldKg: 0 } },
      options,
    );
  } catch (error: unknown) {
    if (!isDuplicateKey(error)) throw error;
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function buildInventoryFilter(command: MovementCommand): Record<string, unknown> {
  const delta = getInventoryDeltas(command.type, command.quantityKg);
  return {
    farmerId: ensureObjectId(command.farmerId),
    cropId: ensureObjectId(command.cropId),
    pendingMovementId: { $exists: false },
    ...(delta.sourceBucket === undefined ? {} : { [delta.sourceBucket]: { $gte: command.quantityKg } }),
  };
}

function buildInventoryUpdate(command: MovementCommand, pendingMarker: boolean): Record<string, unknown> {
  const delta = getInventoryDeltas(command.type, command.quantityKg);
  const $inc = {
    availableKg: delta.availableKg,
    listedKg: delta.listedKg,
    soldKg: delta.soldKg,
  };
  return {
    $inc,
    ...(pendingMarker ? { $set: { pendingMovementId: command.operationId } } : {}),
  };
}

async function changeInventory(
  command: MovementCommand,
  options: { session?: mongoose.ClientSession; pendingMarker: boolean },
): Promise<boolean> {
  const updateOptions = options.session === undefined
    ? { new: true }
    : { new: true, session: options.session };
  const updated = await InventoryItem.findOneAndUpdate(
    buildInventoryFilter(command),
    buildInventoryUpdate(command, options.pendingMarker),
    updateOptions,
  ).lean();
  return updated !== null;
}

function isTransactionUnsupported(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 20 ||
    (typeof candidate.message === "string" && candidate.message.includes("Transaction numbers are only allowed"));
}

async function executeTransactionSteps(
  command: MovementCommand,
  session: mongoose.ClientSession,
): Promise<void> {
  const existing = await StockMovement.findOne({ operationId: command.operationId }).session(session).lean();
  if (existing !== null) {
    assertSameOperation(existing, command);
    if (existing.status === "PENDING") throw new FallbackRequiredError("Pending fallback movement requires recovery");
    return;
  }
  await ensureInventoryItem(command, session);
  const updated = await changeInventory(command, { session, pendingMarker: false });
  if (!updated) {
    const item = await InventoryItem.findOne({
      farmerId: ensureObjectId(command.farmerId),
      cropId: ensureObjectId(command.cropId),
    }).session(session).lean();
    if (item?.pendingMovementId !== undefined) {
      throw new FallbackRequiredError("Pending fallback movement requires recovery");
    }
    throw insufficientStockError();
  }
  await StockMovement.create([movementDocument(command, "APPLIED")], { session });
}

async function applyTransaction(command: MovementCommand): Promise<void> {
  if (command.session) {
    await executeTransactionSteps(command, command.session);
    return;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await executeTransactionSteps(command, session);
    });
  } finally {
    await session.endSession();
  }
}

function insufficientStockError(): AppError {
  return new AppError(409, "INSUFFICIENT_STOCK", "There is not enough stock in the required inventory bucket");
}

async function finishPendingMovement(farmerId: string, cropId: string, operationId: string): Promise<void> {
  const movement = await StockMovement.findOne({ operationId });
  if (movement === null) throw new AppError(500, "INTERNAL", "Pending inventory movement is missing from the ledger");
  if (movement.status === "PENDING") {
    await StockMovement.updateOne({ operationId, status: "PENDING" }, { $set: { status: "APPLIED" } });
  }
  await InventoryItem.updateOne(
    {
      farmerId: ensureObjectId(farmerId),
      cropId: ensureObjectId(cropId),
      pendingMovementId: operationId,
    },
    { $unset: { pendingMovementId: 1 } },
  );
}

async function findExistingMovement(command: MovementCommand): Promise<"missing" | "pending" | "applied"> {
  const query = StockMovement.findOne({ operationId: command.operationId });
  if (command.session) query.session(command.session);
  const existing = await query;
  if (existing === null) return "missing";
  assertSameOperation(existing, command);
  return existing.status === "APPLIED" ? "applied" : "pending";
}

async function applyFallback(command: MovementCommand): Promise<void> {
  const pending = await StockMovement.findOneAndUpdate(
    { operationId: command.operationId },
    { $setOnInsert: movementDocument(command, "PENDING") },
    { upsert: true, new: true },
  );
  if (pending === null) throw new AppError(500, "INTERNAL", "Unable to create inventory movement intent");
  assertSameOperation(pending, command);
  if (pending.status === "APPLIED") return;

  await ensureInventoryItem(command);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = await findExistingMovement(command);
    if (status === "applied") return;
    const item = await InventoryItem.findOne({
      farmerId: ensureObjectId(command.farmerId),
      cropId: ensureObjectId(command.cropId),
    }).lean();
    if (item?.pendingMovementId !== undefined) {
      await finishPendingMovement(command.farmerId, command.cropId, item.pendingMovementId);
      continue;
    }
    const updated = await changeInventory(command, { pendingMarker: true });
    if (updated) {
      await finishPendingMovement(command.farmerId, command.cropId, command.operationId);
      return;
    }
    const latest = await InventoryItem.findOne({
      farmerId: ensureObjectId(command.farmerId),
      cropId: ensureObjectId(command.cropId),
    }).lean();
    if (latest?.pendingMovementId !== undefined) continue;
    await StockMovement.deleteOne({ operationId: command.operationId, status: "PENDING" });
    throw insufficientStockError();
  }
  throw new AppError(409, "CONFLICT", "Inventory is busy completing another movement; retry with the same operation ID");
}

async function applyMovement(command: MovementCommand): Promise<void> {
  validateMovement(command);
  const existing = await findExistingMovement(command);
  if (existing === "applied") return;
  if (existing === "pending") {
    await applyFallback(command);
    return;
  }
  try {
    await applyTransaction(command);
  } catch (error: unknown) {
    if (error instanceof FallbackRequiredError) {
      await applyFallback(command);
      return;
    }
    if (!isTransactionUnsupported(error)) throw error;
    logger.info({ operationId: command.operationId }, "Mongo transactions unavailable; using ordered idempotent inventory steps");
    await applyFallback(command);
  }
}

/** Adds harvested stock and records one idempotent ADD movement. */
export async function addStock(input: MovementInput): Promise<void> {
  await applyMovement({ ...input, type: "ADD" });
}

/** Reserves available stock for a listing without allowing the available bucket below zero. */
export async function reserveStockForListing(input: MovementInput & { listingId: string }): Promise<void> {
  await applyMovement({ ...input, type: "LIST" });
}

/** Returns listed stock to available stock after an unsold listing closes. */
export async function releaseStock(input: MovementInput & { listingId: string }): Promise<void> {
  await applyMovement({ ...input, type: "RELEASE" });
}

/** Moves listed stock into lifetime sold stock for a completed sale. */
export async function markStockSold(input: MovementInput & { orderId: string }): Promise<void> {
  await applyMovement({ ...input, type: "SELL" });
}

/** Adds confirmed returned unsold goods back to available stock as an ADJUST movement. */
export async function adjustStock(input: MovementInput): Promise<void> {
  await applyMovement({ ...input, type: "ADJUST" });
}
