import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createFallbackEmbeddingProvider,
  createLocalHashEmbeddingProvider,
  createRemoteOpenAICompatibleEmbeddingProvider,
  type TextEmbeddingProvider,
} from "./embedding-provider";

test("local hash embedding provider returns deterministic vectors", async () => {
  const provider = createLocalHashEmbeddingProvider();
  const first = await provider.embedText("enigmatic oracle shadowed hall");
  const second = await provider.embedText("enigmatic oracle shadowed hall");

  assert.equal(first.provider, "local-hash");
  assert.equal(first.model, "local-hash-embedding-v1");
  assert.deepEqual(first.vector, second.vector);
  assert.ok(first.tokens.includes("mystery"));
});

test("remote openai-compatible embedding provider parses batch responses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        model: "text-embedding-3-large",
        data: [
          { index: 0, embedding: [0.1, 0.2, 0.3] },
          { index: 1, embedding: [0.3, 0.2, 0.1] },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    const provider = createRemoteOpenAICompatibleEmbeddingProvider({
      endpoint: "https://example.com/v1/embeddings",
      model: "text-embedding-3-large",
      apiKey: "test-key",
    });
    const results = await provider.embedTexts(["quiet reflection", "warm hope"]);

    assert.equal(results.length, 2);
    assert.equal(results[0]?.provider, "remote-openai-compatible");
    assert.equal(results[0]?.model, "text-embedding-3-large");
    assert.equal(results[0]?.dimensions, 3);
    assert.deepEqual(results[1]?.vector, [0.3, 0.2, 0.1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fallback embedding provider falls back to local hash when remote fails", async () => {
  const failingProvider: TextEmbeddingProvider = {
    mode: "remote-openai-compatible",
    model: "broken-remote",
    async embedText(): Promise<never> {
      throw new Error("remote unavailable");
    },
    async embedTexts(): Promise<never> {
      throw new Error("remote unavailable");
    },
  };
  const provider = createFallbackEmbeddingProvider(failingProvider, createLocalHashEmbeddingProvider());
  const result = await provider.embedText("tranquil stillness quiet reflection");

  assert.equal(result.provider, "local-hash");
  assert.equal(result.model, "local-hash-embedding-v1");
  assert.equal(result.dimensions, 256);
});
