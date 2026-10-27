import path from "node:path";
import { buildVerifiedPartialRelease } from "./verified-partial-import";

const args = process.argv.slice(2);
const argument = (name: string, fallback?: string) => {
  const index = args.indexOf(name);
  const result = index < 0 ? fallback : args[index + 1];
  if (!result || result.startsWith("--")) throw new TypeError(`Missing ${name}`);
  return result;
};
void buildVerifiedPartialRelease({
  rootDir: path.resolve(__dirname, "../../.."), snapshotCsv: path.resolve(argument("--snapshot")),
  intakePath: argument("--intake", "data/curation/verified-import/2026-10-21/intake.json"),
  baseVersion: argument("--base", "2026-10-15-experience"), version: argument("--version", "2026-10-21-verified-partial"),
  activate: args.includes("--activate"),
}).then(result => console.log(JSON.stringify({ admitted: result.report.admittedCount, held: result.report.heldCount,
  activated: result.activated, directory: result.directory })))
  .catch(error => { console.error(error); process.exitCode = 1; });
