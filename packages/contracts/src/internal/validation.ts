export type JsonObject = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new TypeError(`${path}: ${message}`);
}

export function expectObject(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected object");
  }

  return value as JsonObject;
}

export function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, "expected array");
  }

  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "expected non-empty string");
  }

  return value;
}

export function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    fail(path, "expected number");
  }

  return value;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    fail(path, "expected boolean");
  }

  return value;
}

export function parseArray<T>(
  value: unknown,
  itemParser: (entry: unknown, path: string) => T,
  path: string,
): T[] {
  return expectArray(value, path).map((entry, index) => itemParser(entry, `${path}[${index}]`));
}

export function readObject(source: JsonObject, key: string, path: string): JsonObject {
  return expectObject(source[key], `${path}.${key}`);
}

export function readOptionalObject(source: JsonObject, key: string, path: string): JsonObject | undefined {
  const value = source[key];
  return value === undefined ? undefined : expectObject(value, `${path}.${key}`);
}

export function readString(source: JsonObject, key: string, path: string): string {
  return expectString(source[key], `${path}.${key}`);
}

export function readOptionalString(source: JsonObject, key: string, path: string): string | undefined {
  const value = source[key];
  return value === undefined ? undefined : expectString(value, `${path}.${key}`);
}

export function readNumber(source: JsonObject, key: string, path: string): number {
  return expectNumber(source[key], `${path}.${key}`);
}

export function readOptionalNumber(source: JsonObject, key: string, path: string): number | undefined {
  const value = source[key];
  return value === undefined ? undefined : expectNumber(value, `${path}.${key}`);
}

export function readBoolean(source: JsonObject, key: string, path: string): boolean {
  return expectBoolean(source[key], `${path}.${key}`);
}

export function readOptionalBoolean(source: JsonObject, key: string, path: string): boolean | undefined {
  const value = source[key];
  return value === undefined ? undefined : expectBoolean(value, `${path}.${key}`);
}

export function readStringArray(source: JsonObject, key: string, path: string): string[] {
  return expectArray(source[key], `${path}.${key}`).map((entry, index) =>
    expectString(entry, `${path}.${key}[${index}]`),
  );
}

export function readOptionalStringArray(source: JsonObject, key: string, path: string): string[] | undefined {
  const value = source[key];
  return value === undefined
    ? undefined
    : expectArray(value, `${path}.${key}`).map((entry, index) =>
        expectString(entry, `${path}.${key}[${index}]`),
      );
}

export function readLiteral<T extends readonly string[]>(
  source: JsonObject,
  key: string,
  allowed: T,
  path: string,
): T[number] {
  const value = readString(source, key, path);

  if (!allowed.includes(value as T[number])) {
    fail(`${path}.${key}`, `expected one of ${allowed.join(", ")}`);
  }

  return value as T[number];
}

export function readOptionalLiteral<T extends readonly string[]>(
  source: JsonObject,
  key: string,
  allowed: T,
  path: string,
): T[number] | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }

  const parsed = expectString(value, `${path}.${key}`);
  if (!allowed.includes(parsed as T[number])) {
    fail(`${path}.${key}`, `expected one of ${allowed.join(", ")}`);
  }

  return parsed as T[number];
}
