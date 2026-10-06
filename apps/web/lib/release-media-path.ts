import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export function resolveReleaseAssetPath(releaseDir: string, relativeUrl: string): string | undefined {
  const normalizedUrl = relativeUrl.replaceAll("\\", "/");
  const segments = normalizedUrl.split("/");
  if (
    normalizedUrl.trim() === "" ||
    normalizedUrl.startsWith("/") ||
    normalizedUrl.includes(":") ||
    normalizedUrl.includes("?") ||
    normalizedUrl.includes("#") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return undefined;
  }

  const releaseRoot = path.resolve(releaseDir);
  const resolvedPath = path.resolve(releaseRoot, ...segments);
  const relativePath = path.relative(releaseRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !existsSync(resolvedPath)) {
    return undefined;
  }

  try {
    if (!lstatSync(resolvedPath).isFile()) {
      return undefined;
    }

    const releaseRootRealPath = realpathSync(releaseRoot);
    const assetRealPath = realpathSync(resolvedPath);
    const realRelativePath = path.relative(releaseRootRealPath, assetRealPath);
    if (realRelativePath.startsWith("..") || path.isAbsolute(realRelativePath)) {
      return undefined;
    }

    return assetRealPath;
  } catch {
    return undefined;
  }
}
