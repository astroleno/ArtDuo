export type ArtworkImageVariant = "preview" | "full" | "depth";

export function artworkImageUrl(
  id: string,
  variant: ArtworkImageVariant = "preview",
  releaseVersion?: string,
): string {
  const params = new URLSearchParams();
  if (variant !== "preview") {
    params.set("variant", variant);
  }
  if (releaseVersion) {
    params.set("releaseVersion", releaseVersion);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";

  return `/artduo-artwork/${encodeURIComponent(id)}${query}`;
}
