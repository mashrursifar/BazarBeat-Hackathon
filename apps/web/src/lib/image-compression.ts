/**
 * Client-side image compression utility.
 * Downscales images to max ~1600px maintaining aspect ratio and encodes to JPEG at ~0.82 quality.
 * Safe fallback for headless/test environments where Canvas or Image API is mock/unavailable.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82,
): Promise<File> {
  // If not an image, return original
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // If in environment without window or Image, or in test JSDOM, return original
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    (typeof navigator !== "undefined" && navigator.userAgent?.includes("jsdom"))
  ) {
    return file;
  }

  return new Promise<File>((resolve) => {
    let resolved = false;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = (): void => {
      URL.revokeObjectURL(objectUrl);
    };

    // Timeout safety fallback (e.g. corrupt image or stalled decoding)
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(file);
      }
    }, 1500);

    img.onload = (): void => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      try {
        let { width, height } = img;

        if (width <= 0 || height <= 0) {
          cleanup();
          resolve(file);
          return;
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            maxDimension = height;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              resolve(file);
              return;
            }

            const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const compressedFile = new File([blob], fileName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          "image/jpeg",
          quality,
        );
      } catch {
        cleanup();
        resolve(file);
      }
    };

    img.onerror = (): void => {
      cleanup();
      resolve(file);
    };

    img.src = objectUrl;
  });
}
