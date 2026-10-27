import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** Explicit origins only; never derive a public origin from forwarding headers. */
export function publicOrigins(environment: Record<string, string | undefined>): string[] {
  const configured = [environment.ARTDUO_PUBLIC_ORIGIN ?? "", ...(environment.ARTDUO_PUBLIC_ORIGINS?.split(",") ?? [])];
  if (configured.length > 8) throw new TypeError("Too many public origins");
  return [...new Set(configured.map(value => {
    const origin = new URL(value.trim());
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new TypeError("Public mode requires HTTPS origins");
    return origin.origin;
  }))];
}

export function readProjectModelEnvironment(rootDir: string, environment: NodeJS.ProcessEnv = process.env): Record<string, string | undefined> {
  const config: Record<string, string | undefined> = {};
  for (const filename of [".env", ".env.local"]) {
    const file = path.join(rootDir, filename);
    if (existsSync(file)) Object.assign(config, parseEnv(readFileSync(file, "utf8")));
  }
  for (const [key, value] of Object.entries(environment)) if (value !== undefined) config[key] = value;
  return config;
}

export function projectRootFromCwd(): string {
  return process.cwd().endsWith(path.join("apps", "web")) ? path.resolve(process.cwd(), "../..") : process.cwd();
}

export function runtimeDirectories(rootDir: string, environment = readProjectModelEnvironment(rootDir)) {
  const configured = environment.ARTDUO_STATE_DIR?.trim();
  if (configured && !path.isAbsolute(configured)) throw new TypeError("ARTDUO_STATE_DIR must be absolute");
  if (environment.ARTDUO_PUBLIC_MODE === "1" && !configured) throw new TypeError("Public mode requires a persistent ARTDUO_STATE_DIR");
  const state = path.resolve(configured ?? path.join(rootDir, ".cache", "artduo-runtime"));
  // Resolve the closest existing parent as well, so a symlink cannot put
  // private query/usage records in a directory served as static files.
  function canonical(filename: string): string {
    if (existsSync(filename)) return realpathSync(filename);
    const parent = path.dirname(filename);
    return parent === filename ? filename : path.join(canonical(parent), path.basename(filename));
  }
  for (const served of [path.join(rootDir, "public"), path.join(rootDir, "apps/web/public")]) {
    const relative = path.relative(canonical(served), canonical(state));
    if (!relative || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new TypeError("Runtime state must be outside public assets");
  }
  return { state, curations: configured ? path.join(state, "curations") : path.join(rootDir, ".cache", "artduo-curations"), configured: Boolean(configured) };
}
