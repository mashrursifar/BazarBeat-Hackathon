import { describe, expect, it, vi } from "vitest";

import {
  extractCookies,
  parsePreflightArgs,
  runPreflight,
} from "./preflight.js";

describe("Preflight Script (Task 9.5)", () => {
  describe("CLI Argument Parsing", () => {
    it("parses --url <url> and --url=<url>", () => {
      expect(parsePreflightArgs(["--url", "https://demo.bazarbeat.com"]).url).toBe(
        "https://demo.bazarbeat.com",
      );
      expect(parsePreflightArgs(["--url=https://demo.bazarbeat.com"]).url).toBe(
        "https://demo.bazarbeat.com",
      );
    });

    it("parses --timeout and --skip-wait", () => {
      const parsed = parsePreflightArgs(["--url", "http://localhost:4000", "--timeout", "5000", "--skip-wait"]);
      expect(parsed.url).toBe("http://localhost:4000");
      expect(parsed.timeoutMs).toBe(5000);
      expect(parsed.skipWait).toBe(true);
    });
  });

  describe("Cookie Extraction", () => {
    it("extracts and formats cookies from standard set-cookie header", () => {
      const mockResponse = new Response(null, {
        headers: {
          "set-cookie": "accessToken=abc123jwt; Path=/; HttpOnly, refreshToken=ref456jwt; Path=/; HttpOnly",
        },
      });
      const cookies = extractCookies(mockResponse);
      expect(cookies).toContain("accessToken=abc123jwt");
      expect(cookies).toContain("refreshToken=ref456jwt");
    });
  });

  describe("Preflight Suite Execution via Mock Fetch", () => {
    function createMockFetch(overrides: {
      healthStatus?: string;
      dbStatus?: string;
      dbLatency?: number | null;
      aiStatus?: string;
      aiProvider?: string;
      demoMode?: boolean;
      farmerLoginOk?: boolean;
      buyerLoginOk?: boolean;
      storageWriteOk?: boolean;
      storageErrorMessage?: string;
      storageReadOk?: boolean;
      auctionClosesOk?: boolean;
      orderCreatedOk?: boolean;
      orderCleanupOk?: boolean;
    } = {}): typeof fetch {
      const {
        healthStatus = "ok",
        dbStatus = "connected",
        dbLatency = 15,
        aiStatus = "ok",
        aiProvider = "mock",
        demoMode = true,
        farmerLoginOk = true,
        buyerLoginOk = true,
        storageWriteOk = true,
        storageErrorMessage = "Invalid storage credentials (Cloudinary authentication failed)",
        storageReadOk = true,
        auctionClosesOk = true,
        orderCreatedOk = true,
        orderCleanupOk = true,
      } = overrides;

      return vi.fn().mockImplementation(async (urlInput: string | URL | Request, init?: RequestInit) => {
        const url = String(urlInput);

        // 1. Deep health check
        if (url.includes("/api/v1/health")) {
          return new Response(
            JSON.stringify({
              data: {
                status: healthStatus,
                version: "git-sha-test-123",
                uptime: 120,
                database: {
                  status: dbStatus,
                  latencyMs: dbLatency,
                },
                storage: {
                  status: storageWriteOk ? "ok" : "degraded",
                  provider: "cloud",
                },
                ai: {
                  status: aiStatus,
                  provider: aiProvider,
                },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // 2. Config endpoint
        if (url.includes("/api/v1/config")) {
          return new Response(
            JSON.stringify({
              data: {
                demoMode,
                durationPresets: { DEMO: 2 },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // 3. Auth logins
        if (url.includes("/api/v1/auth/login")) {
          const body = JSON.parse(String(init?.body || "{}")) as { phone?: string };
          const isFarmer = body.phone === "01700000001";
          const isBuyer = body.phone === "01712345678";

          if (isFarmer && farmerLoginOk) {
            return new Response(
              JSON.stringify({
                data: {
                  user: {
                    id: "farmer-id-1",
                    phone: "01700000001",
                    role: "FARMER",
                    name: "Rahim Uddin",
                    division: "dhaka",
                  },
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "set-cookie": "accessToken=farmer-token; Path=/",
                },
              },
            );
          }

          if (isBuyer && buyerLoginOk) {
            return new Response(
              JSON.stringify({
                data: {
                  user: {
                    id: "buyer-id-1",
                    phone: "01712345678",
                    role: "BUYER",
                    name: "Karim Traders",
                    division: "dhaka",
                  },
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "set-cookie": "accessToken=buyer-token; Path=/",
                },
              },
            );
          }

          return new Response(
            JSON.stringify({
              error: { code: "UNAUTHENTICATED", message: "Invalid credentials" },
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // 4. Crops catalog
        if (url.includes("/api/v1/crops")) {
          return new Response(
            JSON.stringify({
              data: [
                { id: "potato-crop-id", slug: "potato", nameEn: "Potato", shelfLifeHours: 720 },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // 5. Inventory check / add
        if (url.includes("/api/v1/inventory")) {
          return new Response(
            JSON.stringify({
              data: [{ cropId: "potato-crop-id", availableKg: 100 }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // 6. AI Assessment (Storage write)
        if (url.includes("/api/v1/ai/assess-quality")) {
          if (!storageWriteOk) {
            return new Response(
              JSON.stringify({
                error: {
                  code: "STORAGE_ERROR",
                  message: storageErrorMessage,
                },
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              data: {
                assessmentToken: "valid-assessment-token-xyz",
                grade: "A",
                images: [
                  {
                    url: "https://storage.bazarbeat.com/photos/potato-sample.jpg",
                    width: 800,
                    height: 600,
                    hash: "abc123hash",
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // 7. Storage read
        if (url.includes("potato-sample.jpg")) {
          if (!storageReadOk) {
            return new Response("Not Found", { status: 404 });
          }
          return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          });
        }

        // 8. Listings creation & retrieval
        if (url.includes("/api/v1/listings") && !url.includes("/bids")) {
          if (init?.method === "POST") {
            return new Response(
              JSON.stringify({
                data: {
                  id: "test-listing-id-123",
                  status: "ACTIVE",
                  endsAt: new Date(Date.now() - 1000).toISOString(), // already expired for fast test
                },
              }),
              { status: 201, headers: { "Content-Type": "application/json" } },
            );
          }

          // Polling listing
          return new Response(
            JSON.stringify({
              data: {
                id: "test-listing-id-123",
                status: auctionClosesOk ? "CLOSED_SOLD" : "ACTIVE",
                endsAt: new Date(Date.now() - 5000).toISOString(),
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // 9. Bidding
        if (url.includes("/bids")) {
          return new Response(
            JSON.stringify({
              data: { currentBid: 1800 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // 10. Orders
        if (url.includes("/api/v1/orders")) {
          if (init?.method === "POST" && url.includes("/cancel")) {
            return new Response(
              JSON.stringify({
                data: { id: "test-order-id-789", status: orderCleanupOk ? "CANCELLED" : "PENDING" },
              }),
              { status: orderCleanupOk ? 200 : 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              data: orderCreatedOk
                ? [
                    {
                      id: "test-order-id-789",
                      listingId: "test-listing-id-123",
                      status: "PENDING",
                      totalPoisha: 18000,
                    },
                  ]
                : [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      }) as unknown as typeof fetch;
    }

    it("passes all 8 checks on healthy demo deployment and prints clear pass output", async () => {
      const output: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch(),
        stdout,
        stderr: stdout,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 1000,
      });

      expect(summary.success).toBe(true);
      expect(summary.passedCount).toBe(8);
      expect(summary.failedCount).toBe(0);

      const printed = output.join("");
      expect(printed).toContain("[PASS] health (deep)");
      expect(printed).toContain("[PASS] AI service reachable and warm");
      expect(printed).toContain("[PASS] database latency");
      expect(printed).toContain("[PASS] storage write and read");
      expect(printed).toContain("[PASS] logins for both demo roles");
      expect(printed).toContain("[PASS] the demo badge state");
      expect(printed).toContain("[PASS] scheduler alive (a short auction actually closes)");
      expect(printed).toContain(
        "[PASS] a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup",
      );
      expect(printed).toContain("ALL PREFLIGHT CHECKS PASSED");
    });

    it("deliberately breaking storage key causes storage check to fail with a readable message", async () => {
      const output: string[] = [];
      const errors: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };
      const stderr = (msg: string): void => {
        errors.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch({
          storageWriteOk: false,
          storageErrorMessage: "Invalid API secret provided for Cloudinary storage",
        }),
        stdout,
        stderr,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 1000,
      });

      expect(summary.success).toBe(false);
      expect(summary.failedCount).toBeGreaterThanOrEqual(1);

      const storageResult = summary.results.find((r) => r.name === "storage write and read");
      expect(storageResult?.passed).toBe(false);
      expect(storageResult?.message).toContain("Storage write failed");
      expect(storageResult?.error).toContain("Invalid API secret provided for Cloudinary storage");

      const printed = output.join("") + errors.join("");
      expect(printed).toContain("[FAIL] storage write and read");
      expect(printed).toContain("Invalid API secret provided for Cloudinary storage");
    });

    it("failing database latency check reports failure when database disconnected", async () => {
      const output: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch({
          dbStatus: "disconnected",
          dbLatency: null,
          healthStatus: "degraded",
        }),
        stdout,
        stderr: stdout,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 1000,
      });

      expect(summary.success).toBe(false);
      const dbCheck = summary.results.find((r) => r.name === "database latency");
      expect(dbCheck?.passed).toBe(false);
      expect(dbCheck?.message).toContain("Database connection unhealthy");
    });

    it("failing AI status check reports failure when AI service is degraded", async () => {
      const output: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch({
          aiStatus: "degraded",
        }),
        stdout,
        stderr: stdout,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 1000,
      });

      expect(summary.success).toBe(false);
      const aiCheck = summary.results.find((r) => r.name === "AI service reachable and warm");
      expect(aiCheck?.passed).toBe(false);
      expect(aiCheck?.message).toContain('AI provider status is "degraded"');
    });

    it("failing demo role authentication reports matching failure", async () => {
      const output: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch({
          farmerLoginOk: false,
        }),
        stdout,
        stderr: stdout,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 1000,
      });

      expect(summary.success).toBe(false);
      const loginCheck = summary.results.find((r) => r.name === "logins for both demo roles");
      expect(loginCheck?.passed).toBe(false);
      expect(loginCheck?.message).toContain("Demo farmer authentication failed");
    });

    it("reports failure when demo mode is inactive (demo badge check)", async () => {
      const output: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch({
          demoMode: false,
        }),
        stdout,
        stderr: stdout,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 1000,
      });

      expect(summary.success).toBe(false);
      const badgeCheck = summary.results.find((r) => r.name === "the demo badge state");
      expect(badgeCheck?.passed).toBe(false);
      expect(badgeCheck?.message).toContain("Demo mode is INACTIVE");
    });

    it("reports failure when scheduler fails to close an expired auction", async () => {
      const output: string[] = [];
      const stdout = (msg: string): void => {
        output.push(msg);
      };

      const summary = await runPreflight({
        url: "https://demo.bazarbeat.com",
        fetchFn: createMockFetch({
          auctionClosesOk: false,
        }),
        stdout,
        stderr: stdout,
        auctionPollIntervalMs: 10,
        maxCloseWaitMs: 50,
      });

      expect(summary.success).toBe(false);
      const schedulerCheck = summary.results.find(
        (r) => r.name === "scheduler alive (a short auction actually closes)",
      );
      expect(schedulerCheck?.passed).toBe(false);
      expect(schedulerCheck?.message).toContain("did not close within");
    });
  });
});
