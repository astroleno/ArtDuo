import { estimateDepthMapAsset } from "./depth-map";

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const required = ["--input", "--output", "--url", "--release-version", "--source-asset-fingerprint"] as const;
  const values = required.map(readOption);
  const missing = required.filter((_, index) => !values[index]);
  if (missing.length > 0) {
    throw new Error(`Missing required options: ${missing.join(", ")}`);
  }
  const [inputImagePath, outputDepthMapPath, url, version, sourceAssetFingerprint] = values as [string, string, string, string, string];
  const result = await estimateDepthMapAsset({ inputImagePath, outputDepthMapPath, url, version, sourceAssetFingerprint });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
