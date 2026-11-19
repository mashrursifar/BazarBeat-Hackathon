import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { env } from "../../config/env.js";
import type { StorageProvider } from "./storage-provider.interface.js";

export interface S3Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region?: string;
  publicUrl?: string;
  forcePathStyle?: boolean;
}

/**
 * Parses S3 configuration from environment variables or a provided raw config dictionary.
 */
export function parseS3Config(raw: {
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_REGION?: string;
  S3_PUBLIC_URL?: string;
  S3_FORCE_PATH_STYLE?: boolean | string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_S3_BUCKET?: string;
  AWS_S3_ENDPOINT?: string;
}): S3Config {
  const bucket = raw.S3_BUCKET || raw.AWS_S3_BUCKET;
  const accessKeyId = raw.S3_ACCESS_KEY_ID || raw.AWS_ACCESS_KEY_ID;
  const secretAccessKey = raw.S3_SECRET_ACCESS_KEY || raw.AWS_SECRET_ACCESS_KEY;
  const endpoint = raw.S3_ENDPOINT || raw.AWS_S3_ENDPOINT;
  const region = raw.S3_REGION || raw.AWS_REGION || "auto";
  const publicUrl = raw.S3_PUBLIC_URL;
  const forcePathStyle =
    typeof raw.S3_FORCE_PATH_STYLE === "boolean"
      ? raw.S3_FORCE_PATH_STYLE
      : raw.S3_FORCE_PATH_STYLE === "true" || raw.S3_FORCE_PATH_STYLE === "1";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new AppError(
      500,
      "CONFIG_ERROR",
      "S3 storage configuration is incomplete. S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required.",
    );
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint && endpoint.trim().length > 0 ? endpoint.trim() : undefined,
    region: region && region.trim().length > 0 ? region.trim() : "auto",
    publicUrl: publicUrl && publicUrl.trim().length > 0 ? publicUrl.trim().replace(/\/+$/, "") : undefined,
    forcePathStyle,
  };
}

/**
 * S3-compatible cloud storage provider.
 * Works with any S3-compatible service (Cloudflare R2, AWS S3, Backblaze B2, MinIO, etc.).
 * Stores processed image buffers and returns publicly accessible CDN / object URLs.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly config: S3Config;
  private readonly client: S3Client;

  constructor(config?: S3Config, client?: S3Client) {
    this.config = config ?? parseS3Config(env as unknown as Record<string, string | undefined>);
    this.client =
      client ??
      new S3Client({
        region: this.config.region || "auto",
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: this.config.forcePathStyle,
      });
  }

  /**
   * Returns the parsed configuration (excluding secret credentials for safety).
   */
  getSafeConfig(): Omit<S3Config, "accessKeyId" | "secretAccessKey"> {
    return {
      bucket: this.config.bucket,
      endpoint: this.config.endpoint,
      region: this.config.region,
      publicUrl: this.config.publicUrl,
      forcePathStyle: this.config.forcePathStyle,
    };
  }

  async store(buffer: Buffer, originalName: string): Promise<string> {
    let ext = extname(originalName).toLowerCase();
    if (!ext && originalName.length > 0) {
      if (["jpg", "jpeg", "png", "webp"].includes(originalName.toLowerCase())) {
        ext = `.${originalName.toLowerCase()}`;
      } else {
        ext = ".jpg";
      }
    }
    const safeExt = ext || ".jpg";
    const filename = `${randomUUID()}${safeExt}`;
    const key = `crops/${filename}`;

    const mimeType =
      safeExt === ".png"
        ? "image/png"
        : safeExt === ".webp"
          ? "image/webp"
          : "image/jpeg";

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      // 1. If public base URL is explicitly provided (recommended for R2 / custom CDN)
      if (this.config.publicUrl) {
        return `${this.config.publicUrl}/${key}`;
      }

      // 2. If a custom endpoint is provided (e.g. MinIO, LocalStack, or R2 endpoint)
      if (this.config.endpoint) {
        const cleanEndpoint = this.config.endpoint.replace(/\/+$/, "");
        if (this.config.forcePathStyle) {
          return `${cleanEndpoint}/${this.config.bucket}/${key}`;
        }
        try {
          const parsed = new URL(cleanEndpoint);
          return `${parsed.protocol}//${this.config.bucket}.${parsed.host}/${key}`;
        } catch {
          return `${cleanEndpoint}/${this.config.bucket}/${key}`;
        }
      }

      // 3. Fallback to standard AWS S3 bucket URL
      const region = this.config.region && this.config.region !== "auto" ? this.config.region : "us-east-1";
      return `https://${this.config.bucket}.s3.${region}.amazonaws.com/${key}`;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "Unknown cloud storage error";
      // Ensure credentials are never logged or exposed
      logger.error(
        { bucket: this.config.bucket, key, error: message },
        "S3 cloud storage image upload failed",
      );
      throw new AppError(502, "STORAGE_ERROR", `Failed to upload image to cloud storage: ${message}`);
    }
  }
}
