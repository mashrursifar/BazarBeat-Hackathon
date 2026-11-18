import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CloudinaryStorageProvider,
  parseCloudinaryConfig,
} from "./cloudinary.provider.js";
import { createStorageProvider } from "./storage.factory.js";
import { LocalDiskStorageProvider } from "./local-disk.provider.js";
import { AppError } from "../../shared/errors.js";

describe("Cloudinary Configuration Parsing", () => {
  it("parses valid CLOUDINARY_URL format correctly", () => {
    const config = parseCloudinaryConfig({
      CLOUDINARY_URL: "cloudinary://123456789:mySecretKey@my-cloud",
    });

    expect(config).toEqual({
      cloudName: "my-cloud",
      apiKey: "123456789",
      apiSecret: "mySecretKey",
    });
  });

  it("handles URL-encoded api_key and api_secret in CLOUDINARY_URL", () => {
    const config = parseCloudinaryConfig({
      CLOUDINARY_URL: "cloudinary://user%2Bkey:pass%24word@my-cloud",
    });

    expect(config).toEqual({
      cloudName: "my-cloud",
      apiKey: "user+key",
      apiSecret: "pass$word",
    });
  });

  it("parses discrete environment variables when CLOUDINARY_URL is absent", () => {
    const config = parseCloudinaryConfig({
      CLOUDINARY_CLOUD_NAME: "custom-cloud",
      CLOUDINARY_API_KEY: "custom-key",
      CLOUDINARY_API_SECRET: "custom-secret",
    });

    expect(config).toEqual({
      cloudName: "custom-cloud",
      apiKey: "custom-key",
      apiSecret: "custom-secret",
    });
  });

  it("throws CONFIG_ERROR when configuration is missing", () => {
    expect(() => parseCloudinaryConfig({})).toThrowError(AppError);
    try {
      parseCloudinaryConfig({});
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe("CONFIG_ERROR");
    }
  });
});

describe("CloudinaryStorageProvider.store", () => {
  const mockConfig = {
    cloudName: "test-cloud",
    apiKey: "test-key-123",
    apiSecret: "test-secret-456",
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uploads buffer to Cloudinary REST endpoint and returns secure_url", async () => {
    const expectedUrl = "https://res.cloudinary.com/test-cloud/image/upload/v1234567/sample.jpg";

    let capturedUrl = "";
    let capturedBody: FormData | null = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = init?.body as FormData;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          secure_url: expectedUrl,
          public_id: "bazarbeat/crops/sample",
        }),
      } as unknown as Response;
    });

    const provider = new CloudinaryStorageProvider(mockConfig, "bazarbeat/test-crops");
    const dummyBuffer = Buffer.from("fake-image-bytes");
    const resultUrl = await provider.store(dummyBuffer, "crop.jpeg");

    expect(resultUrl).toBe(expectedUrl);
    expect(capturedUrl).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    expect(capturedBody).toBeInstanceOf(FormData);
    const body = capturedBody as unknown as FormData;
    expect(body.get("folder")).toBe("bazarbeat/test-crops");
    expect(body.get("api_key")).toBe("test-key-123");
    expect(typeof body.get("signature")).toBe("string");
    expect((body.get("signature") as string).length).toBe(40); // SHA-1 hex
  });

  it("throws STORAGE_ERROR (502) if Cloudinary returns an HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Invalid Signature",
    } as unknown as Response);

    const provider = new CloudinaryStorageProvider(mockConfig);
    const dummyBuffer = Buffer.from("fake-image-bytes");

    await expect(provider.store(dummyBuffer, "crop.jpg")).rejects.toThrowError(AppError);
    await expect(provider.store(dummyBuffer, "crop.jpg")).rejects.toMatchObject({
      statusCode: 502,
      code: "STORAGE_ERROR",
    });
  });

  it("throws STORAGE_ERROR (502) if response lacks secure_url", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ public_id: "no-url" }),
    } as unknown as Response);

    const provider = new CloudinaryStorageProvider(mockConfig);
    const dummyBuffer = Buffer.from("fake-image-bytes");

    await expect(provider.store(dummyBuffer, "crop.jpg")).rejects.toThrowError(AppError);
    await expect(provider.store(dummyBuffer, "crop.jpg")).rejects.toMatchObject({
      statusCode: 502,
      code: "STORAGE_ERROR",
    });
  });

  it("throws STORAGE_ERROR (502) if network connection fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection reset by peer"));

    const provider = new CloudinaryStorageProvider(mockConfig);
    const dummyBuffer = Buffer.from("fake-image-bytes");

    await expect(provider.store(dummyBuffer, "crop.jpg")).rejects.toThrowError(AppError);
    await expect(provider.store(dummyBuffer, "crop.jpg")).rejects.toMatchObject({
      statusCode: 502,
      code: "STORAGE_ERROR",
    });
  });
});

describe("Storage Factory", () => {
  it("creates LocalDiskStorageProvider by default when no cloud credentials", () => {
    const provider = createStorageProvider();
    expect(provider).toBeInstanceOf(LocalDiskStorageProvider);
  });
});
