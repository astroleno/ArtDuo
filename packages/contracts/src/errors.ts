import { expectObject, parseArray, readBoolean, readOptionalObject, readString } from "./internal/validation";

export interface ApiError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export function parseApiError(value: unknown, path = "ApiError"): ApiError {
  const error = expectObject(value, path);

  return {
    code: readString(error, "code", path),
    message: readString(error, "message", path),
    retryable: error.retryable === undefined ? undefined : readBoolean(error, "retryable", path),
    details: readOptionalObject(error, "details", path),
  };
}

export function parseApiErrors(value: unknown, path = "ApiError[]"): ApiError[] {
  return parseArray(value, (entry, entryPath) => parseApiError(entry, entryPath), path);
}
