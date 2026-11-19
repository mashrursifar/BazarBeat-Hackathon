import { env } from "../../config/env.js";
import type { StorageProvider } from "./storage-provider.interface.js";
import { LocalDiskStorageProvider } from "./local-disk.provider.js";
import { S3StorageProvider } from "./s3.provider.js";
import { CloudinaryStorageProvider } from "./cloudinary.provider.js";

/**
 * Creates the appropriate StorageProvider based on environment configuration.
 * When STORAGE_PROVIDER is 'cloud', S3StorageProvider (S3-compatible, e.g. Cloudflare R2) is selected.
 * If legacy/alternative Cloudinary variables are supplied without S3, CloudinaryStorageProvider is used.
 * Defaults to LocalDiskStorageProvider for local development and offline test suites.
 */
export function createStorageProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER === "cloud") {
    const hasS3 = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID);
    const hasCloudinary = Boolean(env.CLOUDINARY_URL || env.CLOUDINARY_CLOUD_NAME);
    if (!hasS3 && hasCloudinary) {
      return new CloudinaryStorageProvider();
    }
    return new S3StorageProvider();
  }

  return new LocalDiskStorageProvider();
}
