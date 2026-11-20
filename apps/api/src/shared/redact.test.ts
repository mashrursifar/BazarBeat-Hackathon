import { describe, expect, it, vi } from "vitest";

import { redactSensitiveObject, redactSensitiveText } from "./redact.js";
import { AppError } from "./errors.js";
import { errorMiddleware } from "./error-middleware.js";

describe("sensitive data redaction", () => {
  it("redacts Google AI Studio style API keys from text", () => {
    const raw = "Error: Invalid API key AIzaSyD1234567890abcdefghijklmnopqrstuvw received from upstream";
    const redacted = redactSensitiveText(raw);
    expect(redacted).not.toContain("AIzaSyD1234567890abcdefghijklmnopqrstuvw");
    expect(redacted).toBe("Error: Invalid API key [REDACTED] received from upstream");
  });

  it("redacts ?key= and &key= query parameter values from URL text", () => {
    const url = "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSySecret1234567890123456789012345&alt=json";
    const redacted = redactSensitiveText(url);
    expect(redacted).not.toContain("AIzaSySecret1234567890123456789012345");
    expect(redacted).toContain("?key=[REDACTED]");
  });

  it("redacts active process.env.GEMINI_API_KEY when set", () => {
    const prevKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = "custom-test-secret-key-99999";
      const message = "Failed request using key custom-test-secret-key-99999 in transport";
      const redacted = redactSensitiveText(message);
      expect(redacted).not.toContain("custom-test-secret-key-99999");
      expect(redacted).toBe("Failed request using key [REDACTED] in transport");
    } finally {
      process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it("recursively redacts sensitive keys from objects and error instances", () => {
    const sensitiveObj = {
      geminiApiKey: "AIzaSyD1234567890abcdefghijklmnopqrstuvw",
      nested: {
        apiKey: "super-secret-nested-key",
        normal: "regular-value",
        details: [
          { token: "jwt-token-123", note: "contains AIzaSyD1234567890abcdefghijklmnopqrstuvw" },
        ],
      },
    };

    const redacted = redactSensitiveObject(sensitiveObj);
    expect(redacted.geminiApiKey).toBe("[REDACTED]");
    expect(redacted.nested.apiKey).toBe("[REDACTED]");
    expect(redacted.nested.normal).toBe("regular-value");
    const firstDetail = redacted.nested.details[0];
    expect(firstDetail).toBeDefined();
    if (firstDetail) {
      expect(firstDetail.token).toBe("[REDACTED]");
      expect(firstDetail.note).toBe("contains [REDACTED]");
    }
  });

  it("strictly redacts API keys in errorMiddleware responses", () => {
    const error = new AppError(
      500,
      "AI_UPSTREAM_ERROR",
      "Google Gemini rejected key AIzaSyD1234567890abcdefghijklmnopqrstuvw",
      {
        geminiApiKey: "AIzaSyD1234567890abcdefghijklmnopqrstuvw",
        cause: "Invalid key: AIzaSyD1234567890abcdefghijklmnopqrstuvw",
      },
    );

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = {
      headersSent: false,
      status: statusMock,
    } as unknown as Parameters<typeof errorMiddleware>[2];
    const req = {} as unknown as Parameters<typeof errorMiddleware>[1];
    const next = vi.fn() as unknown as Parameters<typeof errorMiddleware>[3];

    errorMiddleware(error, req, res, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledOnce();
    const firstCall = jsonMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall) {
      const payload = firstCall[0] as {
        error: { code: string; message: string; details: { geminiApiKey: string; cause: string } };
      };
      expect(payload.error.code).toBe("AI_UPSTREAM_ERROR");
      expect(payload.error.message).not.toContain("AIzaSyD1234567890abcdefghijklmnopqrstuvw");
      expect(payload.error.message).toContain("[REDACTED]");
      expect(payload.error.details.geminiApiKey).toBe("[REDACTED]");
      expect(payload.error.details.cause).toBe("Invalid key: [REDACTED]");
    }
  });
});
