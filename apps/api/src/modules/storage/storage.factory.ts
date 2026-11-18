import { env } from "../../config/env.js";
import type { StorageProvider } from "./storage-provider.interface.js";
import { LocalDiskStorageProvider } from "./local-disk.provider.js";
import { CloudinaryStorageProvider } from "./cloudinary.provider.js";

/**
 * Creates the appropriate StorageProvider based on environment configuration.
 * When STORAGE_PROVIDER is 'cloud' or CLOUDINARY_URL is configured, Cloudinary is used.
 * Defaults to LocalDiskStorageProvider for local development and offline test suites.
 */
export function createStorageProvider(): StorageProvider {
  if (
    env.STORAGE_PROVIDER === "cloud" ||
    Boolean(env.CLOUDINARY_URL) ||
    Boolean(env.CLOUDINARY_CLOUD_NAME)
  ) {
    return new CloudinaryStorageProvider();
  }
  return new LocalDiskStorageProvider();
}
