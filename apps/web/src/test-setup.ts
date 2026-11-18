import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  // Mock element dimensions in jsdom for responsive chart rendering without warnings
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (): DOMRect {
    const rect = originalGetBoundingClientRect.call(this);
    if (rect.width === 0 && rect.height === 0) {
      return {
        width: 400,
        height: 260,
        top: 0,
        left: 0,
        bottom: 260,
        right: 400,
        x: 0,
        y: 0,
        toJSON: (): Record<string, unknown> => ({}),
      };
    }
    return rect;
  };

  window.ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback(
        [
          {
            target,
            contentRect: {
              width: 400,
              height: 260,
              top: 0,
              left: 0,
              bottom: 260,
              right: 400,
              x: 0,
              y: 0,
              toJSON: (): Record<string, unknown> => ({}),
            },
          } as unknown as ResizeObserverEntry,
        ],
        this,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  };
}

afterEach(() => {
  cleanup();
});
