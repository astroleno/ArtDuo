import sharp from "sharp";

export async function inspectPublicMediaImage(body: Buffer, contentType: string): Promise<{ width: number; height: number }> {
  const image = sharp(body, { limitInputPixels: 20_000_000, failOn: "error" });
  const metadata = await image.metadata();
  if (`image/${metadata.format}` !== contentType || !metadata.width || !metadata.height) throw new TypeError("Public media MIME mismatch");
  await image.stats();
  return { width: metadata.width, height: metadata.height };
}
