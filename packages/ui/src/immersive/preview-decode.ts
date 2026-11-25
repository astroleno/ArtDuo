export async function decodePreview(
  image: Pick<HTMLImageElement, "currentSrc" | "decode" | "naturalWidth" | "naturalHeight">,
  source: string,
  isCurrent: () => boolean,
) {
  try {
    await image.decode();
    if (!isCurrent() || image.currentSrc !== source) return { state: "stale" } as const;
    if (image.naturalWidth && image.naturalHeight) {
      return { state: "ready", width: image.naturalWidth, height: image.naturalHeight } as const;
    }
  } catch {
    if (!isCurrent() || image.currentSrc && image.currentSrc !== source) return { state: "stale" } as const;
  }
  return { state: "error" } as const;
}
