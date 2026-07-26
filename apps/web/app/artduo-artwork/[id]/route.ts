import { NextResponse } from "next/server";

import { metImageVariantUrl } from "../../../lib/met-image-url";
import { loadWebReleaseCatalog } from "../../../lib/release-catalog";

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
  const catalog = loadWebReleaseCatalog();
  const artwork = catalog.artworkById.get(id);

  if (!artwork) {
    return new NextResponse("Not found", { status: 404 });
  }

  const variant = new URL(request.url).searchParams.get("variant") === "full" ? "full" : "preview";
  const releaseImageUrl = variant === "full"
    ? artwork.imageUrlFull ?? artwork.imageUrl
    : artwork.imageUrl;
  const sourceUrl = metImageVariantUrl(releaseImageUrl, variant);
  const meta = [artwork.artistDisplayName, artwork.yearLabel].filter(Boolean).join(", ");

  try {
    const image = await fetchImageWithTimeout(sourceUrl);
    const headers = new Headers({
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": image.contentType,
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
      },
    });
  }
}
