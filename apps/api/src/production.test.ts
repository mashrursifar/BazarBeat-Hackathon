import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import compression from "compression";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { getCookieSecurityOptions } from "./modules/auth/auth.controller.js";
import { getActiveScheduler, startScheduler } from "./modules/auctions/scheduler.service.js";
import { getListingStreamHub } from "./modules/realtime/sse-hub.js";
import { getUserStreamHub } from "./modules/realtime/user-stream-hub.js";
import { performGracefulShutdown } from "./shared/shutdown.js";
import { configureWebServing, findWebDistPath } from "./modules/web/web-serving.js";
import * as dbModule from "./shared/db.js";

describe("Production Readiness and Hardening (Task 9.1)", () => {
  describe("Security Headers & Helmet CSP", () => {
    it("returns hardened security headers and customized CSP matching fonts and scripts", async () => {
      const response = await request(app).get("/api/v1/health");

      expect(response.status).toBe(200);
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");

      const csp = response.headers["content-security-policy"];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("https://fonts.googleapis.com");
      expect(csp).toContain("https://fonts.gstatic.com");
      expect(csp).toContain("script-src 'self'");
    });
  });

  describe("Deep Health Check (/api/v1/health?deep=true)", () => {
    it("returns standard status when ?deep is not specified", async () => {
      const response = await request(app).get("/api/v1/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: {
          status: "ok",
          database: expect.any(String),
        },
      });
    });

    it("reports database latency, storage provider, AI provider, and version when ?deep=true", async () => {
      const dbStatusSpy = vi.spyOn(dbModule, "getDatabaseStatus").mockReturnValue("connected");
      const originalDb = mongoose.connection.db;
      (mongoose.connection as unknown as { db: unknown }).db = {
        admin: (): { ping: () => Promise<{ ok: number }> } => ({
          ping: vi.fn().mockResolvedValue({ ok: 1 }),
        }),
      };

      try {
        const response = await request(app).get("/api/v1/health?deep=true");

        expect(response.status).toBe(200);
        const data = response.body.data;
        expect(data.status).toBe("ok");
        expect(data.version).toBe(env.GIT_SHA);
        expect(data.database.status).toBe("connected");
        expect(typeof data.database.latencyMs).toBe("number");
        expect(data.database.latencyMs).toBeGreaterThanOrEqual(0);

        expect(data.storage.status).toBe("ok");
        expect(data.storage.provider).toBe(env.STORAGE_PROVIDER);

        expect(data.ai.status).toBe("ok");
        expect(data.ai.provider).toBe("mock");

        expect(typeof data.uptime).toBe("number");
        expect(typeof data.timestamp).toBe("string");
      } finally {
        dbStatusSpy.mockRestore();
        (mongoose.connection as unknown as { db: unknown }).db = originalDb;
      }
    });

    it("reports degraded overall status if database is disconnected", async () => {
      const dbStatusSpy = vi.spyOn(dbModule, "getDatabaseStatus").mockReturnValue("disconnected");
      try {
        const response = await request(app).get("/api/v1/health?deep=true");
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe("degraded");
        expect(response.body.data.database.status).toBe("disconnected");
        expect(response.body.data.database.latencyMs).toBeNull();
      } finally {
        dbStatusSpy.mockRestore();
      }
    });
  });

  describe("Static Serving and SPA Fallback", () => {
    const testDistDir = path.resolve(process.cwd(), "apps/api/test-web-dist");
    const testAssetsDir = path.join(testDistDir, "assets");
    let testApp: express.Express;

    beforeAll(() => {
      if (!fs.existsSync(testAssetsDir)) {
        fs.mkdirSync(testAssetsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(testDistDir, "index.html"),
        "<!doctype html><html><head><title>BazarBeat Test</title></head><body><div id='root'>SPA</div></body></html>",
      );
      fs.writeFileSync(path.join(testAssetsDir, "main-abc123.js"), "console.log('hashed bundle');");

      testApp = express();
      testApp.get("/api/v1/test", (_req, res) => {
        res.json({ ok: true });
      });
      testApp.use("/api", (_req, res) => {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint not found" } });
      });
      configureWebServing(testApp, testDistDir);
    });

    afterAll(() => {
      if (fs.existsSync(testDistDir)) {
        fs.rmSync(testDistDir, { recursive: true, force: true });
      }
    });

    it("serves hashed assets with long-term immutable caching headers", async () => {
      const response = await request(testApp).get("/assets/main-abc123.js");
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toContain("public");
      expect(response.headers["cache-control"]).toContain("max-age=31536000");
      expect(response.headers["cache-control"]).toContain("immutable");
      expect(response.text).toContain("hashed bundle");
    });

    it("serves index.html with no-cache headers on client route SPA fallback", async () => {
      const response = await request(testApp).get("/buyer/marketplace");
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-cache");
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.headers["pragma"]).toBe("no-cache");
      expect(response.text).toContain("<!doctype html>");
      expect(response.text).toContain("SPA");
    });

    it("does not fall back to SPA html for nonexistent API routes, returning 404 JSON", async () => {
      const response = await request(testApp).get("/api/v1/nonexistent-route");
      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "API endpoint not found",
        },
      });
    });

    it("locates existing web dist build if present in repository", () => {
      const detected = findWebDistPath();
      if (fs.existsSync(path.resolve(process.cwd(), "apps/web/dist/index.html"))) {
        expect(detected).not.toBeNull();
      }
    });
  });

  describe("Production Cookie Security Flags", () => {
    it("dynamically returns secure: true when NODE_ENV is production", () => {
      const originalEnv = env.NODE_ENV;
      try {
        (env as { NODE_ENV: string }).NODE_ENV = "production";
        const options = getCookieSecurityOptions();
        expect(options.secure).toBe(true);
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe("lax");
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = originalEnv;
      }
    });

    it("returns secure: false in non-production development and test environments", () => {
      const originalEnv = env.NODE_ENV;
      try {
        (env as { NODE_ENV: string }).NODE_ENV = "test";
        const options = getCookieSecurityOptions();
        expect(options.secure).toBe(false);
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe("lax");
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = originalEnv;
      }
    });
  });

  describe("Trust Proxy & Forwarded IP Rate Limiting", () => {
    it("distinguishes separate forwarded client IPs when trust proxy is active", async () => {
      const proxyApp = express();
      proxyApp.set("trust proxy", true);

      let lastSeenIp = "";
      proxyApp.get("/test-ip", (req, res) => {
        lastSeenIp = req.ip || "";
        res.json({ ip: req.ip });
      });

      const res1 = await request(proxyApp)
        .get("/test-ip")
        .set("X-Forwarded-For", "203.0.113.195, 10.0.0.1");

      expect(res1.body.ip).toBe("203.0.113.195");
      expect(lastSeenIp).toBe("203.0.113.195");

      const res2 = await request(proxyApp)
        .get("/test-ip")
        .set("X-Forwarded-For", "198.51.100.42, 10.0.0.1");

      expect(res2.body.ip).toBe("198.51.100.42");
      expect(lastSeenIp).toBe("198.51.100.42");
    });

    it("enforces rate limits based on forwarded client IP", async () => {
      const rateLimitApp = express();
      rateLimitApp.set("trust proxy", true);
      const testLimiter = rateLimit({
        windowMs: 60_000,
        limit: 2,
        standardHeaders: true,
        legacyHeaders: false,
        validate: { trustProxy: false },
      });
      rateLimitApp.get("/rate-test", testLimiter, (req, res) => {
        res.json({ ip: req.ip });
      });

      // 2 requests from IP A succeed
      const resA1 = await request(rateLimitApp)
        .get("/rate-test")
        .set("X-Forwarded-For", "192.0.2.1");
      expect(resA1.status).toBe(200);
      const resA2 = await request(rateLimitApp)
        .get("/rate-test")
        .set("X-Forwarded-For", "192.0.2.1");
      expect(resA2.status).toBe(200);

      // 3rd request from IP A is rate limited
      const resA3 = await request(rateLimitApp)
        .get("/rate-test")
        .set("X-Forwarded-For", "192.0.2.1");
      expect(resA3.status).toBe(429);

      // Request from IP B succeeds because rate limit is keyed by forwarded IP
      const resB1 = await request(rateLimitApp)
        .get("/rate-test")
        .set("X-Forwarded-For", "192.0.2.2");
      expect(resB1.status).toBe(200);
    });
  });

  describe("Compression Filter (Bypasses Live Streams)", () => {
    it("bypasses compression when client requests text/event-stream or Cache-Control no-transform", async () => {
      const compApp = express();
      compApp.use(
        compression({
          filter: (req, res) => {
            const accept = req.headers.accept;
            if (typeof accept === "string" && accept.includes("text/event-stream")) {
              return false;
            }
            const contentType = res.getHeader("content-type");
            if (typeof contentType === "string" && contentType.includes("text/event-stream")) {
              return false;
            }
            const cacheControl = res.getHeader("cache-control");
            if (typeof cacheControl === "string" && cacheControl.includes("no-transform")) {
              return false;
            }
            return compression.filter(req, res);
          },
        }),
      );

      compApp.get("/stream", (_req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.write("data: live-update\n\n");
        res.end();
      });

      const streamRes = await request(compApp).get("/stream").set("Accept", "text/event-stream");

      expect(streamRes.status).toBe(200);
      expect(streamRes.headers["content-encoding"]).toBeUndefined();
      expect(streamRes.text).toContain("data: live-update");
    });
  });

  describe("Graceful Shutdown", () => {
    it("stops the auction scheduler and cleans up active SSE streams cleanly", async () => {
      // 1. Ensure scheduler is active
      const scheduler = startScheduler();
      expect(scheduler.isRunning()).toBe(true);
      expect(getActiveScheduler()).not.toBeNull();

      // 2. Stream hubs are active
      const listingHub = getListingStreamHub();
      const userHub = getUserStreamHub();

      // 3. Create dummy server to pass to graceful shutdown
      const dummyServer = http.createServer();
      await new Promise<void>((resolve) => dummyServer.listen(0, resolve));

      // 4. Perform graceful shutdown without exiting test runner process
      await performGracefulShutdown(dummyServer, { exitProcess: false });

      // 5. Verify scheduler stopped
      expect(getActiveScheduler()).toBeNull();

      // 6. Verify stream hubs cleared
      expect(listingHub.getSubscriberCount()).toBe(0);
      expect(userHub.getTotalStreamCount()).toBe(0);
    });
  });
});
