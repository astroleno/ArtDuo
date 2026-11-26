import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AudioButton, createAmbientPlayback } from "./audio-controller";
import { ambientTrack } from "./ambient-track";

test("pending audio offers cancellation and a readable status without claiming playback", () => {
  const markup = renderToStaticMarkup(<AudioButton state="loading" onToggle={() => {}} />);
  assert.match(markup, /aria-label="取消环境音加载"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /正在准备环境音/);
  assert.match(markup, /aria-live="polite"/);
  assert.doesNotMatch(markup, /disabled|环境音已开/);
  const failure = renderToStaticMarkup(<AudioButton state="error" onToggle={() => {}} />);
  assert.match(failure, /aria-label="重试环境音"/);
  assert.match(failure, /环境音暂时无法播放，可以重试/);
});

function fixture(locked = false, connectGain?: Parameters<typeof createAmbientPlayback>[0]["connectGain"]) {
  let time = 0, animationId = 0, visible = true, created = 0, volume = 1;
  const states: string[] = [], frames = new Map<number, FrameRequestCallback>();
  const calls: Array<{ resolve: () => void; reject: () => void }> = [];
  let writes = 0;
  const element = {
    paused: true, currentTime: 12, src: "", onerror: null, preload: "", loop: false, crossOrigin: null as string | null,
    get volume() { return volume; },
    set volume(value) { writes++; if (!locked) volume = value; },
    matches() { throw new Error("unknown selector"); },
    play() { return new Promise<void>((resolve, reject) => calls.push({ resolve: () => { element.paused = false; resolve(); }, reject: () => reject() })); },
    pause() { element.paused = true; }, removeAttribute() { element.src = ""; }, load() {},
  };
  const player = createAmbientPlayback({ createAudio: () => { created++; return element as unknown as HTMLAudioElement; }, connectGain,
    now: () => time, frame: cb => { frames.set(++animationId, cb); return animationId; },
    cancelFrame: id => { frames.delete(id); }, onState: state => states.push(state), isVisible: () => visible });
  const step = (elapsed: number) => {
    time += elapsed;
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(time);
    return volume;
  };
  return { player, element, calls, step, states, created: () => created, writes: () => writes,
    hide: () => { visible = false; player.stop(); }, frames };
}

test("one enabled track dips only at a turn, ducks for reading and fades monotonically at the close", async () => {
  const f = fixture();
  f.player.navigate(true);
  assert.equal(f.created(), 0);
  const start = f.player.toggle("/chosen.mp3");
  f.calls[0]!.resolve(); assert.equal(await start, "on");
  f.player.navigate(false);
  assert.equal(f.frames.size, 0);
  f.player.navigate(true);
  assert.equal(f.step(200), .16 * .65);
  assert.ok(f.step(200) > .16 * .65);
  assert.equal(f.step(200), .16);
  f.player.setScene(.064, false);
  assert.equal(f.step(300), .064);
  f.player.setScene(.16, false);
  assert.equal(f.step(300), .16);
  f.player.setScene(.16, true);
  const fade = Array.from({ length: 7 }, () => f.step(200));
  assert.equal(fade.at(-1), 0);
  assert.ok(fade.every((value, index) => index === 0 || value <= fade[index - 1]!));
  assert.equal(f.element.paused, true);
  assert.equal(f.states.at(-1), "off");
  f.player.setScene(.16, false);
  assert.equal(f.element.volume, 0);
  f.calls[1]!.resolve(); await Promise.resolve();
  assert.equal(f.step(300), .16);
  assert.equal(f.element.currentTime, 12);
  assert.equal(f.element.src, "/chosen.mp3");
  assert.equal(f.created(), 1);
  f.player.stop();
});

test("returning early can cancel a running fade, but manual stop and hidden state revoke playback", async () => {
  const f = fixture();
  const start = f.player.toggle(); f.calls[0]!.resolve(); await start;
  f.player.navigate(true); f.step(160); f.player.navigate(false);
  assert.equal(f.step(300), .16);
  f.player.setScene(.16, true);
  const reduced = f.step(450);
  assert.ok(reduced < .16);
  f.player.setScene(.16, false);
  assert.equal(f.step(300), .16);
  assert.equal(f.calls.length, 1);
  f.player.setScene(.16, true);
  f.player.stop();
  f.player.setScene(.16, false);
  assert.equal(f.calls.length, 1);
  const pending = f.player.toggle();
  f.hide();
  f.calls[1]!.resolve();
  assert.equal(await pending, "off");
  assert.equal(f.element.paused, true);
  assert.equal(f.frames.size, 0);
});

