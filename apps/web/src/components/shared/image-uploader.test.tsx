import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import "../../lib/i18n.js";
import { ImageUploader } from "./image-uploader.js";

// Mock URL.createObjectURL and revokeObjectURL in JSDOM
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn((file: File) => `blob://test-url/${file.name}`);
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("ImageUploader component", () => {
  const createMockFile = (name: string, type: string): File => {
    return new File(["test-content"], name, { type, lastModified: Date.now() });
  };

  it("renders the empty dropzone when no files are selected", () => {
    render(<ImageUploader files={[]} onChange={vi.fn()} />);

    expect(screen.getByTestId("uploader-empty-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("uploader-count")).toHaveTextContent("0 / 4 photos");
    expect(screen.queryByTestId("uploader-retake-all")).not.toBeInTheDocument();
  });

  it("triggers camera and gallery inputs with proper accept and capture attributes", () => {
    render(<ImageUploader files={[]} onChange={vi.fn()} />);

    const galleryInput = screen.getByTestId("uploader-gallery-input") as HTMLInputElement;
    const cameraInput = screen.getByTestId("uploader-camera-input") as HTMLInputElement;

    expect(galleryInput.accept).toBe("image/jpeg,image/png,image/webp");
    expect(cameraInput.accept).toBe("image/jpeg,image/png,image/webp");
    expect(cameraInput.getAttribute("capture")).toBe("environment");

    const galleryClickSpy = vi.spyOn(galleryInput, "click");
    const cameraClickSpy = vi.spyOn(cameraInput, "click");

    fireEvent.click(screen.getByTestId("uploader-gallery-button"));
    expect(galleryClickSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("uploader-camera-button"));
    expect(cameraClickSpy).toHaveBeenCalled();
  });

  it("adds files and renders previews with remove buttons", async () => {
    const onChange = vi.fn();
    const file1 = createMockFile("crop1.jpg", "image/jpeg");
    const file2 = createMockFile("crop2.png", "image/png");

    const { rerender } = render(<ImageUploader files={[]} onChange={onChange} />);

    const galleryInput = screen.getByTestId("uploader-gallery-input");
    fireEvent.change(galleryInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([expect.any(File), expect.any(File)]);
    });

    // Re-render with files present
    rerender(<ImageUploader files={[file1, file2]} onChange={onChange} />);

    expect(screen.getByTestId("uploader-count")).toHaveTextContent("2 / 4 photos");
    expect(screen.getByTestId("preview-item-0")).toBeInTheDocument();
    expect(screen.getByTestId("preview-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("uploader-retake-all")).toBeInTheDocument();

    // Remove photo 1
    fireEvent.click(screen.getByTestId("uploader-remove-0"));
    expect(onChange).toHaveBeenCalledWith([file2]);

    // Retake all photos
    fireEvent.click(screen.getByTestId("uploader-retake-all"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("rejects unsupported file formats and displays an alert", async () => {
    const onChange = vi.fn();
    const invalidFile = createMockFile("document.pdf", "application/pdf");

    render(<ImageUploader files={[]} onChange={onChange} />);

    const galleryInput = screen.getByTestId("uploader-gallery-input");
    fireEvent.change(galleryInput, { target: { files: [invalidFile] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only JPEG, PNG, and WebP images are supported.",
    );
  });

  it("enforces maximum file limit of 4 photos", async () => {
    const onChange = vi.fn();
    const f1 = createMockFile("1.jpg", "image/jpeg");
    const f2 = createMockFile("2.jpg", "image/jpeg");
    const f3 = createMockFile("3.jpg", "image/jpeg");
    const f4 = createMockFile("4.jpg", "image/jpeg");
    const f5 = createMockFile("5.jpg", "image/jpeg");

    render(<ImageUploader files={[f1, f2, f3, f4]} onChange={onChange} />);

    expect(screen.getByTestId("uploader-count")).toHaveTextContent("4 / 4 photos");
    expect(screen.queryByTestId("uploader-add-more")).not.toBeInTheDocument();

    // Attempt to add a 5th file
    const galleryInput = screen.getByTestId("uploader-gallery-input");
    fireEvent.change(galleryInput, { target: { files: [f5] } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
