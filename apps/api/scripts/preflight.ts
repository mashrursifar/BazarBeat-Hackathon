import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import {
  DEMO_LISTING_DURATION_PRESET_MINUTES,
  type MinimalOrder,
  type PublicCrop,
  type PublicListing,
  formatPoisha,
} from "@bazarbeat/shared";

// Load environment variables if present
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

export interface PreflightOptions {
  url?: string;
  phoneFarmer?: string;
  passwordFarmer?: string;
  phoneBuyer?: string;
  passwordBuyer?: string;
  timeoutMs?: number;
  skipWait?: boolean;
  auctionPollIntervalMs?: number;
  maxCloseWaitMs?: number;
  stdout?: (msg: string) => void;
  stderr?: (msg: string) => void;
  fetchFn?: typeof fetch;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  error?: string;
}

export interface PreflightSummary {
  success: boolean;
  targetUrl: string;
  results: CheckResult[];
  passedCount: number;
  failedCount: number;
  durationMs: number;
}

export interface AuthSession {
  user: {
    id: string;
    phone: string;
    role: string;
    name: string;
    division?: string;
  };
  cookieHeader: string;
}

export interface DeepHealthData {
  status: string;
  version?: string;
  uptime?: number;
  database?: {
    status: string;
    latencyMs?: number | null;
  };
  services?: {
    db?: { status: string; latencyMs?: number | null };
    storage?: { status: string; provider: string };
    ai?: { status: string; provider: string };
  };
  storage?: {
    status: string;
    provider: string;
  };
  ai?: {
    status: string;
    provider: string;
  };
}

export interface ConfigData {
  demoMode: boolean;
  durationPresets?: Record<string, number>;
  platformFeeBps?: number;
}

/**
 * Extracts and normalizes cookies from a Response object across fetch implementations.
 */
export function extractCookies(response: Response): string {
  const cookiePairs: string[] = [];
  const rawList: string[] = [];

  if (typeof response.headers.getSetCookie === "function") {
    const list = response.headers.getSetCookie();
    if (list && list.length > 0) {
      rawList.push(...list);
    }
  }

  if (rawList.length === 0) {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      rawList.push(setCookie);
    }
  }

  for (const item of rawList) {
    // Headers might combine multiple cookies with comma separation
    const parts = item.split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
    for (const part of parts) {
      const cookieVal = part.split(";")[0]?.trim();
      if (cookieVal && cookieVal.includes("=")) {
        cookiePairs.push(cookieVal);
      }
    }
  }

  return cookiePairs.join("; ");
}

/**
 * CLI argument parser for --url <base-url> and options.
 */
export function parsePreflightArgs(argv: string[]): PreflightOptions {
  const options: PreflightOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url" && i + 1 < argv.length) {
      options.url = argv[i + 1];
      i++;
    } else if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length);
    } else if (arg === "--skip-wait") {
      options.skipWait = true;
    } else if (arg.startsWith("--timeout=")) {
      options.timeoutMs = Number.parseInt(arg.slice("--timeout=".length), 10);
    } else if (arg === "--timeout" && i + 1 < argv.length) {
      options.timeoutMs = Number.parseInt(argv[i + 1], 10);
      i++;
    }
  }

  return options;
}

/**
 * Resolves a sample JPEG buffer from disk or fallback base64 fixture.
 */
export function getSamplePhotoBuffer(): Buffer {
  const candidatePaths = [
    path.resolve(scriptDir, "../src/seed/assets/samples/potato/A.jpg"),
    path.resolve(scriptDir, "../../../e2e/fixtures/potato-grade-a.jpg"),
    path.resolve(process.cwd(), "apps/api/src/seed/assets/samples/potato/A.jpg"),
    path.resolve(process.cwd(), "e2e/fixtures/potato-grade-a.jpg"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
  }

  // Fallback 1x1 valid JPEG if no sample file on disk
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  );
}

/**
 * Executes the full suite of BazarBeat preflight verification checks against a target deployment.
 */