test("a delayed play cannot sound in the close; explicit closing listen and volume-lock are truthful", async () => {
  const f = fixture(true);
  const pending = f.player.toggle();
  assert.equal(f.writes(), 1);
  f.player.setScene(.16, true);
  f.calls[0]!.resolve(); assert.equal(await pending, "off");
  assert.equal(f.element.paused, true);
  const listen = f.player.toggle();
  f.calls[1]!.resolve(); assert.equal(await listen, "on");
  assert.equal(f.element.paused, false);
  f.player.setScene(.16, false);
  f.player.setScene(.16, true);
  f.step(1200);
  assert.equal(f.writes(), 1);
  assert.equal(f.element.paused, true);
  f.player.setScene(.16, false);
  f.calls[2]!.reject(); await Promise.resolve();
  assert.equal(f.states.at(-1), "off");
  assert.equal(f.created(), 1);
  f.player.setScene(0, false);
  assert.equal(await f.player.toggle(), "off");
  f.player.stop();
});

test("one graph uses gain for turns, reading and the full closing fade even with locked media volume", async () => {
  let level = 0, connections = 0, closed = 0;
  const f = fixture(true, media => {
    connections++;
    assert.equal(media.src, "", "nothing is fetched before the graph is configured");
    return { read: () => level, write: value => { level = value; }, resume: async () => {}, close: () => { closed++; } };
  });
  f.player.navigate(true);
  assert.equal(connections, 0);
  const start = f.player.toggle("https://media.example/selected.mp3");
  assert.equal(f.element.crossOrigin, "anonymous");
  f.calls[0]!.resolve(); assert.equal(await start, "on");
  f.player.navigate(true);
  f.step(200); assert.equal(level, .16 * .65);
  f.step(400); assert.equal(level, .16);
  f.player.setScene(.064, false);
  f.step(300); assert.equal(level, .064);
  f.player.setScene(.064, true);
  const closing = Array.from({ length: 6 }, () => { f.step(200); return level; });
  assert.ok(closing.every((value, index) => !index || value < closing[index - 1]!));
  assert.equal(closing.at(-1), 0);
  assert.equal(f.element.paused, true);
  assert.equal(f.writes(), 0);
  f.player.stop();
  assert.equal(connections, 1);
  assert.equal(closed, 1);
});

test("a failed graph setup falls back before loading the selected file", async () => {
  const f = fixture(false, () => { throw new Error("Web Audio unavailable"); });
  const start = f.player.toggle("/selected.mp3");
  f.calls[0]!.resolve(); assert.equal(await start, "on");
  assert.equal(f.created(), 2);
  assert.equal(f.calls.length, 1);
  assert.equal(f.element.src, "/selected.mp3");
  assert.equal(f.element.volume, .16);
  assert.equal(f.element.crossOrigin, null);
  f.player.stop();
});

test("the same exhibition plan and asset map select the same track by mean arousal", () => {
  const urls = ["https://media.example/awakening.mp3", "https://media.example/felt.mp3", "https://media.example/first.mp3"];
  const stages = (values: number[]) => values.map(arousal => ({ arousal }));
  assert.equal(ambientTrack("exhibit", stages([.2, .6]), urls), urls[1]);
  assert.equal(ambientTrack("exhibit", stages([.42]), urls), urls[0]);
  assert.equal(ambientTrack("exhibit", stages([.63]), urls), urls[2]);
  assert.equal(ambientTrack("exhibit", stages([.7, .4]), urls), ambientTrack("exhibit", stages([.4, .7]), urls));
  assert.match(ambientTrack("exhibit", stages([.3])), /\/ambient-audio\/Felt%20Letter\.mp3$/u);
  assert.equal(ambientTrack("legacy", stages([NaN]), urls), ambientTrack("legacy", [], urls));
});
