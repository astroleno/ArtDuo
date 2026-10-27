/** Both variants preserve the photographed room's complete projection. */
export const ROOM_IMAGE_SIZES = "(max-width: 767px) 960px, 1600px";

export function roomImageSrcSet(url?: string, smallUrl?: string): string | undefined {
  if (!url) return undefined;
  const small = smallUrl ?? (url.startsWith("/") && !url.startsWith("//") && url.endsWith("-1600.webp") ? url.replace(/-1600\.webp$/u, "-960.webp") : undefined);
  return small ? `${small} 960w, ${url} 1600w` : undefined;
}

export function roomImageCandidate(url: string, viewportWidth: number, pixelRatio = 1, smallUrl?: string): string {
  return viewportWidth <= 767 && pixelRatio <= 1 && roomImageSrcSet(url, smallUrl)
    ? smallUrl ?? url.replace(/-1600\.webp$/u, "-960.webp") : url;
}
