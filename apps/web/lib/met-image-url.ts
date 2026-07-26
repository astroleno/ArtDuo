export function metImageVariantUrl(url: string, variant: "preview" | "full"): string {
  if (!url.includes("images.metmuseum.org/CRDImages/")) {
    return url;
  }

  if (variant === "preview") {
    return url
      .replace("/original/", "/web-large/")
      .replace("/mobile-large/", "/web-large/");
  }

  return url
    .replace("/web-large/", "/original/")
    .replace("/mobile-large/", "/original/");
}
