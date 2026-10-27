import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileRevisionCache } from "../../lib/file-revision-cache";

test("validated file reuse isolates mutable callers and invalidates same-size edits even with restored mtime", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-revision-"));
  const file = path.join(root, "record");
  const cache = new FileRevisionCache<{ values: Map<string, string> }>();
  let reads = 0;
  const read = () => cache.read(file, () => [file], () => { reads++; return { values: new Map([["title", readFileSync(file, "utf8")]]) }; });
  try {
    writeFileSync(file, "first");
    const originalStat = statSync(file);
    const first = read(); first.values.set("title", "caller-only");
    assert.equal(read().values.get("title"), "first"); assert.equal(reads, 1);
    writeFileSync(file, "other"); utimesSync(file, originalStat.atime, originalStat.mtime);
    assert.equal(read().values.get("title"), "other"); assert.equal(reads, 2);
    rmSync(file); assert.throws(read); // Never return the previous cached success.
    writeFileSync(file, "third"); assert.equal(read().values.get("title"), "third");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("new optional dependencies and symlink target changes invalidate cached data", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-revision-links-"));
  const first = path.join(root, "first"), second = path.join(root, "second"), link = path.join(root, "link"), sidecar = path.join(root, "sidecar");
  const cache = new FileRevisionCache<string>();
  let loads = 0;
  const read = () => cache.read(link, () => [link, sidecar], () => { loads++; return readFileSync(link, "utf8"); });
  try {
    writeFileSync(first, "one"); writeFileSync(second, "two"); symlinkSync(first, link);
    assert.equal(read(), "one"); assert.equal(read(), "one"); assert.equal(loads, 1);
    writeFileSync(sidecar, "new role evidence"); read(); assert.equal(loads, 2);
    rmSync(link); symlinkSync(second, link); assert.equal(read(), "two"); assert.equal(loads, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a change during loading is not cached and old versions are evicted at capacity", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-revision-race-"));
  const file = path.join(root, "record");
  const cache = new FileRevisionCache<string>(2);
  let loads = 0;
  const load = () => { loads++; return readFileSync(file, "utf8"); };
  try {
    writeFileSync(file, "before");
    cache.read("a", () => [file], () => { const value = load(); writeFileSync(file, "after"); return value; });
    assert.equal(cache.read("a", () => [file], load), "after"); assert.equal(loads, 2);
    cache.read("b", () => [file], load); cache.read("c", () => [file], load);
    cache.read("a", () => [file], load); assert.equal(loads, 5);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
