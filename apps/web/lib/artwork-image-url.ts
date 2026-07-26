export function artworkImageUrl(id: string, variant: "preview" | "full" = "preview"): string {
  const params = variant === "full" ? "?variant=full" : "";

  return `/artduo-artwork/${encodeURIComponent(id)}${params}`;
}
