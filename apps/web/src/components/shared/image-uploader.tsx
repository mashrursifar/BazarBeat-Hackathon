import { type ChangeEvent, type ReactElement, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { compressImage } from "../../lib/image-compression.js";
import { cn } from "../../lib/utils.js";

export interface ImageUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function ImageUploader({
  files,
  onChange,
  maxFiles = 4,
  disabled = false,
  error,
  className,
}: ImageUploaderProps): ReactElement {
  const { t } = useTranslation();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Generate and manage preview URLs
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return (): void => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleFilesAdded = async (newFileList: FileList | null): Promise<void> => {
    if (!newFileList || newFileList.length === 0) return;
    setLocalError(null);

    const incomingFiles = Array.from(newFileList);
    const validTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const invalidFile = incomingFiles.find((f) => !validTypes.has(f.type));

    if (invalidFile) {
      setLocalError(t("imageUploader.typeError", "Only JPEG, PNG, and WebP images are supported."));
      return;
    }

    const availableSlots = maxFiles - files.length;
    if (availableSlots <= 0) {
      setLocalError(
        t("imageUploader.limitError", `You can upload up to {{max}} photos.`, { max: maxFiles }),
      );
      return;
    }

    const filesToProcess = incomingFiles.slice(0, availableSlots);
    setIsProcessing(true);

    try {
      const compressedFiles = await Promise.all(
        filesToProcess.map((file) => compressImage(file, 1600, 0.82)),
      );
      onChange([...files, ...compressedFiles]);
    } catch {
      // If compression fails, pass original files
      onChange([...files, ...filesToProcess]);
    } finally {
      setIsProcessing(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemove = (indexToRemove: number): void => {
    setLocalError(null);
    onChange(files.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRetakeAll = (): void => {
    setLocalError(null);
    onChange([]);
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const displayError = error || localError;

  return (
    <div data-testid="image-uploader" className={cn("space-y-4", className)}>
      {/* Hidden file inputs */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        data-testid="uploader-gallery-input"
        disabled={disabled || isProcessing || files.length >= maxFiles}
        onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFilesAdded(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        data-testid="uploader-camera-input"
        disabled={disabled || isProcessing || files.length >= maxFiles}
        onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFilesAdded(e.target.files)}
      />

      {/* Action buttons (Camera / Gallery / Retake) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="uploader-camera-button"
            disabled={disabled || isProcessing || files.length >= maxFiles}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{t("imageUploader.camera", "Take photo")}</span>
          </button>

          <button
            type="button"
            data-testid="uploader-gallery-button"
            disabled={disabled || isProcessing || files.length >= maxFiles}
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <svg
              className="h-5 w-5 text-stone-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{t("imageUploader.gallery", "Choose files")}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            data-testid="uploader-count"
            className="text-xs font-semibold text-muted-foreground select-none"
          >
            {files.length} / {maxFiles} {t("imageUploader.photos", "photos")}
          </span>

          {files.length > 0 && (
            <button
              type="button"
              data-testid="uploader-retake-all"
              onClick={handleRetakeAll}
              disabled={disabled || isProcessing}
              className="min-h-[44px] text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 p-1"
            >
              {t("imageUploader.retakeAll", "Retake all")}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {displayError && (
        <div
          role="alert"
          data-testid="uploader-error"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800"
        >
          {displayError}
        </div>
      )}

      {/* Previews Grid */}
      {files.length > 0 && (
        <div
          data-testid="uploader-preview-grid"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              data-testid={`preview-item-${idx}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm"
            >
              {previewUrls[idx] ? (
                <img
                  src={previewUrls[idx]}
                  alt={`Crop photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  Photo {idx + 1}
                </div>
              )}

              {/* Photo badge number */}
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                #{idx + 1}
              </span>

              {/* Remove button */}
              <button
                type="button"
                data-testid={`uploader-remove-${idx}`}
                onClick={() => handleRemove(idx)}
                disabled={disabled}
                aria-label={`Remove photo ${idx + 1}`}
                className="absolute top-1.5 right-1.5 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-red-600/90 text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add more placeholder tile */}
          {files.length < maxFiles && (
            <button
              type="button"
              data-testid="uploader-add-more"
              disabled={disabled || isProcessing}
              onClick={() => galleryInputRef.current?.click()}
              className="flex min-h-[100px] aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-2 text-stone-500 transition hover:border-primary hover:bg-stone-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="mt-1 text-xs font-semibold">
                {t("imageUploader.addMore", "Add more")}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Empty dropzone state */}
      {files.length === 0 && (
        <div
          data-testid="uploader-empty-dropzone"
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-6 text-center transition hover:border-primary/50 hover:bg-stone-100/60 cursor-pointer"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {t("imageUploader.dragOrClick", "Upload 1 to 4 clear photos")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("imageUploader.formats", "JPEG, PNG, or WebP up to 5 MB each")}
          </p>
        </div>
      )}
    </div>
  );
}
