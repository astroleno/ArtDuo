import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { POST } from "../../app/api/experience/metrics/route";
import { ExperienceObservabilityStore, experienceObservability, experienceObservabilityDirectory, readExperienceObservability } from "../../lib/experience-observability";
import { experienceDurationBucket, parseClientExperienceSample } from "../../lib/experience-observability-contract";

test("daily snapshots combine separate writers, deduplicate reasons and report bounded percentile samples", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artduo-anonymous-days-"));
  let now = Date.parse("2026-11-25T23:59:59Z");
  try {
    const a = new ExperienceObservabilityStore(directory, () => now);
    const b = new ExperienceObservabilityStore(directory, () => now);
    a.outcome("fresh-started");
    a.finishFresh(true, ["intent-unavailable", "semantic-unavailable", "intent-unavailable", "unincluded-raw-value"]);
    b.outcome("fresh-started");
    b.finishFresh(true, []);
    b.finishFresh(false, []);
    b.outcome("pending-join");
    for (const ms of [30, 100, 102, 10_750, 18_000]) a.duration("intent", experienceDurationBucket(ms)!);
    await Promise.all([a.flush(), b.flush()]);
    assert.equal((await readdir(directory)).length, 2);
    const restarted = new ExperienceObservabilityStore(directory, () => now);
    restarted.outcome("restore-success");
    await restarted.flush();
    const initial = await readExperienceObservability(directory, now);
    assert.deepEqual(initial.totals.freshDegradation, { numerator: 1, denominator: 2, value: .5 });
    assert.deepEqual(initial.totals.reasons, { "intent-unavailable": 1, "semantic-unavailable": 1 });
    assert.equal(initial.totals.outcomes["pending-join"], 1);
    assert.equal(initial.totals.outcomes["fresh-failed"], 1);
    assert.equal(initial.totals.outcomes["restore-success"], 1);
    assert.equal(initial.totals.timings.intent!.n, 5);
    assert.deepEqual(initial.totals.timings.intent!.p50, { lowerMs: 100, upperMs: 200 });
    assert.deepEqual(initial.totals.timings.intent!.p90, { lowerMs: 12000, upperMs: 20000 });
    assert.ok(initial.days.every(row => row.day === "2026-11-25"));
    for (const name of await readdir(directory)) {
      const snapshot = JSON.parse(await readFile(path.join(directory, name), "utf8"));
      assert.deepEqual(Object.keys(snapshot), ["schemaVersion", "day", "outcomes", "reasons", "durations"]);
      assert.doesNotMatch(JSON.stringify(snapshot), /unincluded-raw-value|query|visitor|curationId|releaseVersion/u);
    }
    now = Date.parse("2026-12-09T00:00:00Z");
    restarted.outcome("fresh-started");
    await restarted.flush();
    const later = await readExperienceObservability(directory, now);
    assert.deepEqual(later.totals.freshDegradation, { numerator: 0, denominator: 0, value: null });
    assert.deepEqual(later.days.map(row => row.day), ["2026-12-09"]);
    assert.equal((await readdir(directory)).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("opt-in accepts only same-origin bounded anonymous client samples and never writes when disabled", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artduo-anonymous-endpoint-"));
  const previous = [process.env.ARTDUO_OBSERVABILITY, process.env.ARTDUO_STATE_DIR, process.env.ARTDUO_PUBLIC_MODE];
  const keys = ["ARTDUO_OBSERVABILITY", "ARTDUO_STATE_DIR", "ARTDUO_PUBLIC_MODE"] as const;
  const endpoint = (body: string, origin = "http://127.0.0.1:4199", site = "same-origin", type = "application/json") =>
    new Request("http://localhost:4199/ArtDuo/api/experience/metrics", { method: "POST",
      headers: { origin, host: "127.0.0.1:4199", "sec-fetch-site": site, "content-type": type }, body });
  const good = JSON.stringify({ phase: "enter-to-first-artwork-actionable", bucket: 3 });
  try {
    process.env.ARTDUO_STATE_DIR = directory;
    process.env.ARTDUO_OBSERVABILITY = "0";
    delete process.env.ARTDUO_PUBLIC_MODE;
    assert.equal((await POST(endpoint(good))).status, 404);
    assert.deepEqual(await readdir(directory), []);
    process.env.ARTDUO_OBSERVABILITY = "1";
    assert.equal((await POST(endpoint(good, "http://example.org"))).status, 403);
    assert.equal((await POST(endpoint(good, undefined, "cross-site"))).status, 403);
    assert.equal((await POST(endpoint(good, undefined, undefined, "text/plain"))).status, 415);
    assert.equal((await POST(endpoint("x".repeat(129)))).status, 413);
    for (const data of [{ phase: "intent", bucket: 0 }, { phase: "enter-to-first-artwork-actionable", bucket: 17 },
      { phase: "enter-to-first-artwork-actionable", bucket: 1, artworkId: "unexpected" }]) {
      assert.equal(parseClientExperienceSample(data), undefined);
      assert.equal((await POST(endpoint(JSON.stringify(data)))).status, 400);
    }
    assert.equal((await POST(endpoint(good))).status, 204);
    await experienceObservability()!.flush();
    const report = await readExperienceObservability(experienceObservabilityDirectory()!);
    assert.equal(report.totals.timings["enter-to-first-artwork-actionable"]!.n, 1);
    for (const ms of [Infinity, NaN, -1, 90_001]) assert.equal(experienceDurationBucket(ms), undefined);
  } finally {
    keys.forEach((key, index) => { const value = previous[index]; if (value === undefined) delete process.env[key]; else process.env[key] = value; });
    await rm(directory, { recursive: true, force: true });
  }
});

test("write failures never reject and a later sample retries the prior cumulative count", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "artduo-anonymous-write-"));
  const directory = path.join(root, "not-directory-yet");
  try {
    await writeFile(directory, "blocked");
    const store = new ExperienceObservabilityStore(directory);
    store.outcome("fresh-started");
    await store.flush();
    await rm(directory);
    await mkdir(directory);
    store.outcome("fresh-started");
    await store.flush();
    assert.equal((await readExperienceObservability(directory)).totals.outcomes["fresh-started"], 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
