import { appPath } from "@artduo/contracts";
import { publicArtworkMediaUrl } from "./public-media";

export type ArtworkImageVariant = "preview" | "full" | "depth";

export function artworkImageUrl(
  id: string,
  variant: ArtworkImageVariant = "preview",
  releaseVersion?: string,
): string {
  const params = new URLSearchParams();
  if (variant !== "preview") {
    params.set("variant", variant);
  } else {
    params.set("previewVersion", "1");
  }
  if (releaseVersion) {
    params.set("releaseVersion", releaseVersion);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const local = appPath(`/artduo-artwork/${encodeURIComponent(id)}${query}`);
  return variant === "full" ? local : publicArtworkMediaUrl(id, variant, local, releaseVersion);
}
