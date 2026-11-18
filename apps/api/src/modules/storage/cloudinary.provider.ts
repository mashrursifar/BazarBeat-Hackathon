import crypto from "node:crypto";
import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { env } from "../../config/env.js";
import type { StorageProvider } from "./storage-provider.interface.js";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Parses Cloudinary configuration from either a `cloudinary://` URL or discrete environment variables.
 */
export function parseCloudinaryConfig(raw: {
  CLOUDINARY_URL?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}): CloudinaryConfig {
  if (raw.CLOUDINARY_URL) {
    try {
      const parsed = new URL(raw.CLOUDINARY_URL);
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);
      const cloudName = parsed.hostname;
      if (apiKey && apiSecret && cloudName) {
        return { apiKey, apiSecret, cloudName };
      }
    } catch {
      // Invalid URL format, fall through to check individual vars
    }
  }

  if (raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET) {
    return {
      cloudName: raw.CLOUDINARY_CLOUD_NAME,
      apiKey: raw.CLOUDINARY_API_KEY,
      apiSecret: raw.CLOUDINARY_API_SECRET,
    };
  }

  throw new AppError(
    500,
    "CONFIG_ERROR",
    "Cloudinary configuration is missing. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
  );
}

/**
 * Cloudinary storage adapter utilizing direct Cloudinary REST API.
 * Uploads processed image buffer securely and returns the CDN HTTPS URL.
 */
export class CloudinaryStorageProvider implements StorageProvider {
  private readonly config: CloudinaryConfig;
  private readonly folder: string;

  constructor(config?: CloudinaryConfig, folder = "bazarbeat/crops") {
    this.config = config ?? parseCloudinaryConfig(env);
    this.folder = folder;
  }

  async store(buffer: Buffer, originalName: string): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Cloudinary signature signs sorted parameters concatenated with apiSecret:
    // folder=...&timestamp=...<apiSecret>
    const toSign = `folder=${this.folder}&timestamp=${timestamp}${this.config.apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const formData = new FormData();
    const ext = originalName.includes(".") ? originalName.split(".").pop()?.toLowerCase() : "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });

    formData.append("file", blob, originalName || "image.jpg");
    formData.append("folder", this.folder);
    formData.append("timestamp", timestamp);
    formData.append("api_key", this.config.apiKey);
    formData.append("signature", signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, "Cloudinary image upload failed");
        throw new AppError(502, "STORAGE_ERROR", `Cloudinary upload failed: ${errorText}`);
      }

      const data = (await response.json()) as { secure_url?: string };
      if (!data.secure_url) {
        throw new AppError(502, "STORAGE_ERROR", "Cloudinary response missing secure_url");
      }

      return data.secure_url;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error }, "Network error during Cloudinary upload");
      throw new AppError(502, "STORAGE_ERROR", `Cloudinary network error: ${message}`);
    }
  }
}
