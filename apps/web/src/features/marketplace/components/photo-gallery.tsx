import { type ReactElement, useState } from "react";

import { cn } from "../../../lib/utils.js";

export interface GalleryImage {
  url: string;
  width?: number;
  height?: number;
}

export interface PhotoGalleryProps {
  images: GalleryImage[];
  cropName: string;
  className?: string;
}

export function PhotoGallery({
  images,
  cropName,
  className,
}: PhotoGalleryProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const fallbackImage: GalleryImage = { url: "/images/placeholder-crop.jpg" };
  const safeImages = images.length > 0 ? images : [fallbackImage];
  const currentImage: GalleryImage = safeImages[selectedIndex] ?? safeImages[0] ?? fallbackImage;

  return (
    <div data-testid="photo-gallery" className={cn("flex flex-col gap-3", className)}>
      {/* Main Preview Image */}
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-xs">
        <img
          data-testid="main-photo"
          src={currentImage.url}
          alt={`${cropName} photo ${selectedIndex + 1}`}
          className="h-full w-full object-cover object-center transition-all duration-300"
          loading="eager"
        />
        {safeImages.length > 1 && (
          <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-xs">
            {selectedIndex + 1} / {safeImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {safeImages.length > 1 && (
        <div
          data-testid="thumbnail-strip"
          className="flex items-center gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Produce photos"
        >
          {safeImages.map((image, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${image.url}-${index}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`View photo ${index + 1}`}
                data-testid={`thumbnail-${index}`}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % safeImages.length);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
                  }
                }}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isSelected
                    ? "border-primary ring-2 ring-primary/40 shadow-sm"
                    : "border-stone-200 opacity-70 hover:opacity-100",
                )}
              >
                <img
                  src={image.url}
                  alt={`${cropName} thumbnail ${index + 1}`}
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
