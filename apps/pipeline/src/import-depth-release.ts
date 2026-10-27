import path from "node:path";
import { buildImportedDepthRelease } from "./imported-depth-release";
import { activateSemanticRelease } from "./semantic-release";

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const position = args.indexOf(name), value = args[position + 1];
    if (position < 0 || !value || value.startsWith("--")) throw new TypeError(`Missing ${name}`);
    return value;
  };
  const rootDir = args.includes("--root") ? path.resolve(flag("--root")) : path.resolve(__dirname, "../../..");
  const result = await buildImportedDepthRelease({ rootDir, baseVersion: flag("--base"), version: flag("--version"),
    inputDir: path.resolve(flag("--input")), modelId: flag("--model"), expectedCount: Number(flag("--expected-count")),
    excludedArtworkIds: args.includes("--exclude") ? flag("--exclude").split(",") : undefined });
  const directory = args.includes("--activate") ? activateSemanticRelease(result.directory, path.join(rootDir, "data/releases")) : result.directory;
  console.log(JSON.stringify({ directory, imported: result.report.importedCount, retained: result.report.retainedCount, retainedIds: result.report.retainedIds,
    excludedArtworkIds: result.report.excludedArtworkIds, artworkCount: result.report.artworkCount }, null, 2));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
