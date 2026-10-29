import type { ExhibitionSnapshot, NarrativeBlock } from "./types";

export const PRESENTED_PREFACE_KEY = "artduo.presented-preface.v1";
const MAX_ENTRIES = 20, MAX_TEXT = 4000, MAX_RECORD = 120_000;
type StoragePort = Pick<Storage, "getItem" | "setItem">;
type Entry = { identity: string; block: NarrativeBlock };

export function prefaceIdentity(snapshot: Pick<ExhibitionSnapshot, "releaseVersion" | "recipeVersion" | "curationId" | "exhibitionId">): string {
  return JSON.stringify([snapshot.releaseVersion, snapshot.recipeVersion, snapshot.curationId ?? snapshot.exhibitionId]);
}

function validBlock(value: unknown): value is NarrativeBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Partial<NarrativeBlock>;
  return typeof block.text === "string" && Boolean(block.text.trim()) && block.text.length <= MAX_TEXT
    && (block.source === "grounded" || block.source === "fallback");
}

/** One bounded, tab-local record. Stored prose never drives selection or jobs. */
export function createPresentedPrefaceStore() {
  const entries = new Map<string, NarrativeBlock>();
  function retain(identity: string, block: NarrativeBlock) {
    entries.delete(identity);
    entries.set(identity, { text: block.text, source: block.source });
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  }
  function restore(identity: string, storage?: StoragePort): NarrativeBlock | undefined {
    if (entries.has(identity)) return entries.get(identity);
    try {
      const raw = storage?.getItem(PRESENTED_PREFACE_KEY);
      if (!raw || raw.length > MAX_RECORD) return;
      const saved = JSON.parse(raw) as { schemaVersion?: unknown; entries?: unknown };
      if (saved?.schemaVersion !== 1 || !Array.isArray(saved.entries) || saved.entries.length > MAX_ENTRIES) return;
      for (const entry of saved.entries as Partial<Entry>[]) {
        if (entry && typeof entry.identity === "string" && entry.identity.length <= 1000 && validBlock(entry.block)
          && !entries.has(entry.identity)) retain(entry.identity, entry.block);
      }
      return entries.get(identity);
    } catch { return; }
  }
  return {
    restore,
    present(identity: string, block: NarrativeBlock, storage?: StoragePort): NarrativeBlock {
      const existing = restore(identity, storage);
      if (existing) return existing;
      retain(identity, block);
      try { storage?.setItem(PRESENTED_PREFACE_KEY, JSON.stringify({ schemaVersion: 1,
        entries: [...entries].map(([key, value]) => ({ identity: key, block: value })),
      })); } catch { /* Current-document reading stays consistent without storage. */ }
      return entries.get(identity)!;
    },
  };
}

export function readyPreface(block: NarrativeBlock, pending: boolean, deadline: number, now: number): NarrativeBlock | null {
  return !pending || block.source === "grounded" || now >= deadline ? block : null;
}
