/**
 * Simple storage abstraction used by the upload pipeline.
 * Implementations must store the given buffer and return a public URL that can be accessed
 * via the API's static-serve middleware.
 */
export interface StorageProvider {
  /**
   * Store a buffer and return a URL that can be publicly fetched.
   * @param buffer file content
   * @param originalName original filename or extension
   * @returns public URL (relative to the API base, e.g. `/uploads/abcd.jpg`)
   */
  store(buffer: Buffer, originalName: string): Promise<string>;
}
