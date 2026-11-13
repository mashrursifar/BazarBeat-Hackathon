import { promises as fs } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import type { StorageProvider } from "./storage-provider.interface.js";

/**
 * Stores files on the local filesystem under `env.UPLOAD_DIR`.
 * Filenames are random UUIDs with sanitized extension.
 * Returns a URL like `/uploads/<filename>` which can be served via static middleware.
 */
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly baseDir: string;
  private readonly publicPath: string;

  constructor() {
    this.baseDir = env.UPLOAD_DIR;
    this.publicPath = "/uploads";
  }

  async store(buffer: Buffer, originalName: string): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true });
    let ext = extname(originalName).toLowerCase();
    if (!ext && originalName.length > 0 && !originalName.includes(".")) {
      ext = `.${originalName.toLowerCase()}`;
    }
    const filename = `${randomUUID()}${ext || ".jpg"}`;
    const filePath = join(this.baseDir, filename);
    await fs.writeFile(filePath, buffer);
    return `${this.publicPath}/${filename}`;
  }
}
