import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAnalyticsSink } from "../../lib/analytics";
import { beginExperienceTiming, beginExperienceTimingIfMissing, recordExperienceDegradation, recordExperienceTiming, sendAnonymousExperienceDuration, takeRealExperienceSubmissionMs } from "../../lib/experience-analytics";

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
    assert.ok(Number.isFinite(takeRealExperienceSubmissionMs()));
    assert.equal(takeRealExperienceSubmissionMs(), undefined);
  } finally {
    performance.clearMarks("artduo.experience.submit");
    performance.clearMarks("artduo.experience.real-submit");
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else Reflect.deleteProperty(globalThis, "window");
    if (storageDescriptor) Object.defineProperty(globalThis, "sessionStorage", storageDescriptor); else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("anonymous client samples use an actual submission and only send the fixed phase and bucket when enabled", async () => {
  const previousFetch = globalThis.fetch;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const requests: Array<{ target: string; init?: RequestInit }> = [];
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "http://localhost/gallery/local/immersive?curationId=existing" } } });
    globalThis.fetch = async (target, init) => { requests.push({ target: String(target), init }); return new Response(null, { status: 204 }); };
    beginExperienceTimingIfMissing();
    assert.equal(takeRealExperienceSubmissionMs(), undefined);
    sendAnonymousExperienceDuration(false, "enter-to-first-artwork-actionable", 180);
    sendAnonymousExperienceDuration(true, "submit-to-preface-actionable", undefined);
    sendAnonymousExperienceDuration(true, "submit-to-preface-actionable", 90001);
    sendAnonymousExperienceDuration(true, "enter-to-first-artwork-actionable", 180);
    assert.equal(requests.length, 1);
    const { target, init } = requests[0]!;
    assert.match(target, /\/api\/experience\/metrics$/u);
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.referrerPolicy, "no-referrer");
    assert.deepEqual(JSON.parse(String(init?.body)), { phase: "enter-to-first-artwork-actionable", bucket: 2 });
  } finally {
    globalThis.fetch = previousFetch;
    performance.clearMarks("artduo.experience.submit");
    performance.clearMarks("artduo.experience.real-submit");
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else Reflect.deleteProperty(globalThis, "window");
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
