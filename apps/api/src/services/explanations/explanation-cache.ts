import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseArtworkExplanation, type ArtworkExplanationContent } from "@artduo/contracts";
import { runtimeDirectories } from "../../runtime/environment";

export interface ExplanationCacheKeyInput {
  releaseVersion: string;
  artworkId: string;
  contextText: string;
}

export function buildExplanationCacheKey(input: ExplanationCacheKeyInput): string {
  const contextHash = createHash("sha256").update(input.contextText.trim()).digest("hex").slice(0, 16);
  return `${input.releaseVersion}:${input.artworkId}:${contextHash}`;
}

export class InMemoryExplanationCache {
  private readonly cache = new Map<string, ArtworkExplanationContent>();

  get(key: string): ArtworkExplanationContent | undefined {
    return this.cache.get(key);
  }

  set(key: string, content: ArtworkExplanationContent): ArtworkExplanationContent {
    this.cache.set(key, content);
    return content;
  }
}

/** Only validated ready content survives a process restart. */
export class PersistentExplanationCache extends InMemoryExplanationCache {
  constructor(private readonly rootDir: string, private readonly namespace: string, private readonly validate: (content: ArtworkExplanationContent) => void) { super(); }
  private filename(key: string) {
    return path.join(runtimeDirectories(this.rootDir).state, "explanations", `${createHash("sha256").update(`${this.namespace}:${key}`).digest("hex")}.json`);
  }
  override get(key: string): ArtworkExplanationContent | undefined {
    try {
      const text = readFileSync(this.filename(key), "utf8");
      if (text.length > 80_000) return undefined;
      const stored = JSON.parse(text);
      if (stored.schemaVersion !== 1 || stored.namespace !== this.namespace || stored.key !== key) return undefined;
      const content = stored.content;
      const response = parseArtworkExplanation({ artworkId: content.evidence.grounding.artwork.id, releaseVersion: content.evidence.grounding.releaseVersion,
        status: "ready", content, cacheKey: key, updatedAt: content.generatedAt });
      this.validate(response.content!);
      return response.content;
    } catch { return undefined; }
  }
  override set(key: string, content: ArtworkExplanationContent): ArtworkExplanationContent {
    this.validate(content);
    const file = this.filename(key), temporary = `${file}.${randomUUID()}.tmp`;
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, namespace: this.namespace, key, content }), { flag: "wx", mode: 0o600 });
      renameSync(temporary, file);
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
    return content;
  }
}
