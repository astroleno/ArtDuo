/** Deployment paths are public configuration, shared by rendering and native URLs. */
export function normalizeAppBasePath(value = ""): string {
  if (value === "" || value === "/") return "";
  const normalized = value.replace(/\/+$/u, "");
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u.test(normalized)) throw new TypeError("Invalid ArtDuo base path");
  return normalized;
}

export function publicBasePath(): string {
  return normalizeAppBasePath(process.env.NEXT_PUBLIC_ARTDUO_BASE_PATH ?? "");
}

/** Use for native href/fetch/media URLs. Next's router and redirect add their own prefix. */
export function appPath(value: string, basePath?: string): string;
export function appPath(value: undefined, basePath?: string): undefined;
export function appPath(value: string | undefined, basePath?: string): string | undefined;
export function appPath(value: string | undefined, basePath = publicBasePath()): string | undefined {
  if (value === undefined) return undefined;
  const prefix = normalizeAppBasePath(basePath);
  if (!prefix || !value.startsWith("/") || value.startsWith("//")) return value;
  const boundary = value.search(/[?#]/u), pathname = boundary < 0 ? value : value.slice(0, boundary);
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return value;
  return prefix + (pathname === "/" ? "" : pathname) + (boundary < 0 ? "" : value.slice(boundary));
}

/** Convert an app URL back to the domain-neutral path expected by Next navigation. */
export function stripAppBasePath(value: string, basePath = publicBasePath()): string {
  const prefix = normalizeAppBasePath(basePath);
  const boundary = value.search(/[?#]/u), pathname = boundary < 0 ? value : value.slice(0, boundary);
  if (!prefix || pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return value;
  return (pathname.slice(prefix.length) || "/") + (boundary < 0 ? "" : value.slice(boundary));
}
