import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveEmbeddingRuntime } from "./embedding-runtime";

test("embedding runtime resolves local-hash by default", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-runtime-local-"));
  const resolved = resolveEmbeddingRuntime({ rootDir });

  assert.equal(resolved.requestedProviderMode, "local-hash");
  assert.equal(resolved.summary.configuredProviderMode, "local-hash");
  assert.equal(resolved.summary.model, "local-hash-embedding-v1");
});

test("embedding runtime reads remote provider settings from .env", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-runtime-remote-"));

  writeFileSync(path.join(rootDir, ".env"), [
    "EMBEDDING_PROVIDER=remote-openai-compatible",
    "EMBEDDING_BASE_URL=https://example.com/v1/embeddings",
    "EMBEDDING_MODEL=text-embedding-3-large",
    "OPENAI_API_KEY=test-key",
  ].join("\n"));

  const resolved = resolveEmbeddingRuntime({ rootDir });

  assert.equal(resolved.requestedProviderMode, "remote-openai-compatible");
  assert.equal(resolved.summary.configuredProviderMode, "remote-openai-compatible");
  assert.equal(resolved.summary.endpoint, "https://example.com/v1/embeddings");
  assert.equal(resolved.summary.model, "text-embedding-3-large");
});

test("embedding runtime falls back to local-hash when remote config is incomplete", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-runtime-fallback-"));

  writeFileSync(path.join(rootDir, ".env"), [
    "EMBEDDING_PROVIDER=remote",
    "EMBEDDING_MODEL=text-embedding-3-large",
  ].join("\n"));

  const resolved = resolveEmbeddingRuntime({ rootDir });

  assert.equal(resolved.requestedProviderMode, "remote-openai-compatible");
  assert.equal(resolved.summary.configuredProviderMode, "local-hash");
  assert.equal(resolved.summary.model, "local-hash-embedding-v1");
  assert.equal(resolved.summary.fallbackEnabled, true);
});

test("embedding runtime can default release builds to strict remote mode", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-runtime-release-"));

  writeFileSync(path.join(rootDir, ".env"), [
    "EMBEDDING_BASE_URL=https://example.com/v1/embeddings",
    "EMBEDDING_MODEL=text-embedding-3-large",
    "OPENAI_API_KEY=test-key",
  ].join("\n"));

  const resolved = resolveEmbeddingRuntime({
    rootDir,
    defaultProviderMode: "remote-openai-compatible",
    defaultAllowFallback: false,
  });

  assert.equal(resolved.requestedProviderMode, "remote-openai-compatible");
  assert.equal(resolved.summary.configuredProviderMode, "remote-openai-compatible");
  assert.equal(resolved.summary.fallbackEnabled, false);
});

test("embedding runtime rejects incomplete strict remote release config", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-runtime-strict-fail-"));

  writeFileSync(path.join(rootDir, ".env"), [
    "EMBEDDING_MODEL=text-embedding-3-large",
  ].join("\n"));

  assert.throws(() => resolveEmbeddingRuntime({
    rootDir,
    defaultProviderMode: "remote-openai-compatible",
    defaultAllowFallback: false,
  }), /missing endpoint, model, or API key/);
});
