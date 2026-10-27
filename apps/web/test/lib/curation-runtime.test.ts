import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LOCAL_SEMANTIC_MODEL } from "@artduo/corpus/src/semantic-index";
import type { SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { prepareCurationRuntime } from "../../lib/semantic-curator";

function fixture(warmup: () => Promise<void>): SemanticEncoder {
  return { model: LOCAL_SEMANTIC_MODEL, warmup, embedQueries: async () => [], embedDocuments: async () => [], dispose: async () => {} };
}

test("startup and concurrent callers share one model preparation per project", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-startup-"));
  let release!: () => void, calls = 0;
  const encoder = fixture(() => { calls++; return new Promise<void>(resolve => { release = resolve; }); });
  try {
    const first = prepareCurationRuntime(root, encoder);
    const second = prepareCurationRuntime(root);
    assert.equal(first, second);
    await Promise.resolve(); assert.equal(calls, 1);
    release(); await first;
    assert.equal(prepareCurationRuntime(root), first);
    const other = fixture(async () => { calls++; });
    await prepareCurationRuntime(`${root}/other-project`, other);
    assert.equal(calls, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a preparation failure can retry instead of poisoning all later queries", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-startup-retry-"));
  let calls = 0;
  const encoder = fixture(async () => { if (++calls === 1) throw new Error("temporary model load failure"); });
  try {
    await assert.rejects(prepareCurationRuntime(root, encoder), /temporary/u);
    await prepareCurationRuntime(root);
    assert.equal(calls, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
