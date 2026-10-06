import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAnalyticsSink } from "../../lib/analytics";
import { recordExperienceDegradation, recordExperienceTiming } from "../../lib/experience-analytics";

test("experience telemetry records durations and fallback reasons without user query", async () => {
  const sink = new InMemoryAnalyticsSink();
  recordExperienceTiming("retrieval", 18.6, "release-test", sink);
  recordExperienceDegradation("background-scene-unavailable", "release-test", "met-123", sink);
  await Promise.resolve();

  assert.deepEqual(sink.events.map((event) => event.name), ["experience.performance", "experience.degraded"]);
  assert.equal(sink.events[0]?.properties.durationMs, "19");
  assert.equal(sink.events[0]?.properties.releaseVersion, "release-test");
  assert.equal(sink.events[1]?.properties.reason, "background-scene-unavailable");
  assert.equal("query" in (sink.events[0]?.properties ?? {}), false);
  assert.equal("query" in (sink.events[1]?.properties ?? {}), false);
});
