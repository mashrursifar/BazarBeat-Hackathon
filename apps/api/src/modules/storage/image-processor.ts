import crypto from "node:crypto";
import sharp from "sharp";
import { AppError } from "../../shared/errors.js";

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp";
  hash: string;
}

/**
 * Validates magic bytes for JPEG, PNG, and WebP.
 * Rejects wrong types even if file extension was spoofed.
 */
export function validateImageMagicBytes(buffer: Buffer): "jpeg" | "png" | "webp" {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("binary") === "RIFF" &&
    buffer.subarray(8, 12).toString("binary") === "WEBP"
  ) {
    return "webp";
  }
  throw new AppError(400, "VALIDATION_ERROR", "Only JPEG, PNG, and WebP images are allowed");
}

/**
 * Validates, re-encodes, resizes, and strips EXIF from an image buffer using sharp.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // First verify magic bytes
  validateImageMagicBytes(buffer);

  try {
    const pipeline = sharp(buffer, { failOn: "error" });
    const metadata = await pipeline.metadata();

    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
      throw new AppError(400, "VALIDATION_ERROR", "Unsupported image format");
    }

    // Resize within 1600x1600 without enlarging
    pipeline.resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    });

    // Re-encode according to format and strip EXIF (sharp omits metadata by default unless withMetadata is called)
    if (metadata.format === "jpeg") {
      pipeline.jpeg({ quality: 85 });
    } else if (metadata.format === "png") {
      pipeline.png({ compressionLevel: 8 });
    } else if (metadata.format === "webp") {
      pipeline.webp({ quality: 85 });
    }

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const hash = crypto.createHash("sha256").update(data).digest("hex");

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      format: metadata.format as "jpeg" | "png" | "webp",
      hash,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "VALIDATION_ERROR", "Image could not be decoded or is corrupted");
  }
}
