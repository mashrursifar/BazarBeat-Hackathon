import { promises as fs } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { AppError } from "../../shared/errors.js";
import { env } from "../../config/env.js";
import type { StorageProvider } from "./storage-provider.interface.js";
import { LocalDiskStorageProvider } from "./local-disk.provider.js";
import { S3StorageProvider, parseS3Config } from "./s3.provider.js";
import { createStorageProvider } from "./storage.factory.js";

const DUMMY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const DUMMY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DUMMY_WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

describe("StorageProvider Contract Tests", () => {
  const testUploadDir = join(process.cwd(), "tmp/test-contract-uploads");

  // Track S3 mock commands
  let sentS3Commands: unknown[] = [];
  let mockS3Client: S3Client;

  beforeEach(() => {
    sentS3Commands = [];
    mockS3Client = {
      send: vi.fn().mockImplementation(async (command: unknown) => {
        sentS3Commands.push(command);
        return { $metadata: { httpStatusCode: 200 } };
      }),
    } as unknown as S3Client;
  });

  afterAll(async () => {
    try {
      await fs.rm(testUploadDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // Providers under test
  const providers: {
    name: string;
    createProvider: () => StorageProvider;
    isCloud: boolean;
  }[] = [
    {
      name: "LocalDiskStorageProvider",
      createProvider: () => new LocalDiskStorageProvider(),
      isCloud: false,
    },
    {
      name: "S3StorageProvider (Cloud)",
      createProvider: () =>
        new S3StorageProvider(
          {
            bucket: "bazarbeat-test-bucket",
            accessKeyId: "mock-access-key-id",
            secretAccessKey: "super-secret-access-key-do-not-leak",
            endpoint: "https://mock-account.r2.cloudflarestorage.com",
            region: "auto",
            publicUrl: "https://pub-test.r2.dev",
            forcePathStyle: false,
          },
          mockS3Client,
        ),
      isCloud: true,
    },
  ];

  for (const { name, createProvider, isCloud } of providers) {
    describe(`Contract implementation: ${name}`, () => {
      it("stores JPEG image and returns a valid public URL with .jpg extension", async () => {
        const provider = createProvider();
        const url = await provider.store(DUMMY_JPEG, "produce.jpg");

        expect(typeof url).toBe("string");
        expect(url.length).toBeGreaterThan(0);
        expect(url.endsWith(".jpg")).toBe(true);

        if (isCloud) {
          expect(url).toMatch(/^https:\/\/pub-test\.r2\.dev\/crops\/[a-f0-9-]+\.jpg$/);
          expect(sentS3Commands.length).toBe(1);
          const cmd = sentS3Commands[0] as PutObjectCommand;
          expect(cmd.input.Bucket).toBe("bazarbeat-test-bucket");
          expect(cmd.input.ContentType).toBe("image/jpeg");
          expect(cmd.input.Body).toBe(DUMMY_JPEG);
        } else {
          expect(url).toMatch(/^\/uploads\/[a-f0-9-]+\.jpg$/);
        }
      });

      it("stores PNG image and returns a URL with .png extension", async () => {
        const provider = createProvider();
        const url = await provider.store(DUMMY_PNG, "test-crop.png");

        expect(url.endsWith(".png")).toBe(true);
        if (isCloud) {
          const cmd = sentS3Commands[sentS3Commands.length - 1] as PutObjectCommand;
          expect(cmd.input.ContentType).toBe("image/png");
        }
      });

      it("stores WebP image and returns a URL with .webp extension", async () => {
        const provider = createProvider();
        const url = await provider.store(DUMMY_WEBP, "test-crop.webp");

        expect(url.endsWith(".webp")).toBe(true);
        if (isCloud) {
          const cmd = sentS3Commands[sentS3Commands.length - 1] as PutObjectCommand;
          expect(cmd.input.ContentType).toBe("image/webp");
        }
      });

      it("gracefully defaults extension to .jpg when original name has no extension", async () => {
        const provider = createProvider();
        const url = await provider.store(DUMMY_JPEG, "raw-photo-without-ext");

        expect(url.endsWith(".jpg")).toBe(true);
      });

      it("generates distinct unique URLs for two uploads with identical original filenames", async () => {
        const provider = createProvider();
        const url1 = await provider.store(DUMMY_JPEG, "sample.jpg");
        const url2 = await provider.store(DUMMY_JPEG, "sample.jpg");

        expect(url1).not.toBe(url2);
      });
    });
  }

  describe("S3StorageProvider Specific Configuration & Error Handling", () => {
    it("parses S3 configuration correctly from environment dictionary", () => {
      const config = parseS3Config({
        S3_BUCKET: "my-bucket",
        S3_ACCESS_KEY_ID: "key-123",
        S3_SECRET_ACCESS_KEY: "secret-456",
        S3_ENDPOINT: "https://my-endpoint.r2.cloudflarestorage.com",
        S3_REGION: "auto",
        S3_PUBLIC_URL: "https://cdn.example.com/",
        S3_FORCE_PATH_STYLE: "true",
      });

      expect(config).toEqual({
        bucket: "my-bucket",
        accessKeyId: "key-123",
        secretAccessKey: "secret-456",
        endpoint: "https://my-endpoint.r2.cloudflarestorage.com",
        region: "auto",
        publicUrl: "https://cdn.example.com",
        forcePathStyle: true,
      });
    });

    it("falls back to AWS_* standard env variables if S3_* are absent", () => {
      const config = parseS3Config({
        AWS_S3_BUCKET: "aws-bucket",
        AWS_ACCESS_KEY_ID: "aws-key",
        AWS_SECRET_ACCESS_KEY: "aws-secret",
        AWS_REGION: "us-west-2",
      });

      expect(config.bucket).toBe("aws-bucket");
      expect(config.accessKeyId).toBe("aws-key");
      expect(config.secretAccessKey).toBe("aws-secret");
      expect(config.region).toBe("us-west-2");
    });

    it("throws CONFIG_ERROR (500) when required S3 credentials are missing", () => {
      expect(() => parseS3Config({})).toThrowError(AppError);
      try {
        parseS3Config({});
      } catch (err) {
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(500);
        expect(appErr.code).toBe("CONFIG_ERROR");
      }
    });

    it("generates virtual hosted style or custom endpoint URL when publicUrl is not set", async () => {
      const provider = new S3StorageProvider(
        {
          bucket: "my-bucket",
          accessKeyId: "key",
          secretAccessKey: "secret",
          endpoint: "https://r2.cloudflarestorage.com",
          region: "auto",
        },
        mockS3Client,
      );

      const url = await provider.store(DUMMY_JPEG, "crop.jpg");
      expect(url).toMatch(/^https:\/\/my-bucket\.r2\.cloudflarestorage\.com\/crops\/[a-f0-9-]+\.jpg$/);
    });

    it("generates path style endpoint URL when forcePathStyle is true", async () => {
      const provider = new S3StorageProvider(
        {
          bucket: "my-bucket",
          accessKeyId: "key",
          secretAccessKey: "secret",
          endpoint: "http://localhost:9000",
          region: "auto",
          forcePathStyle: true,
        },
        mockS3Client,
      );

      const url = await provider.store(DUMMY_JPEG, "crop.jpg");
      expect(url).toMatch(/^http:\/\/localhost:9000\/my-bucket\/crops\/[a-f0-9-]+\.jpg$/);
    });

    it("throws STORAGE_ERROR (502) and redacts secrets when S3Client throws an error", async () => {
      const failingClient = {
        send: vi.fn().mockRejectedValue(new Error("AccessDenied: Invalid signature")),
      } as unknown as S3Client;

      const secretKey = "super-sensitive-secret-token-12345";
      const provider = new S3StorageProvider(
        {
          bucket: "test-bucket",
          accessKeyId: "test-key",
          secretAccessKey: secretKey,
          publicUrl: "https://pub.example.com",
        },
        failingClient,
      );

      await expect(provider.store(DUMMY_JPEG, "fail.jpg")).rejects.toThrowError(AppError);
      await expect(provider.store(DUMMY_JPEG, "fail.jpg")).rejects.toMatchObject({
        statusCode: 502,
        code: "STORAGE_ERROR",
      });

      try {
        await provider.store(DUMMY_JPEG, "fail.jpg");
      } catch (err) {
        const appErr = err as AppError;
        // Verify no credentials leaked into the error message
        expect(appErr.message).not.toContain(secretKey);
      }
    });
  });

  describe("createStorageProvider factory selection", () => {
    const originalEnv = { ...env };

    afterEach(() => {
      Object.assign(env, originalEnv);
    });

    it("returns LocalDiskStorageProvider when STORAGE_PROVIDER=local and no cloud config", () => {
      env.STORAGE_PROVIDER = "local";
      delete env.S3_BUCKET;
      delete env.S3_ACCESS_KEY_ID;
      delete env.CLOUDINARY_URL;
      delete env.CLOUDINARY_CLOUD_NAME;

      const provider = createStorageProvider();
      expect(provider).toBeInstanceOf(LocalDiskStorageProvider);
    });

    it("returns S3StorageProvider when STORAGE_PROVIDER=cloud and S3 credentials provided", () => {
      env.STORAGE_PROVIDER = "cloud";
      env.S3_BUCKET = "bazarbeat-uploads";
      env.S3_ACCESS_KEY_ID = "key-abc";
      env.S3_SECRET_ACCESS_KEY = "secret-xyz";

      const provider = createStorageProvider();
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });
  });

  describe("Seeding and Quality Assessment Photo Storage Integration", () => {
    it("stores sample photos through active cloud provider and produces cloud URLs", async () => {
      const cloudProvider = new S3StorageProvider(
        {
          bucket: "bazarbeat-uploads",
          accessKeyId: "mock-key",
          secretAccessKey: "mock-secret",
          publicUrl: "https://pub-bazarbeat.r2.dev",
        },
        mockS3Client,
      );

      // Simulate the upload flow that dev-listings seeder uses:
      const photoBuffer = DUMMY_JPEG;
      const uploadedUrl = await cloudProvider.store(photoBuffer, "A.jpg");

      expect(uploadedUrl).toMatch(/^https:\/\/pub-bazarbeat\.r2\.dev\/crops\/[a-f0-9-]+\.jpg$/);
      expect(sentS3Commands.length).toBe(1);

      const command = sentS3Commands[0] as PutObjectCommand;
      expect(command.input.Bucket).toBe("bazarbeat-uploads");
      expect(command.input.ContentType).toBe("image/jpeg");
      expect(command.input.Body).toBe(photoBuffer);
    });
  });
});
