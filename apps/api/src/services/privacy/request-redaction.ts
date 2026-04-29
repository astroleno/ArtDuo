const REDACTED_USER_TEXT = "[REDACTED_USER_TEXT]";

export function redactUserText(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((entry) => redactUserText(entry));
  }

  if (!input || typeof input !== "object") {
    return input;
  }

  const source = input as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "userText") {
      redacted[key] = REDACTED_USER_TEXT;
    } else {
      redacted[key] = redactUserText(value);
    }
  }

  return redacted;
}
