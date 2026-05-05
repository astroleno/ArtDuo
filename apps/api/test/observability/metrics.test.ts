import assert from "node:assert/strict";
import { test } from "node:test";

import { createMetricTimer, InMemoryMetrics } from "../../src/observability/metrics";

test("metrics records curation timings and degradation triggers", () => {
  const metrics = new InMemoryMetrics();
  const stop = createMetricTimer(metrics, "exhibition.create", { releaseVersion: "2026-04-25-curation-b" }, () => 100);

  stop(() => 145);
  metrics.recordDuration("retrieval.search", 18, { resultCount: "12" });
  metrics.recordDuration("explanation.generate", 64, { status: "ready" });
  metrics.recordDegradation("sse_failed", { fallback: "polling" });

  assert.deepEqual(
    metrics.list().map((entry) => `${entry.name}:${entry.durationMs}:${entry.tags.reason ?? entry.tags.status ?? ""}`),
    [
      "exhibition.create:45:",
      "retrieval.search:18:",
      "explanation.generate:64:ready",
      "degradation.trigger:0:sse_failed",
    ],
  );
  assert.equal(metrics.summary("exhibition.create").count, 1);
  assert.equal(metrics.summary("explanation.generate").totalDurationMs, 64);
});
