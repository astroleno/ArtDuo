import path from "node:path";
import { activateSemanticRelease, buildSemanticRelease } from "./semantic-release";

async function main() {
  const args = process.argv.slice(2);
  const read = (flag: string) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
  const rootDir = path.resolve(read("--root") ?? "../..");
  const baseVersion = read("--base");
  const version = read("--version");
  if (!baseVersion || !version) throw new Error("Specify --base and a new --version");
  const result = await buildSemanticRelease({ rootDir, baseVersion, version, onProgress: (completed, total) => console.log(`Encoded ${completed}/${total} artwork records`) });
  const directory = args.includes("--activate") ? activateSemanticRelease(result.directory, path.join(rootDir, "data", "releases")) : result.directory;
  console.log(JSON.stringify({ directory, records: result.index.records.length, model: result.index.model }));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
