import path from "node:path";
import { buildRepairedRelease, repairExistingCorpus } from "./existing-corpus-repair";

async function main() {
  const rootDir = path.resolve(process.cwd());
  const result = await repairExistingCorpus({ rootDir, baseVersion: "2026-10-06-paintings", version: "2026-10-13-quality",
    fetchExisting: process.argv.includes("--fetch-existing") });
  const output = buildRepairedRelease(result, path.join(rootDir, "data/curation/preview"));
  console.log(JSON.stringify({ output, ...result.report.counts }, null, 2));
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
