import assert from "node:assert/strict";
import test from "node:test";
import { createOverlayHistory, type OverlayHistoryHost } from "./overlay-history";

function browser(initial?: { href: string; state: unknown }[]) {
  const entries = initial ?? [
    { href: "https://example.test/ArtDuo", state: { page: "home" } },
    { href: "https://example.test/ArtDuo?view=experience&artworkId=a", state: { __NA: true, tree: "next-tree" } },
  ];
  let index = entries.length - 1;
  const traversals: number[] = [];
  const listeners: Array<(event: PopStateEvent) => void> = [];
  const location = { href: entries[index]!.href };
  let canonical = location.href;
  const replace = (state: unknown, href?: string | URL | null) => {
    location.href = href ? new URL(href, location.href).href : location.href;
    const data = state as Record<string, unknown>;
    if (!data?.__NA && !data?._N) canonical = location.href;
    entries[index] = { href: location.href, state: { ...data, __NA: true } };
  };
  const host: OverlayHistoryHost = { location, history: {
    get state() { return entries[index]!.state; },
    replaceState: (state, _unused, href) => replace(state, href),
    pushState: (state, _unused, href) => { entries.splice(index + 1); index++; replace(state, href); },
    back: () => { traversals.push(-1); },
  }, addEventListener: (_type, listener) => { listeners.push(listener); } };
  const flush = () => {
    let remaining = 20;
    while (traversals.length && remaining--) {
      const next = index + traversals.shift()!;
      if (next < 0 || next >= entries.length) continue;
      index = next;
      location.href = entries[index]!.href;
      let stopped = false;
      const event = { state: host.history.state, stopImmediatePropagation: () => { stopped = true; } } as PopStateEvent;
      for (const listener of listeners) { listener(event); if (stopped) break; }
    }
    assert.ok(remaining > 0, "history recovery must not loop");
  };
  return { host, entries, flush, canonical: () => canonical, index: () => index, go: (delta: number) => { traversals.push(delta); flush(); }, back: () => { traversals.push(-1); flush(); }, forward: () => { traversals.push(1); flush(); } };
}

test("Back dismisses one layer at the latest work and preserves Next state", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  let dismissed = 0;
  const layer = controller.open(() => { dismissed++; });
  controller.replaceLocation("/ArtDuo?view=experience&artworkId=b");
  assert.equal(b.canonical(), b.host.location.href, "the framework canonical URL must follow external positions");
  assert.equal(b.entries.length, 3);
  b.back();
  assert.equal(dismissed, 1);
  assert.equal(b.index(), 1);
  assert.match(b.host.location.href, /artworkId=b$/);
  assert.equal(b.canonical(), b.host.location.href);
  assert.equal((b.host.history.state as { tree: string }).tree, "next-tree");
  layer.close();
  b.flush();
  assert.equal(b.index(), 1, "a React close update must not also leave the exhibition");
  b.back();
  assert.equal(b.index(), 0);
});

test("explicit close consumes the entry and Forward cannot reopen a closed layer", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  let dismissed = 0;
  const layer = controller.open(() => { dismissed++; });
  layer.close(); layer.close(); b.flush();
  assert.equal(dismissed, 1);
  assert.equal(b.index(), 1);
  b.forward();
  assert.equal(b.index(), 1);
  assert.equal(dismissed, 1);
  b.back();
  assert.equal(b.index(), 0);
});

test("a rapid reopen waits for the preceding close traversal without adding empty entries", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  const first = controller.open(() => {});
  first.close();
  let closed = false;
  controller.open(() => { closed = true; });
  b.flush();
  assert.equal(b.entries.length, 3);
  b.back();
  assert.equal(closed, true);
  assert.equal(b.index(), 1);
});

test("restoring visible artwork while closing updates the returning base position", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  const layer = controller.open(() => {});
  controller.replaceLocation("/ArtDuo?view=experience&artworkId=b");
  layer.close();
  controller.replaceLocation("/ArtDuo?view=experience&artworkId=a");
  b.flush();
  assert.match(b.host.location.href, /artworkId=a$/);
});

test("Forward cannot restore a failed target after Back cancelled its switch", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  controller.open(() => controller.replaceLocation("/ArtDuo?view=experience&artworkId=a"));
  controller.replaceLocation("/ArtDuo?view=experience&artworkId=b");
  b.back();
  assert.match(b.host.location.href, /artworkId=a$/);
  b.forward();
  assert.match(b.host.location.href, /artworkId=a$/);
  assert.equal(b.index(), 1);
});

test("traversing past the layer leaves the exhibition without rolling its URL back", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  let sameView: boolean | undefined;
  controller.open(value => { sameView = value; if (value) controller.replaceLocation('/ArtDuo?view=experience&artworkId=a'); });
  controller.replaceLocation('/ArtDuo?view=experience&artworkId=b');
  b.go(-2);
  assert.equal(sameView, false);
  assert.equal(b.host.location.href, 'https://example.test/ArtDuo');
  assert.equal(b.index(), 0);
});

test("navigation to artwork details is not pulled back by layer disposal", () => {
  const b = browser(), controller = createOverlayHistory(b.host);
  const layer = controller.open(() => {});
  b.host.history.pushState({ __NA: true, tree: "details" }, "", "/ArtDuo/artwork/a");
  layer.dispose(); b.flush();
  assert.match(b.host.location.href, /artwork\/a$/);
  b.back();
  assert.match(b.host.location.href, /view=experience/);
  assert.equal(b.index(), 1);
});

test("reload collapses a stale layer while retaining the latest work", () => {
  const original = browser(), controller = createOverlayHistory(original.host);
  controller.open(() => {});
  controller.replaceLocation("/ArtDuo?view=experience&artworkId=b");
  const reloaded = browser(original.entries.map(entry => ({ ...entry })));
  createOverlayHistory(reloaded.host);
  reloaded.flush();
  assert.equal(reloaded.index(), 1);
  assert.match(reloaded.host.location.href, /artworkId=b$/);
});
