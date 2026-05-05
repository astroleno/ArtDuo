import { readFile } from "node:fs/promises";
import nodePath from "node:path";

import { NextResponse } from "next/server";

const GALLERY_ASSET_ROOT = nodePath.resolve(process.cwd(), "../../public/artduo-gallery");

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function resolveAssetPath(segments: string[]): string | undefined {
  if (segments.length === 0 || segments.some((segment) => segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return undefined;
  }

  const resolvedPath = nodePath.resolve(GALLERY_ASSET_ROOT, ...segments);
  if (!resolvedPath.startsWith(`${GALLERY_ASSET_ROOT}${nodePath.sep}`)) {
    return undefined;
  }

  return resolvedPath;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const assetPath = resolveAssetPath(path);
  if (!assetPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const body = await readFile(assetPath);
    const contentType = CONTENT_TYPES[nodePath.extname(assetPath).toLowerCase()] ?? "application/octet-stream";

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
