import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatPoisha } from "@bazarbeat/shared";

// Load environment variables from repo root or package root
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnv = path.resolve(scriptDir, "../../../.env");
if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
}
const apiEnv = path.resolve(scriptDir, "../.env");
if (fs.existsSync(apiEnv)) {
  dotenv.config({ path: apiEnv });
}
dotenv.config();

export interface DevBidConfig {
  listingId: string;
  amountPerKg: number;
  phone?: string;
  password?: string;
  apiUrl?: string;
  nodeEnv?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
  fetchFn?: typeof fetch;
}

export interface DevBidResult {
  success: boolean;
  statusCode?: number;
  data?: unknown;
  error?: unknown;
}

/**
 * Signs in as a buyer using environment credentials and places a bid over HTTP.
 * Refuses to run if NODE_ENV is production.
 */
export async function runDevBid(config: DevBidConfig): Promise<DevBidResult> {
  const stdout =
    config.stdout ??
    ((message: string): void => {
      process.stdout.write(message);
    });
  const stderr =
    config.stderr ??
    ((message: string): void => {
      process.stderr.write(message);
    });
  const fetchFn = config.fetchFn ?? fetch;

  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === "production") {
    stderr(
      "[dev:bid] Error: Refusing to run dev:bid script in production environment (NODE_ENV=production).\n",
    );
    return { success: false, error: "PRODUCTION_ENV_FORBIDDEN" };
  }

  const { listingId, amountPerKg } = config;
  if (!listingId || !listingId.trim()) {
    stderr(
      "[dev:bid] Error: Missing listing ID.\nUsage: npm run dev:bid -- <listingId> <amountPerKgInPoisha>\n",
    );
    return { success: false, error: "MISSING_LISTING_ID" };
  }

  if (!Number.isInteger(amountPerKg) || amountPerKg <= 0) {
    stderr(
      `[dev:bid] Error: Invalid bid amount "${amountPerKg}". Amount must be a positive integer in poisha (e.g. 4600 for 46 BDT/kg).\n`,
    );
    return { success: false, error: "INVALID_BID_AMOUNT" };
  }

  const phone = config.phone ?? process.env.DEV_BUYER_PHONE ?? process.env.BUYER_PHONE;
  const password = config.password ?? process.env.DEV_BUYER_PASSWORD ?? process.env.BUYER_PASSWORD;

  if (!phone || !password) {
    stderr(
      "[dev:bid] Error: Missing buyer credentials. Please set DEV_BUYER_PHONE and DEV_BUYER_PASSWORD in your environment or .env file.\n",
    );
    return { success: false, error: "MISSING_CREDENTIALS" };
  }

  const rawApiUrl =
    config.apiUrl ??
    process.env.API_URL ??
    process.env.API_BASE_URL ??
    `http://localhost:${process.env.PORT || "4000"}/api/v1`;
  const apiUrl = rawApiUrl.replace(/\/+$/, "");

  stdout(`[dev:bid] Signing in as buyer (${phone}) against ${apiUrl}...\n`);

  let loginResponse: Response;
  try {
    loginResponse = await fetchFn(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
      },
      body: JSON.stringify({ phone, password }),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    stderr(`[dev:bid] Network error connecting to auth endpoint: ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }

  const loginBody = (await loginResponse.json().catch(() => null)) as {
    data?: { id: string; role: string; name: string };
    error?: { code: string; message: string };
  } | null;

  if (!loginResponse.ok) {
    const errorDetails = loginBody?.error
      ? `${loginBody.error.code}: ${loginBody.error.message}`
      : `HTTP ${loginResponse.status} ${loginResponse.statusText}`;
    stderr(`[dev:bid] Sign-in failed (${errorDetails})\n`);
    return { success: false, statusCode: loginResponse.status, error: loginBody };
  }

  if (loginBody?.data?.role && loginBody.data.role !== "BUYER") {
    stderr(
      `[dev:bid] Error: Authenticated user (${phone}) has role "${loginBody.data.role}", not "BUYER". Only buyers can place bids.\n`,
    );
    return { success: false, error: "ROLE_NOT_BUYER" };
  }

  let cookieHeader = "";
  if (typeof loginResponse.headers.getSetCookie === "function") {
    cookieHeader = loginResponse.headers
      .getSetCookie()
      .map((cookieStr) => cookieStr.split(";")[0]?.trim())
      .filter((c): c is string => Boolean(c))
      .join("; ");
  } else {
    const setCookie = loginResponse.headers.get("set-cookie");
    if (setCookie) {
      cookieHeader = setCookie
        .split(",")
        .map((cookieStr) => cookieStr.split(";")[0]?.trim())
        .filter((c): c is string => Boolean(c))
        .join("; ");
    }
  }

  stdout(
    `[dev:bid] Signed in successfully. Placing bid of ${amountPerKg} poisha/kg (${formatPoisha(amountPerKg)}/kg) on listing ${listingId}...\n`,
  );

  let bidResponse: Response;
  try {
    bidResponse = await fetchFn(`${apiUrl}/listings/${encodeURIComponent(listingId)}/bids`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ amountPerKg }),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    stderr(`[dev:bid] Network error submitting bid: ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }

  const bidBody = await bidResponse.json().catch(() => null);

  if (!bidResponse.ok) {
    stderr(
      `[dev:bid] Bid rejected by server (HTTP ${bidResponse.status}):\n${JSON.stringify(bidBody, null, 2)}\n`,
    );
    return { success: false, statusCode: bidResponse.status, error: bidBody };
  }

  stdout(
    `[dev:bid] Bid accepted successfully (HTTP ${bidResponse.status}):\n${JSON.stringify(bidBody, null, 2)}\n`,
  );
  return { success: true, statusCode: bidResponse.status, data: bidBody };
}

/**
 * CLI runner for npm run dev:bid -- <listingId> <amountPerKgInPoisha>
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [listingIdArg, amountArg] = argv;
  if (!listingIdArg || !amountArg) {
    process.stderr.write(
      "[dev:bid] Usage: npm run dev:bid -- <listingId> <amountPerKgInPoisha>\n" +
        "Example: npm run dev:bid -- 6788f4b5c92842f1b0a81123 4600\n",
    );
    return 1;
  }

  const amountPerKg = Number(amountArg);
  const result = await runDevBid({
    listingId: listingIdArg,
    amountPerKg,
  });

  return result.success ? 0 : 1;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("dev-bid.ts") || process.argv[1].endsWith("dev-bid.js"));

if (isDirectExecution) {
  void main().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
