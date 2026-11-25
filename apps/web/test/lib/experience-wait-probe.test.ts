import assert from "node:assert/strict";
import { test } from "node:test";
import { probeOptions, summarizeWaitSamples } from "../../scripts/experience-wait-probe.mjs";

test("wait summaries retain failures and distinguish unavailable from inapplicable measurements", () => {
  const [fresh, saved] = summarizeWaitSamples([
    { mode: "fresh-rules", status: "ok", submitToPrefaceMs: 100, enterToFirstPaintingMs: 50, submitToFirstPaintingMs: 155 },
    { mode: "fresh-rules", status: "ok", submitToPrefaceMs: 200, enterToFirstPaintingMs: 70, submitToFirstPaintingMs: 280 },
    { mode: "fresh-rules", status: "failed", enterToFirstPaintingMs: 2 },
    { mode: "saved", status: "ok", enterToFirstPaintingMs: 60, submitToPrefaceMs: null, submitToFirstPaintingMs: null },
    { mode: "saved", status: "not-run" },
  ]);
  assert.deepEqual([fresh.n, fresh.succeeded, fresh.failed, fresh.notRun], [3, 2, 1, 0]);
  assert.deepEqual(fresh.metrics.submitToPrefaceMs, { applicable: true, n: 2, missing: 1, medianMs: 150 });
  assert.deepEqual(fresh.metrics.enterToFirstPaintingMs, { applicable: true, n: 2, missing: 1, medianMs: 60 });
  assert.deepEqual([saved.n, saved.succeeded, saved.failed, saved.notRun], [2, 1, 0, 1]);
  assert.deepEqual(saved.metrics.enterToFirstPaintingMs, { applicable: true, n: 1, missing: 1, medianMs: 60 });
  for (const metric of ["submitToPrefaceMs", "submitToFirstPaintingMs"]) {
    assert.deepEqual(saved.metrics[metric], { applicable: false, n: 0, missing: 0, medianMs: null });
  }
});

test("browser probe requires isolated synthetic state and permits only uncredentialed HTTP loopback", () => {
  const options = ["--state-dir=synthetic", "--cache-state=prepared-local-media", "--output=result.json"];
  for (const url of ["https://127.0.0.1/ArtDuo", "http://127.0.0.1.example.com/ArtDuo", "http://test@localhost/ArtDuo"]) {
    assert.throws(() => probeOptions([...options, "--url=" + url]), /HTTP loopback/u);
  }
  assert.throws(() => probeOptions(options.slice(1)), /Provide --state-dir/u);
  const local = probeOptions([...options, "--url=http://[::1]:4159/ArtDuo/", "--space-name=ArtDuo 展签与等待复核"]);
  assert.equal(local.url, "http://[::1]:4159/ArtDuo");
  assert.equal(local.spaceName, "ArtDuo 展签与等待复核");
});
