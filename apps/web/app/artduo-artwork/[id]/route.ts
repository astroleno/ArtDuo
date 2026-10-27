import { readFileSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { readVerifiedPublicImage } from "@artduo/corpus/src/public-image-cache";

import { metImageVariantUrl } from "../../../lib/met-image-url";
import { resolveReleaseAssetPath } from "../../../lib/release-media-path";
import { loadWebReleaseCatalog } from "../../../lib/release-catalog";
import { prepareArtworkPreview } from "../../../lib/artwork-preview";

const IMAGE_HEADER_TIMEOUT_MS = 12000;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function fallbackSvg(title: string, meta: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f7f1e7"/>
      <stop offset="0.54" stop-color="#ded5c6"/>
      <stop offset="1" stop-color="#bfb3a2"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.12"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="1200" height="900" fill="url(#paper)"/>
  <rect x="56" y="56" width="1088" height="788" fill="none" stroke="#8f2f23" stroke-opacity="0.18" stroke-width="2"/>
  <rect width="1200" height="900" filter="url(#grain)" opacity="0.35"/>
  <text x="92" y="680" fill="#2c2620" font-family="Georgia, serif" font-size="54" font-weight="700">${escapeXml(title.slice(0, 42))}</text>
  <text x="94" y="738" fill="#6f6458" font-family="Arial, sans-serif" font-size="28">${escapeXml(meta.slice(0, 72))}</text>
</svg>`;
}

async function fetchImageWithTimeout(url: string): Promise<{
  body: BodyInit;
  contentType: string;
  contentLength?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_HEADER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; ArtDuo/1.0; +https://artduo.local)",
      },
    });
    if (!response.ok) {
      throw new Error(`Artwork image fetch failed: ${response.status}`);
    }

    clearTimeout(timeout);

    return {
      body: response.body ?? await response.arrayBuffer(),
      contentLength: response.headers.get("content-length") ?? undefined,
      contentType: response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requestUrl = new URL(request.url);
  const requestedReleaseVersion = requestUrl.searchParams.get("releaseVersion") ?? undefined;
  let catalog;

  try {
    catalog = loadWebReleaseCatalog({ releaseVersion: requestedReleaseVersion });
  } catch {
    return new NextResponse("Release version is not available", { status: requestedReleaseVersion ? 404 : 503 });
  }

  const artwork = catalog.artworkById.get(id);
  const artworkRecord = catalog.artworkRecordById.get(id);

  if (!artwork || !artworkRecord) {
    return new NextResponse("Not found", { status: 404 });
  }

  const requestedVariant = requestUrl.searchParams.get("variant");
  const variant = requestedVariant === "full" ? "full" : requestedVariant === "depth" ? "depth" : "preview";

  if (variant === "depth") {
    const depthMap = artworkRecord.media.depthMap;
    if (!depthMap || depthMap.version !== catalog.releaseVersion || depthMap.sourceAssetFingerprint !== artworkRecord.media.sourceAssetFingerprint) {
      return new NextResponse("Depth map is not available for this release", { status: 404 });
    }

    const depthMapPath = resolveReleaseAssetPath(catalog.releaseDir, depthMap.url);
    if (!depthMapPath) {
      return new NextResponse("Depth map is not available for this release", { status: 404 });
    }

    const body = readFileSync(depthMapPath);
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/png",
        "X-ArtDuo-Release-Version": catalog.releaseVersion,
      },
    });
  }

  const releaseImageUrl = variant === "full"
    ? artwork.imageUrlFull ?? artwork.imageUrl
    : artwork.imageUrl;
  const remote = artworkRecord.media.verifiedRemoteImage;
  const root = path.resolve(catalog.releaseDir, "../../..");
  if (variant === "preview" && artworkRecord.media.sourceAssetFingerprint?.startsWith("sha256:")) {
    try {
      if (remote && (releaseImageUrl !== remote.url || remote.sha256 !== artworkRecord.media.sourceAssetFingerprint)) throw new Error("Source mismatch");
      const preview = await prepareArtworkPreview(root, artworkRecord.media.sourceAssetFingerprint, async () => {
        if (remote) return readVerifiedPublicImage(root, remote);
        const imagePath = resolveReleaseAssetPath(catalog.releaseDir, releaseImageUrl);
        if (!imagePath) throw new Error("Preview source is not available locally");
        return readFileSync(imagePath);
      });
      return new NextResponse(new Uint8Array(preview.body), { headers: {
        "Content-Type": "image/webp", "Content-Length": String(preview.bytes),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-ArtDuo-Release-Version": catalog.releaseVersion, "X-ArtDuo-Image-Sha256": preview.sha256,
        "X-ArtDuo-Source-Sha256": preview.sourceFingerprint, "X-ArtDuo-Preview-Recipe": preview.recipe,
      } });
    } catch { return new NextResponse("Artwork preview is temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } }); }
  }
  if (remote) {
    try {
      if (releaseImageUrl !== remote.url || remote.sha256 !== artworkRecord.media.sourceAssetFingerprint) throw new Error("Source mismatch");
      const body = await readVerifiedPublicImage(path.resolve(catalog.releaseDir, "../../.."), remote);
      return new NextResponse(new Uint8Array(body), { headers: {
        "Content-Type": remote.contentType, "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-ArtDuo-Release-Version": catalog.releaseVersion, "X-ArtDuo-Image-Sha256": remote.sha256,
      } });
    } catch {
      return new NextResponse("Artwork image is temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (!/^https?:\/\//i.test(releaseImageUrl)) {
    const imagePath = resolveReleaseAssetPath(catalog.releaseDir, releaseImageUrl);
    const contentTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
    const contentType = imagePath && contentTypes[path.extname(imagePath).toLowerCase()];
    if (!imagePath || !contentType) return new NextResponse("Artwork image is unavailable", { status: 404 });
    return new NextResponse(readFileSync(imagePath), { headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
      "X-ArtDuo-Release-Version": catalog.releaseVersion,
    } });
  }
  const sourceUrl = metImageVariantUrl(releaseImageUrl, variant);
  const meta = [artwork.artistDisplayName, artwork.yearLabel].filter(Boolean).join(", ");

  try {
    const image = await fetchImageWithTimeout(sourceUrl);
    const headers = new Headers({
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": image.contentType,
      "X-ArtDuo-Release-Version": catalog.releaseVersion,
    });

    if (image.contentLength) {
      headers.set("Content-Length", image.contentLength);
    }

    return new NextResponse(image.body, {
      headers,
    });
  } catch {
    return new NextResponse(fallbackSvg(artwork.title, meta), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "X-ArtDuo-Release-Version": catalog.releaseVersion,
      },
    });
  }
}
