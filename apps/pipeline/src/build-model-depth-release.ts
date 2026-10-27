import path from "node:path";
import { buildModelDepthRelease } from "./model-depth-release";
import { activateSemanticRelease } from "./semantic-release";

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args[args.indexOf(name) + 1];
  if (!args.includes("--base") || !args.includes("--version")) throw new TypeError("Provide --base and --version; --activate is optional");
  const rootDir = path.resolve(args.includes("--root") ? flag("--root") : path.join(__dirname, "../../.."));
  const result = await buildModelDepthRelease({ rootDir, baseVersion: flag("--base"), version: flag("--version"), resume: args.includes("--resume"),
    onProgress: (done, total, id) => console.log(`${done}/${total} ${id}`) });
  if (args.includes("--activate")) console.log(activateSemanticRelease(result.directory, path.join(rootDir, "data/releases")));
  console.log(JSON.stringify({ directory: result.directory, depthMaps: result.report.length }));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
