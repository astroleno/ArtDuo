import { createHash } from "node:crypto";

import type { ArtworkExplanationContent } from "@artduo/contracts";

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
