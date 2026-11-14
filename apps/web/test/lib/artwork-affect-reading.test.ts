import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { affectReadingPath, loadAffectReadings, parseAffectReading } from "../../lib/artwork-affect-reading";

const valid = { artworkId: "met-1", sourceFingerprint: `sha256:${"a".repeat(64)}`, model: "deepseek-flash", promptVersion: "affect-reading-v1", reviewedAt: "2026-11-15",
  valence: .3, arousal: .4, tension: .7, wonder: .4, intimacy: .3, reading: "金色麦田里独自挥镰，带有战后哀悼与劳作的沉重。", themes: ["labor", "mourning"] };

test("readings keep only bounded values, short text and known themes", () => {
  assert.deepEqual(parseAffectReading(valid).themes, ["labor", "mourning"]);
  for (const broken of [{ ...valid, tension: 1.4 }, { ...valid, valence: Number.NaN }, { ...valid, reading: "长".repeat(121) }, { ...valid, reading: " " },
    { ...valid, sourceFingerprint: "abc" }, { ...valid, themes: ["labor", "made-up"] }, { ...valid, themes: Array(5).fill("labor") }]) {
    assert.throws(() => parseAffectReading(broken), TypeError, JSON.stringify(broken).slice(0, 80));
  }
});

test("only readings of the exact delivered image are used, and a broken ledger is ignored", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-affect-"));
  try {
    const file = affectReadingPath(root, "r1");
    mkdirSync(path.dirname(file), { recursive: true });
    const other = { ...valid, artworkId: "met-2" };
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, releaseVersion: "r1", readings: [valid, other] }));
    const loaded = loadAffectReadings(root, "r1", new Map([["met-1", valid.sourceFingerprint], ["met-2", `sha256:${"b".repeat(64)}`]]));
    assert.deepEqual([...loaded.byId.keys()], ["met-1"], "a reading of a replaced image is not applied");
    assert.match(loaded.version ?? "", /^affect-v1-[a-f0-9]{16}$/u);
    writeFileSync(file, "{not json");
    assert.equal(loadAffectReadings(root, "r1", new Map()).byId.size, 0);
    assert.equal(loadAffectReadings(root, "missing", new Map()).version, undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
