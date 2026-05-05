import assert from "node:assert/strict";
import { test } from "node:test";

import { chooseCurationFallbackMode, InMemoryAnalyticsSink, trackAnalyticsEvent } from "../../lib/analytics";

test("analytics chooses polling or local fallback when stream state fails", async () => {
  assert.equal(chooseCurationFallbackMode({ streamAvailable: true, pollingAvailable: true }), "stream");
  assert.equal(chooseCurationFallbackMode({ streamAvailable: false, pollingAvailable: true }), "polling");
  assert.equal(chooseCurationFallbackMode({ streamAvailable: false, pollingAvailable: false }), "local-state");

  const sink = new InMemoryAnalyticsSink();
  await trackAnalyticsEvent(sink, "curation.degraded", { reason: "sse_failed", fallback: "polling" });

  assert.equal(sink.events[0]?.name, "curation.degraded");
  assert.equal(sink.events[0]?.properties.fallback, "polling");
});
