// Run from Node with Ego Browser installed and a local production server using
// an empty, dedicated ARTDUO_STATE_DIR and no configured chat provider:
// node apps/web/scripts/experience-wait-probe.mjs --url=http://127.0.0.1:4159/ArtDuo \
//   --state-dir=/path/to/synthetic-state --cache-state=prepared-local-media \
//   --output=/tmp/artduo-local-wait.json
// Optional --space-name reuses an exact agent-owned task space for this probe.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METRICS = ["submitToPrefaceMs", "enterToFirstPaintingMs", "submitToFirstPaintingMs"];

export function summarizeWaitSamples(results) {
  return ["fresh-rules", "saved"].map(mode => {
    const group = results.filter(sample => sample.mode === mode);
    return {
      mode, n: group.length, succeeded: group.filter(sample => sample.status === "ok").length,
      failed: group.filter(sample => sample.status === "failed").length,
      notRun: group.filter(sample => sample.status === "not-run").length,
      metrics: Object.fromEntries(METRICS.map(name => {
        const applicable = mode === "fresh-rules" || name === "enterToFirstPaintingMs";
        const samples = group.filter(sample => sample.status === "ok" && Number.isFinite(sample[name]) && sample[name] >= 0)
          .map(sample => sample[name]).sort((a, b) => a - b);
        const middle = Math.floor(samples.length / 2);
        return [name, { applicable, n: applicable ? samples.length : 0, missing: applicable ? group.length - samples.length : 0,
          medianMs: applicable && samples.length ? samples.length % 2 ? samples[middle] : (samples[middle - 1] + samples[middle]) / 2 : null }];
      })),
    };
  });
}

export function probeOptions(args) {
  const get = (name) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const url = new URL(get("url") ?? "http://127.0.0.1:4159/ArtDuo");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error("Use an HTTP loopback origin for the synthetic probe");
  }
  const stateDir = get("state-dir"), output = get("output"), cacheState = get("cache-state");
  if (!stateDir || !output || !cacheState?.trim()) throw new Error("Provide --state-dir, --cache-state and --output");
  return { url: url.href.replace(/\/+$/u, ""), stateDir: path.resolve(stateDir), output: path.resolve(output), cacheState,
    spaceName: get("space-name")?.trim() || undefined };
}

function main() {
  const options = probeOptions(process.argv.slice(2));
  const curations = path.join(options.stateDir, "curations");
  if (!existsSync(options.stateDir) || existsSync(curations) && readdirSync(curations).length > 0) {
    throw new Error("The server must use an existing dedicated synthetic state directory with no saved curations");
  }
  if (existsSync(options.output)) throw new Error("Choose a new output path");
  const session = `artduo-wait-${randomUUID()}`;
  const prefix = `const job = ${JSON.stringify({ ...options, session })};\nconst summarizeWaitSamples = ${summarizeWaitSamples.toString()};\nconst METRICS = ${JSON.stringify(METRICS)};\n`;
  const source = readFileSync(new URL("./experience-wait-ego.mjs", import.meta.url), "utf8");
  const result = spawnSync("ego-browser", ["nodejs", "--session", session, "--timeout-ms", "550000"], { input: prefix + source, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error("Synthetic browser probe stopped before writing its report");
  const report = JSON.parse(readFileSync(options.output, "utf8"));
  if (report.results.some(row => row.status !== "ok")) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