export async function runPreflight(options: PreflightOptions = {}): Promise<PreflightSummary> {
  const startTime = Date.now();
  const stdout = options.stdout ?? ((msg: string): void => process.stdout.write(msg));
  const stderr = options.stderr ?? ((msg: string): void => process.stderr.write(msg));
  const fetchFn = options.fetchFn ?? fetch;

  const rawUrl =
    options.url ??
    process.env.PREFLIGHT_URL ??
    process.env.BASE_URL ??
    process.env.API_BASE_URL ??
    `http://localhost:${process.env.PORT || "4000"}`;

  const cleanBase = rawUrl.replace(/\/+$/, "").replace(/\/api(\/v1)?\/?$/, "");
  const apiUrl = `${cleanBase}/api/v1`;

  stdout(`============================================================\n`);
  stdout(`  BazarBeat Deployment Preflight Verification Suite\n`);
  stdout(`  Target Base URL: ${cleanBase}\n`);
  stdout(`  API Base URL:    ${apiUrl}\n`);
  stdout(`============================================================\n\n`);

  const results: CheckResult[] = [];

  function recordResult(name: string, passed: boolean, message: string, error?: string): void {
    results.push({ name, passed, message, error });
    const tag = passed ? "[PASS]" : "[FAIL]";
    stdout(`${tag} ${name}\n       ${message}\n`);
    if (!passed && error) {
      stderr(`       Error detail: ${error}\n`);
    }
  }

  let deepHealthData: DeepHealthData | null = null;
  let farmerSession: AuthSession | null = null;
  let buyerSession: AuthSession | null = null;
  let assessmentToken: string | null = null;
  let potatoCrop: PublicCrop | null = null;
  let createdListingId: string | null = null;

  // --------------------------------------------------------------------------
  // Check 1: health (deep)
  // --------------------------------------------------------------------------
  try {
    stdout(`Checking deep health endpoint...\n`);
    const res = await fetchFn(`${apiUrl}/health?deep=true`);
    const status = res.status;
    const body = (await res.json().catch(() => null)) as {
      data?: DeepHealthData;
      status?: string;
      services?: DeepHealthData["services"];
      uptime?: number;
    } | null;

    if (!res.ok) {
      recordResult(
        "health (deep)",
        false,
        `HTTP ${status} returned by /api/v1/health?deep=true`,
        JSON.stringify(body),
      );
    } else {
      deepHealthData = body?.data ?? (body as DeepHealthData | null);
      const overallStatus = deepHealthData?.status;
      if (overallStatus === "ok") {
        recordResult(
          "health (deep)",
          true,
          `Deep health check reports status: "ok" (version: ${deepHealthData?.version || "unknown"}, uptime: ${deepHealthData?.uptime ?? 0}s)`,
        );
      } else {
        recordResult(
          "health (deep)",
          false,
          `Deep health check reported status: "${overallStatus}" (expected "ok")`,
          JSON.stringify(deepHealthData),
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordResult("health (deep)", false, `Failed to reach /api/v1/health?deep=true: ${msg}`, msg);
  }

  // --------------------------------------------------------------------------
  // Check 2: AI service reachable and warm
  // --------------------------------------------------------------------------
  try {
    const aiProvider =
      deepHealthData?.ai?.provider ?? deepHealthData?.services?.ai?.provider ?? "unknown";
    const aiStatus = deepHealthData?.ai?.status ?? deepHealthData?.services?.ai?.status ?? "unknown";

    if (aiStatus === "ok" || aiStatus === "operational") {
      recordResult(
        "AI service reachable and warm",
        true,
        `AI provider "${aiProvider}" is warm and reporting status "${aiStatus}"`,
      );
    } else {
      recordResult(
        "AI service reachable and warm",
        false,
        `AI provider status is "${aiStatus}" (expected "ok" or "operational")`,
        `Provider: ${aiProvider}, status: ${aiStatus}`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordResult("AI service reachable and warm", false, `AI check failed: ${msg}`, msg);
  }

  // --------------------------------------------------------------------------
  // Check 3: database latency
  // --------------------------------------------------------------------------
  try {
    const dbStatus =
      deepHealthData?.database?.status ?? deepHealthData?.services?.db?.status ?? "disconnected";
    const dbLatency =
      deepHealthData?.database?.latencyMs ?? deepHealthData?.services?.db?.latencyMs ?? null;

    if (dbStatus === "connected" && typeof dbLatency === "number") {
      if (dbLatency < 2000) {
        recordResult(
          "database latency",
          true,
          `Database connected with responsive latency of ${dbLatency}ms`,
        );
      } else {
        recordResult(
          "database latency",
          false,
          `Database latency is high: ${dbLatency}ms (threshold: 2000ms)`,
        );
      }
    } else {
      recordResult(
        "database latency",
        false,
        `Database connection unhealthy (status: "${dbStatus}", latency: ${dbLatency}ms)`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordResult("database latency", false, `Database latency check failed: ${msg}`, msg);
  }

  // --------------------------------------------------------------------------
  // Check 8: the demo badge state (Check early so we verify demo config)
  // --------------------------------------------------------------------------
  try {
    stdout(`Checking demo badge configuration...\n`);
    const configRes = await fetchFn(`${apiUrl}/config`);
    const configJson = (await configRes.json().catch(() => null)) as {
      data?: ConfigData;
    } | null;

    if (configRes.ok && configJson?.data) {
      const configData = configJson.data;
      if (configData.demoMode === true) {
        recordResult(
          "the demo badge state",
          true,
          `Demo mode is ACTIVE (demoMode=true); "Demo mode: timers are shortened" badge enabled with fast presets`,
        );
      } else {
        recordResult(
          "the demo badge state",
          false,
          `Demo mode is INACTIVE (demoMode=${configData.demoMode}); expected true for demo deployment`,
        );
      }
    } else {
      recordResult(
        "the demo badge state",
        false,
        `Could not fetch config from ${apiUrl}/config (HTTP ${configRes.status})`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordResult("the demo badge state", false, `Failed to fetch public config: ${msg}`, msg);
  }

  // --------------------------------------------------------------------------
  // Check 6: logins for both demo roles
  // --------------------------------------------------------------------------
  const phoneFarmer = options.phoneFarmer ?? process.env.DEMO_FARMER_PHONE ?? "01700000001";
  const passwordFarmer =
    options.passwordFarmer ?? process.env.DEMO_FARMER_PASSWORD ?? "farmerpassword123";
  const phoneBuyer = options.phoneBuyer ?? process.env.DEMO_BUYER_PHONE ?? "01712345678";
  const passwordBuyer =
    options.passwordBuyer ?? process.env.DEMO_BUYER_PASSWORD ?? "buyerpassword123";

  try {
    stdout(`Authenticating demo farmer (${phoneFarmer})...\n`);
    const farmerRes = await fetchFn(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
      },
      body: JSON.stringify({ phone: phoneFarmer, password: passwordFarmer }),
    });

    const farmerBody = (await farmerRes.json().catch(() => null)) as {
      data?: { user?: AuthSession["user"] };
      error?: { code: string; message: string };
    } | null;

    if (!farmerRes.ok || !farmerBody?.data?.user) {
      const errDetail = farmerBody?.error?.message ?? `HTTP ${farmerRes.status}`;
      recordResult(
        "logins for both demo roles",
        false,
        `Demo farmer authentication failed (${phoneFarmer}): ${errDetail}`,
        errDetail,
      );
    } else {
      farmerSession = {
        user: farmerBody.data.user,
        cookieHeader: extractCookies(farmerRes),
      };

      stdout(`Authenticating demo buyer (${phoneBuyer})...\n`);
      const buyerRes = await fetchFn(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify({ phone: phoneBuyer, password: passwordBuyer }),
      });

      const buyerBody = (await buyerRes.json().catch(() => null)) as {
        data?: { user?: AuthSession["user"] };
        error?: { code: string; message: string };
      } | null;

      if (!buyerRes.ok || !buyerBody?.data?.user) {
        const errDetail = buyerBody?.error?.message ?? `HTTP ${buyerRes.status}`;
        recordResult(
          "logins for both demo roles",
          false,
          `Demo buyer authentication failed (${phoneBuyer}): ${errDetail}`,
          errDetail,
        );
      } else {
        buyerSession = {
          user: buyerBody.data.user,
          cookieHeader: extractCookies(buyerRes),
        };

        recordResult(
          "logins for both demo roles",
          true,
          `Successfully signed in demo farmer (${phoneFarmer}) and demo buyer (${phoneBuyer})`,
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordResult("logins for both demo roles", false, `Login request failed: ${msg}`, msg);
  }

  // --------------------------------------------------------------------------
  // Check 4: storage write and read
  // --------------------------------------------------------------------------
  if (!farmerSession) {
    recordResult(
      "storage write and read",
      false,
      "Skipped storage check because farmer authentication failed",
    );
  } else {
    try {
      stdout(`Testing storage write and read with sample produce photo...\n`);

      // 1. Fetch crops catalog to find Potato
      const cropsRes = await fetchFn(`${apiUrl}/crops`);
      const cropsJson = (await cropsRes.json().catch(() => null)) as {
        data?: PublicCrop[];
      } | null;

      potatoCrop =
        cropsJson?.data?.find(
          (c) => c.slug.toLowerCase() === "potato" || c.nameEn.toLowerCase() === "potato",
        ) ?? null;

      if (!potatoCrop) {
        recordResult(
          "storage write and read",
          false,
          "Failed to find 'potato' crop in /api/v1/crops catalog",
        );
      } else {
        const imageBuffer = getSamplePhotoBuffer();
        const boundary = `----BazarBeatPreflight${Date.now()}`;
        const filename = "sample-potato.jpg";

        const prefix = Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="cropId"\r\n\r\n${potatoCrop.id}\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${filename}"\r\n` +
            `Content-Type: image/jpeg\r\n\r\n`,
        );
        const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
        const multipartBody = Buffer.concat([prefix, imageBuffer, suffix]);

        const assessRes = await fetchFn(`${apiUrl}/ai/assess-quality`, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "X-CSRF-Protection": "1",
            Cookie: farmerSession.cookieHeader,
          },
          body: multipartBody,
        });

        const assessJson = (await assessRes.json().catch(() => null)) as {
          data?: {
            assessmentToken: string;
            images: { url: string; width: number; height: number; hash: string }[];
            grade: string;
          };
          error?: { code: string; message: string };
        } | null;

        if (!assessRes.ok || !assessJson?.data?.images?.[0]?.url) {
          const detail =
            assessJson?.error?.message ??
            `HTTP ${assessRes.status} ${assessRes.statusText}`;
          recordResult(
            "storage write and read",
            false,
            `Storage write failed during image upload: ${detail}`,
            detail,
          );
        } else {
          const storedImageUrl = assessJson.data.images[0].url;
          assessmentToken = assessJson.data.assessmentToken;

          // Read back stored image
          const absoluteReadUrl = storedImageUrl.startsWith("http")
            ? storedImageUrl
            : `${cleanBase}${storedImageUrl.startsWith("/") ? "" : "/"}${storedImageUrl}`;

          stdout(`Reading stored image from ${absoluteReadUrl}...\n`);
          const readRes = await fetchFn(absoluteReadUrl);

          if (!readRes.ok) {
            recordResult(
              "storage write and read",
              false,
              `Storage read failed for stored image: HTTP ${readRes.status} ${readRes.statusText} at ${absoluteReadUrl}`,
            );
          } else {
            const readBuffer = await readRes.arrayBuffer();
            if (readBuffer.byteLength > 0) {
              recordResult(
                "storage write and read",
                true,
                `Storage write and read verified (uploaded and retrieved ${readBuffer.byteLength} bytes from ${absoluteReadUrl})`,
              );
            } else {
              recordResult(
                "storage write and read",
                false,
                `Storage read returned 0 bytes from ${absoluteReadUrl}`,
              );
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordResult(
        "storage write and read",
        false,
        `Storage write/read encountered an unexpected error: ${msg}`,
        msg,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Check 5: scheduler alive (a short auction actually closes)
  // Check 7: a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup
  // --------------------------------------------------------------------------
  if (!farmerSession || !buyerSession || !potatoCrop || !assessmentToken) {
    const reason = !farmerSession || !buyerSession ? "authentication failed" : "image assessment failed";
    recordResult("scheduler alive (a short auction actually closes)", false, `Skipped because ${reason}`);
    recordResult(
      "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
      false,
      `Skipped because ${reason}`,
    );
  } else {
    try {
      stdout(`Initiating mini journey: creating short-timer listing for Potato...\n`);

      // Ensure farmer has available inventory for potato
      const invRes = await fetchFn(`${apiUrl}/inventory`, {
        headers: { Cookie: farmerSession.cookieHeader },
      });
      const invJson = (await invRes.json().catch(() => null)) as {
        data?: { cropId: string; availableKg: number }[];
      } | null;

      const potatoInv = invJson?.data?.find((i) => i.cropId === potatoCrop!.id);
      if (!potatoInv || potatoInv.availableKg < 10) {
        stdout(`Adding stock to farmer inventory for preflight listing...\n`);
        await fetchFn(`${apiUrl}/inventory/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Protection": "1",
            Cookie: farmerSession.cookieHeader,
          },
          body: JSON.stringify({
            cropId: potatoCrop.id,
            quantityKg: 50,
            note: "Stock added for preflight verification",
          }),
        });
      }

      // Check duration presets: prefer DEMO (2 mins)
      const duration = DEMO_LISTING_DURATION_PRESET_MINUTES;

      const createRes = await fetchFn(`${apiUrl}/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
          Cookie: farmerSession.cookieHeader,
        },
        body: JSON.stringify({
          cropId: potatoCrop.id,
          assessmentToken,
          quantityKg: 10,
          floorPricePerKg: 1500, // ৳15.00/kg
          durationMinutes: duration,
          pickupNote: "Preflight verification lot in Savar",
        }),
      });

      const createJson = (await createRes.json().catch(() => null)) as {
        data?: PublicListing;
        error?: { code: string; message: string };
      } | null;

      if (!createRes.ok || !createJson?.data?.id) {
        const errDetail = createJson?.error?.message ?? `HTTP ${createRes.status}`;
        recordResult(
          "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
          false,
          `Failed to create listing: ${errDetail}`,
          errDetail,
        );
        recordResult(
          "scheduler alive (a short auction actually closes)",
          false,
          `Cannot verify scheduler: listing creation failed (${errDetail})`,
        );
      } else {
        const listing = createJson.data;
        createdListingId = listing.id;
        stdout(`Created active listing ${createdListingId} (ends at ${listing.endsAt}).\n`);

        // Buyer places bid above floor
        stdout(`Buyer placing bid of ৳18.00/kg on listing ${createdListingId}...\n`);
        const bidRes = await fetchFn(`${apiUrl}/listings/${createdListingId}/bids`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Protection": "1",
            Cookie: buyerSession.cookieHeader,
          },
          body: JSON.stringify({
            amountPerKg: 1800, // ৳18.00/kg
            idempotencyKey: `preflight-bid-${createdListingId}-${Date.now()}`,
          }),
        });

        const bidJson = (await bidRes.json().catch(() => null)) as {
          data?: { currentBid: number };
          error?: { code: string; message: string };
        } | null;

        if (!bidRes.ok) {
          const errDetail = bidJson?.error?.message ?? `HTTP ${bidRes.status}`;
          recordResult(
            "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
            false,
            `Buyer bid failed on listing ${createdListingId}: ${errDetail}`,
            errDetail,
          );
          recordResult(
            "scheduler alive (a short auction actually closes)",
            false,
            `Cannot verify scheduler: bid failed (${errDetail})`,
          );
        } else {
          stdout(`Bid placed successfully (amount: ৳18.00/kg). Waiting for scheduler to close auction...\n`);

          const endsAtMs = new Date(listing.endsAt).getTime();
          const pollInterval = options.auctionPollIntervalMs ?? 2000;
          const maxWaitMs = options.maxCloseWaitMs ?? 150_000; // up to 2.5 minutes
          const waitStartTime = Date.now();
          let closedListing: PublicListing | null = null;

          while (Date.now() - waitStartTime < maxWaitMs) {
            const now = Date.now();
            if (now < endsAtMs) {
              const remainingSec = Math.ceil((endsAtMs - now) / 1000);
              stdout(`Auction active. Ends in ${remainingSec}s... (waiting for expiration)\n`);
              await new Promise((resolve) => setTimeout(resolve, Math.min(pollInterval, endsAtMs - now)));
              continue;
            }

            stdout(`Auction expired. Polling scheduler closing pass...\n`);
            const checkRes = await fetchFn(`${apiUrl}/listings/${createdListingId}`, {
              headers: { Cookie: farmerSession.cookieHeader },
            });
            const checkJson = (await checkRes.json().catch(() => null)) as {
              data?: PublicListing;
            } | null;

            if (checkJson?.data && checkJson.data.status !== "ACTIVE") {
              closedListing = checkJson.data;
              break;
            }

            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }

          if (!closedListing) {
            recordResult(
              "scheduler alive (a short auction actually closes)",
              false,
              `Listing ${createdListingId} did not close within ${Math.round(maxWaitMs / 1000)}s timeout`,
            );
            recordResult(
              "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
              false,
              `Mini journey timed out waiting for auction closing`,
            );
          } else if (closedListing.status !== "CLOSED_SOLD") {
            recordResult(
              "scheduler alive (a short auction actually closes)",
              false,
              `Auction closed with unexpected status "${closedListing.status}" (expected "CLOSED_SOLD")`,
            );
            recordResult(
              "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
              false,
              `Auction closed with unexpected status "${closedListing.status}"`,
            );
          } else {
            recordResult(
              "scheduler alive (a short auction actually closes)",
              true,
              `Scheduler successfully closed auction ${createdListingId} as CLOSED_SOLD automatically`,
            );

            // Verify order was created
            stdout(`Checking order creation for closed listing ${createdListingId}...\n`);
            const ordersRes = await fetchFn(`${apiUrl}/orders?listingId=${createdListingId}`, {
              headers: { Cookie: buyerSession.cookieHeader },
            });
            const ordersJson = (await ordersRes.json().catch(() => null)) as {
              data?: MinimalOrder[];
            } | null;

            const order = ordersJson?.data?.find((o) => o.listingId === createdListingId);

            if (!order) {
              recordResult(
                "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
                false,
                `No order found for closed listing ${createdListingId}`,
              );
            } else {
              const createdOrderId = order.id;
              stdout(`Order ${createdOrderId} generated in status "${order.status}" for ৳${formatPoisha(order.totalPoisha)}.\n`);

              // Cleanup: Buyer cancels test order
              stdout(`Cleaning up test order ${createdOrderId}...\n`);
              const cancelRes = await fetchFn(`${apiUrl}/orders/${createdOrderId}/cancel`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-Protection": "1",
                  Cookie: buyerSession.cookieHeader,
                },
                body: JSON.stringify({
                  reason: "Preflight verification automated cleanup",
                }),
              });

              if (!cancelRes.ok) {
                const cancelJson = (await cancelRes.json().catch(() => null)) as {
                  error?: { message: string };
                } | null;
                recordResult(
                  "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
                  false,
                  `Order ${createdOrderId} created but cleanup cancellation failed: ${cancelJson?.error?.message ?? cancelRes.statusText}`,
                );
              } else {
                recordResult(
                  "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
                  true,
                  `Mini journey complete: listed with photo, bid placed, auction closed sold, order ${createdOrderId} verified and cleaned up`,
                );
              }
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordResult(
        "scheduler alive (a short auction actually closes)",
        false,
        `Scheduler check failed with error: ${msg}`,
        msg,
      );
      recordResult(
        "a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
        false,
        `Mini journey failed with error: ${msg}`,
        msg,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Summary & Exit code
  // --------------------------------------------------------------------------
  const durationMs = Date.now() - startTime;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const allPassed = failedCount === 0 && results.length >= 8;

  stdout(`\n============================================================\n`);
  stdout(`  PREFLIGHT SUMMARY: ${passedCount} passed, ${failedCount} failed (${(durationMs / 1000).toFixed(1)}s)\n`);
  if (allPassed) {
    stdout(`  RESULT: ALL PREFLIGHT CHECKS PASSED\n`);
  } else {
    stderr(`  RESULT: PREFLIGHT FAILED (${failedCount} checks failed)\n`);
  }
  stdout(`============================================================\n\n`);

  return {
    success: allPassed,
    targetUrl: cleanBase,
    results,
    passedCount,
    failedCount,
    durationMs,
  };
}

// Direct CLI invocation
const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("preflight.ts") || process.argv[1].endsWith("preflight.js"));

if (isDirectExecution) {
  const cliOptions = parsePreflightArgs(process.argv.slice(2));
  void runPreflight(cliOptions)
    .then((summary) => {
      if (!summary.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      process.stderr.write(`Preflight crashed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
