const GOOGLE_API_KEY_REGEX = /\bAIza[0-9A-Za-z-_]{30,45}\b/g;
const KEY_PARAM_REGEX = /([?&]key=)[^&\s]+/gi;

/**
 * Redacts API keys and sensitive tokens from text strings.
 */
export function redactSensitiveText(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let redacted = text;

  // Redact active GEMINI_API_KEY if present in environment
  const activeKey = process.env.GEMINI_API_KEY;
  if (activeKey && activeKey.trim().length > 0) {
    redacted = redacted.split(activeKey).join("[REDACTED]");
  }

  // Redact standard Google AI Studio / Gemini API key shape (AIza...)
  redacted = redacted.replace(GOOGLE_API_KEY_REGEX, "[REDACTED]");

  // Redact URL query parameter ?key=... or &key=...
  redacted = redacted.replace(KEY_PARAM_REGEX, "$1[REDACTED]");

  return redacted;
}

/**
 * Checks whether an object key name represents sensitive information.
 */
function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === "gemini_api_key" ||
    lower === "geminiapikey" ||
    lower === "apikey" ||
    lower === "api_key" ||
    lower === "secret" ||
    lower === "password" ||
    lower === "token" ||
    lower === "refreshtoken" ||
    lower === "accesstoken" ||
    lower.endsWith("secret") ||
    lower.endsWith("apikey")
  );
}

/**
 * Recursively redacts sensitive keys and values from objects, arrays, and errors.
 */
export function redactSensitiveObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return redactSensitiveText(obj) as unknown as T;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveObject(item)) as unknown as T;
  }

  if (obj instanceof Error) {
    const errorCopy: Record<string, unknown> = {
      name: obj.name,
      message: redactSensitiveText(obj.message),
    };
    if (obj.stack) {
      errorCopy.stack = redactSensitiveText(obj.stack);
    }
    for (const [key, val] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        errorCopy[key] = "[REDACTED]";
      } else {
        errorCopy[key] = redactSensitiveObject(val);
      }
    }
    return errorCopy as unknown as T;
  }

  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(record)) {
      if (isSensitiveKey(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveObject(val);
      }
    }

    return result as unknown as T;
  }

  return obj;
}
