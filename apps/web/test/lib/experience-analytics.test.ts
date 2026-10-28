import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAnalyticsSink } from "../../lib/analytics";
import { beginExperienceTiming, beginExperienceTimingIfMissing, recordExperienceDegradation, recordExperienceTiming } from "../../lib/experience-analytics";

test("client navigation consumes timing handoff while preserving the original submit mark", () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "https://aitoshuu.me/ArtDuo/gallery/local/immersive?query=quiet" } } });
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
      setItem: (key: string, value: string) => values.set(key, value), getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => values.delete(key),
    } });
    beginExperienceTiming("quiet");
    const before = performance.getEntriesByName("artduo.experience.submit", "mark").at(-1)!;
    assert.equal(values.has("artduo.experience.pending-navigation"), true);
    beginExperienceTimingIfMissing();
    assert.equal(values.has("artduo.experience.pending-navigation"), false);
    assert.equal(performance.getEntriesByName("artduo.experience.submit", "mark").at(-1)?.startTime, before.startTime);
  } finally {
    performance.clearMarks("artduo.experience.submit");
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else Reflect.deleteProperty(globalThis, "window");
    if (storageDescriptor) Object.defineProperty(globalThis, "sessionStorage", storageDescriptor); else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

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
