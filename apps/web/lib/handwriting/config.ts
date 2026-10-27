import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeAppBasePath } from "@artduo/contracts";
import { readProjectModelEnvironment, runtimeDirectories } from "../../../api/src/runtime/environment";

export const HANDWRITING_RENDER_VERSION = "scene-alpha-v2";
export const HANDWRITING_INK = "#e7ddcd";
export function handwritingConfig(root: string) {
  const env = readProjectModelEnvironment(root);
  const localKey = path.join(root, ".inko/key");
  const key = env.INKO_API_KEY?.trim() || (existsSync(localKey) ? readFileSync(localKey, "utf8").trim() : "");
  const base = new URL(env.INKO_API_BASE || "https://api.inkotype.com/v1");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new TypeError("Invalid Inko API base");
  const state = path.join(runtimeDirectories(root, env).state, "handwriting");
  const coordination = env.INKO_COORDINATION_DIR || path.join(state, "coordination");
  if (!path.isAbsolute(coordination)) throw new TypeError("INKO_COORDINATION_DIR must be absolute");
  return { key, base: base.href.replace(/\/$/u, ""), state, coordination,
    basePath: normalizeAppBasePath(env.ARTDUO_BASE_PATH ?? env.NEXT_PUBLIC_ARTDUO_BASE_PATH ?? ""),
    styles: env.INKO_STYLE_CODES?.split(",").map(s => s.trim()).filter(Boolean),
    publicMode: env.ARTDUO_PUBLIC_MODE === "1" };
}

export class HandwritingError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly retryAfter = 3) { super(message); }
}
