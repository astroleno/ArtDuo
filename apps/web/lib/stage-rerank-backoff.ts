import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, opendirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const STAGE_RERANK_BACKOFF_MS = 5 * 60_000;
export interface StageRerankBackoff {
  schemaVersion: 1;
  curationId: string;
  invalidCount: 1 | 2;
  expiresAt: number;
}

const HEX_ID = /^[a-f0-9]{64}$/u;
const lastPruned = new Map<string, number>();
const locations = (curations: string, key: string) => {
  const directory = path.join(curations, "rerank-backoff");
  return { directory, file: path.join(directory, `${key}.json`) };
};

function forget(file: string) {
  try { rmSync(file, { force: true }); } catch { /* A damaged hint must not block selection. */ }
}

export function readStageRerankBackoff(curations: string, key: string, now: number): StageRerankBackoff | undefined {
  const { directory, file } = locations(curations, key);
  try {
    if (!lstatSync(directory).isDirectory()) return undefined;
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > 1024) return undefined;
    const row = JSON.parse(readFileSync(file, "utf8")) as Partial<StageRerankBackoff>;
    if (row.schemaVersion === 1 && typeof row.curationId === "string" && HEX_ID.test(row.curationId)
      && (row.invalidCount === 1 || row.invalidCount === 2) && Number.isSafeInteger(row.expiresAt)
      && row.expiresAt! > now && row.expiresAt! <= now + STAGE_RERANK_BACKOFF_MS) return row as StageRerankBackoff;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
  }
  forget(file);
  return undefined;
}

export function forgetStageRerankBackoff(curations: string, key: string) {
  const { directory, file } = locations(curations, key);
  try { if (lstatSync(directory).isDirectory()) forget(file); } catch { /* Missing or unavailable hint directory. */ }
}

function prune(directory: string, now: number) {
  if (now - (lastPruned.get(directory) ?? -Infinity) < 60_000) return;
  lastPruned.set(directory, now);
  const entries = opendirSync(directory);
  try {
    for (let i = 0; i < 128; i++) {
      const entry = entries.readSync();
      if (!entry) break;
      if (!entry.isFile() || !/^[a-f0-9]{64}\.json(?:\.[a-f0-9-]{36}\.tmp)?$/u.test(entry.name)) continue;
      const file = path.join(directory, entry.name);
      // mtime is just an inexpensive age check; every read also validates expiry.
      if (now - statSync(file).mtimeMs > STAGE_RERANK_BACKOFF_MS * 2) forget(file);
    }
  } finally { entries.closeSync(); }
}

export function rememberStageRerankBackoff(curations: string, key: string, curationId: string, now: number, previous?: StageRerankBackoff) {
  const { directory, file } = locations(curations, key);
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!lstatSync(directory).isDirectory()) return;
    const active = previous && previous.expiresAt > now ? previous : undefined;
    const row: StageRerankBackoff = { schemaVersion: 1, curationId, invalidCount: active ? 2 : 1,
      expiresAt: active?.expiresAt ?? now + STAGE_RERANK_BACKOFF_MS };
    writeFileSync(temp, JSON.stringify(row), { flag: "wx", mode: 0o600 });
    renameSync(temp, file);
    prune(directory, now);
  } catch {
    forget(temp);
  }
}
