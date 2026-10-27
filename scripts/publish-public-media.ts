import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePublicMediaManifest } from "../apps/web/lib/public-media-manifest";
import { uploadPublicMediaObject, verifyPublicMediaAssets, type PublicMediaVerification } from "../apps/web/lib/public-media-publish";

async function main() {
  const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
  const manifestFile = arg("--manifest"), origin = arg("--origin"), output = arg("--receipts");
  if (!manifestFile || !origin || !output) throw new TypeError("--manifest, --origin and --receipts are required");
  const manifest = parsePublicMediaManifest(JSON.parse(await readFile(manifestFile, "utf8")));
  const grantsFile = arg("--upload-grants");
  if (grantsFile) {
    if ((await stat(grantsFile)).mode & 0o077) throw new TypeError("Upload grants must be a private file");
    const sources = JSON.parse(await readFile(`${manifestFile}.upload.json`, "utf8")) as Array<{ objectKey: string; file: string }>;
    const grants = JSON.parse(await readFile(grantsFile, "utf8")) as Record<string, string>;
    const sourceByKey = new Map(sources.map(source => [source.objectKey, source]));
    for (const asset of manifest.assets) {
      const grant = grants[asset.objectKey];
      if (!grant) continue; // Grant only missing keys; completed objects are verified below.
      const source = sourceByKey.get(asset.objectKey);
      if (!source) throw new TypeError("Upload source missing from the approved manifest");
      await uploadPublicMediaObject(asset, source.file, grant);
    }
  }
  let previous: PublicMediaVerification | undefined;
  try { previous = JSON.parse(await readFile(output, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  let reported = previous?.verified.length ?? 0;
  const result = await verifyPublicMediaAssets(manifest, origin, { previous, bytesPerSecond: Number(arg("--bytes-per-second") ?? 450000),
    maximumBytes: Number(arg("--max-bytes") ?? 1_000_000_000), maximumRequests: 1500,
    progress: async result => {
      await writeFile(`${output}.tmp`, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
      await rename(`${output}.tmp`, output);
      if (result.verified.length - reported >= 50) { reported = result.verified.length; console.log(JSON.stringify({ verified: reported, total: manifest.assets.length, transferredBytes: result.transferredBytes })); }
    } });
  console.log(JSON.stringify({ passed: result.verified.length === manifest.assets.length, verified: result.verified.length, requests: result.requests, transferredBytes: result.transferredBytes, manifestSha256: result.manifestSha256 }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
