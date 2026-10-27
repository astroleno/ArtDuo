import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { HANDWRITING_CARD_VERSION, keepsakeDraftIdentity, type ExhibitionKeepsakeDraft } from "@artduo/contracts";
import { InkoClient } from "../../lib/handwriting/inko";
import { HandwritingStore, digest } from "../../lib/handwriting/store";
import { HandwritingWorker } from "../../lib/handwriting/worker";
import { prepareSceneLayer, readSceneArchive } from "../../lib/handwriting/scene-layer";
import { getHandwritingAsset, getHandwritingJob, cancelHandwritingJob, assertHandwritingOrigin, handwritingOptions } from "../../lib/handwriting/http";
import { pngCrc32 } from "../../../../packages/ui/src/experience/finalize-share-png";

function draft(changes: Partial<ExhibitionKeepsakeDraft> = {}): ExhibitionKeepsakeDraft {
  const input = { exhibitionId: "ex-saved", artworkId: "met-1", releaseVersion: "test-release", closingText: "看到这里，留一刻安静。", viewerSignature: "观展人",
    styleCode: "1", cardVersion: HANDWRITING_CARD_VERSION, ...changes };
  return { ...input, contentDigest: digest(keepsakeDraftIdentity(input)) };
}
const root = () => mkdtempSync(path.join(os.tmpdir(), "artduo-handwriting-"));
const owner = digest("a".repeat(64));

test("origin checks honor a real loopback Host and configured public origin without trusting foreign origins", () => {
  const local = new Request("http://localhost:3235/api/handwriting/jobs", { headers: { host: "127.0.0.1:3235", origin: "http://127.0.0.1:3235" } });
  assert.doesNotThrow(() => assertHandwritingOrigin(local, {}));
  assert.throws(() => assertHandwritingOrigin(new Request(local.url, { headers: { host: "evil.test:3235", origin: "http://evil.test:3235" } }), {}));
  assert.throws(() => assertHandwritingOrigin(new Request(local.url, { headers: { host: "127.0.0.1:3235", origin: "http://localhost:3235" } }), {}));
  const env = { ARTDUO_PUBLIC_MODE: "1", ARTDUO_PUBLIC_ORIGIN: "https://artduo.test" };
  assert.doesNotThrow(() => assertHandwritingOrigin(new Request(local.url, { headers: { host: "artduo.test", origin: "https://artduo.test" } }), env));
  assert.throws(() => assertHandwritingOrigin(local, env));
});

test("both public hosts accept their own origin and reject cross-domain or forged forwarding headers", () => {
  const env = { ARTDUO_PUBLIC_MODE: "1", ARTDUO_PUBLIC_ORIGIN: "https://aitoshuu.me", ARTDUO_PUBLIC_ORIGINS: "https://tongye.me" };
  for (const host of ["aitoshuu.me", "tongye.me"]) {
    const request = (origin: string, actualHost = host) => new Request("http://localhost:3240/ArtDuo/api/handwriting/jobs", { headers: { host: actualHost, origin, "x-forwarded-host": host } });
    assert.doesNotThrow(() => assertHandwritingOrigin(request(`https://${host}`), env));
    for (const origin of ["https://evil.test", "null", `http://${host}`, `https://${host}/`, `https://${host === "aitoshuu.me" ? "tongye.me" : "aitoshuu.me"}`]) assert.throws(() => assertHandwritingOrigin(request(origin), env));
    assert.throws(() => assertHandwritingOrigin(request(`https://${host}`, "evil.test"), env));
  }
});

test("public proxy sessions use a host-only Secure cookie limited to the subpath", async () => {
  const dir = root(), overrides = { ARTDUO_STATE_DIR: dir, ARTDUO_PUBLIC_MODE: "1", ARTDUO_BASE_PATH: "/ArtDuo" };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  try {
    const response = await handwritingOptions(new Request("http://localhost:3240/ArtDuo/api/handwriting/options", { headers: { host: "tongye.me" } }));
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /Path=\/ArtDuo\/api\/handwriting;/u); assert.match(cookie, /; Secure$/u);
    assert.match(cookie, /HttpOnly; SameSite=Lax/u); assert.doesNotMatch(cookie, /Domain=/iu);
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent duplicate creation and refresh recover one private persistent task", async () => {
  const dir = root(); try {
    const store = new HandwritingStore(dir), input = draft();
    const jobs = await Promise.all(Array.from({ length: 6 }, () => store.create(owner, input, "stable-request-0001")));
    assert.equal(new Set(jobs.map(j => j.id)).size, 1); assert.equal(store.all().length, 1);
    const recovered = new HandwritingStore(dir).owned(jobs[0].id, owner); assert.equal(recovered.contentDigest, input.contentDigest);
    assert.throws(() => store.owned(jobs[0].id, digest("someone-else")), /不属于/u);
    await assert.rejects(store.create(owner, draft({ viewerSignature: "另一个人" }), "stable-request-0001"), /另一份寄语/u);
    await assert.rejects(store.create(owner, { ...input, closingText: "替换内容但复用旧摘要" }, "another-request-0001"), /内容已变化/u);
    const claimed = await store.claim(); assert.ok(claimed); assert.equal(await store.claim(), undefined);
    const recoveredLease = await store.claim(Date.now() + 120_001); assert.equal(recoveredLease?.id, jobs[0].id);
    assert.notEqual(recoveredLease?.lease?.token, claimed.lease?.token);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ready private assets carry the deployment prefix without exposing stored ownership", async () => {
  const dir = root();
  try {
    const store = new HandwritingStore(dir, "/ArtDuo"), job = await store.create(owner, draft(), "subpath-request-0001");
    const saved = await store.update(job.id, current => { current.state = "ready"; current.layer = { width: 1080, height: 1600, aigc: { Label: "1" }, label: "AI生成 · Inko", upstreamId: "fixture" }; });
    const result = store.public(saved!);
    assert.equal(result.layer?.url, `/ArtDuo/api/handwriting/jobs/${job.id}/assets/layer`);
    assert.ok(!("owner" in result) && !("draft" in result) && !("cacheKey" in result));
    assert.throws(() => store.owned(job.id, digest("other-browser")), /不属于/u);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ready result is reused without new generation authorization, while changed drafts require it", async () => {
  const dir = root(); try {
    const store = new HandwritingStore(dir), input = draft(), job = await store.create(owner, input, "stable-request-0001");
    await store.update(job.id, current => { current.state = "ready"; });
    const blocked = () => { throw new Error("worker offline"); };
    const reused = await store.create(owner, input, "different-request-0001", Date.now(), blocked); assert.equal(reused.id, job.id);
    await assert.rejects(store.create(owner, draft({ closingText: "另一句话" }), "different-request-0002", Date.now(), blocked), /worker offline/u);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("zero ceiling rejects missing or positive quotes before submitting any generation", async () => {
  for (const price of [undefined, { list_cents: 1 }, { list_cents: 0, cost_cents: 1 }]) {
    const calls: string[] = [];
    const api = new InkoClient({ base: "https://inko.test/v1", key: "test" }, (async (url: string) => {
      calls.push(url); return Response.json({ ok: true, price, errors: [] });
    }) as typeof fetch);
    await assert.rejects(api.validate(draft()), /零费用报价/u); assert.equal(calls.length, 1); assert.ok(calls[0].endsWith("/quote"));
  }
});

test("layout overflow and unsupported characters preserve inputs and cannot be silently submitted", async () => {
  for (const mode of ["overflow", "characters"]) {
    const api = new InkoClient({ base: "https://inko.test/v1", key: "test" }, (async (url: string) => Response.json(url.endsWith("/quote")
      ? { ok: mode !== "characters", price: { list_cents: 0 }, errors: mode === "characters" ? [{ symbol: "𠮷" }] : [] }
      : { price: { list_cents: 0 }, pages: 1, unplaced: 1 })) as typeof fetch);
    await assert.rejects(api.validate(draft()), mode === "overflow" ? /无法完整放入/u : /𠮷/u);
  }
});

function archive(files: Record<string, Buffer>) {
  const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const n = Buffer.from(name), h = Buffer.alloc(30), c = Buffer.alloc(46), crc = pngCrc32(data);
    h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(h, n, data); central.push(c, n); offset += h.length + n.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
async function sceneFixture(text = "看到这里，留一刻安静。观展人", alphaLabel = false) {
  const atlas = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000000" } }).png().toBuffer();
  let label = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffffff" } }).composite([{ input: atlas, left: 3, top: 3 }]).png().toBuffer();
  if (alphaLabel) {
    const pixels = Buffer.alloc(20 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 20; x++) {
      const at = (y * 20 + x) * 4; pixels[at] = pixels[at + 1] = pixels[at + 2] = 128;
      pixels[at + 3] = y >= 1 && y <= 6 && (x >= 1 && x <= 5 || x >= 14 && x <= 18) ? 255 : 0;
    }
    label = await sharp(pixels, { raw: { width: 20, height: 8, channels: 4 } }).png().toBuffer();
  }
  const scene = { format: "inko-scene", version: 1, label: { mode: "visible" }, aigc: { Label: "1", ContentProducer: "Inko", ContentPropagator: "inkotype.com" },
    pages: [{ size: [600, 800], aigc_id: "original-page-id", glyphs: Array.from(text, (c, i) => ({ id: `p0g${i}`, c, sprite: { atlas: "sprites/page-1.png", rect: [0, 0, 2, 2] }, m: [6, 0, 80 + i * 16, 0, 6, 120] })) }] };
  return archive({ "scene.json": Buffer.from(JSON.stringify(scene)), "sprites/page-1.png": atlas, "label.png": label });
}
test("scene preparation retains ink as alpha, adds original provenance and rejects unsafe archives", async () => {
  const zip = await sceneFixture(), result = await prepareSceneLayer(zip, draft(), "upstream-id");
  const info = await sharp(result.png).metadata(); assert.equal(info.channels, 4); assert.ok(info.hasAlpha);
  const { data } = await sharp(result.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, "the paper margin must be transparent");
  assert.ok(data.some((value, i) => i % 4 === 3 && value > 0)); assert.equal(result.layer.aigc.ProduceID, "original-page-id");
  assert.ok(result.png.includes(Buffer.from('"ContentProducer":"Inko"')));
  assert.throws(() => readSceneArchive(archive({ "../key": Buffer.from("x"), "scene.json": Buffer.from("{}") }))); assert.throws(() => readSceneArchive(zip.subarray(0, zip.length - 10)));
});

test("the official RGBA label keeps transparent gaps instead of becoming a filled rectangle", async () => {
  const result = await prepareSceneLayer(await sceneFixture(undefined, true), draft(), "upstream-id");
  const { data, info } = await sharp(result.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = result.layer.width - 48, padding = 24, labelHeight = Math.ceil(width * 0.075), labelTop = result.layer.height - padding - labelHeight;
  const y = labelTop + Math.floor(labelHeight / 2), gapX = padding + Math.floor(labelHeight * 1.5), inkX = padding + Math.floor(labelHeight / 2);
  assert.equal(data[(y * info.width + gapX) * 4 + 3], 0, "the transparent gap between label glyphs must stay transparent");
  assert.ok(data[(y * info.width + inkX) * 4 + 3] > 200, "the visible label strokes must remain readable");
});

test("worker persists upstream identity across restart and sends only confirmed writing", async () => {
  const dir = root(), sent: Array<{ path: string; body?: any; key?: string | null }> = [];
  let upstreamStatus = "queued";
  const zip = await sceneFixture();
  const api = new InkoClient({ base: "https://inko.test/v1", key: "test" }, (async (url: string, init?: RequestInit) => {
    const pathname = new URL(url).pathname; const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sent.push({ path: pathname, body, key: new Headers(init?.headers).get("Idempotency-Key") });
    if (pathname.endsWith("/styles")) return Response.json({ data: [{ code: 1, label: "No.001" }] });
    if (pathname.endsWith("/quote")) return Response.json({ ok: true, price: { list_cents: 0 }, errors: [] });
    if (pathname.endsWith("/layout")) return Response.json({ price: { list_cents: 0 }, pages: 1, unplaced: 0 });
    if (pathname.endsWith("/delivery-complete")) return Response.json({ ok: true });
    if (pathname.endsWith("/generations") && init?.method === "POST") return Response.json({ id: "upstream-saved", status: "queued" }, { status: 202 });
    if (pathname.endsWith("/generations/upstream-saved")) return Response.json({ status: upstreamStatus, files: { scene: "https://inko.test/scene.zip" } });
    if (pathname.endsWith("/scene.zip")) return new Response(new Uint8Array(zip));
    throw new Error(`Unexpected request: ${pathname}`);
  }) as typeof fetch);
  try {
    const worker = new HandwritingWorker(dir, api); await worker.initialize();
    const job = await worker.store.create(owner, draft(), "stable-request-0001"); await worker.tick();
    assert.equal(worker.store.read(job.id)?.upstreamId, "upstream-saved");
    assert.equal(worker.store.read(job.id)?.state, "queued");
    const second = new HandwritingWorker(dir, api); await second.initialize();
    await second.store.update(job.id, current => { current.nextAttemptAt = 0; }); await second.tick();
    assert.equal(second.store.read(job.id)?.state, "queued", "an upstream queue is not reported as active writing");
    upstreamStatus = "running";
    await second.store.update(job.id, current => { current.nextAttemptAt = 0; }); await second.tick(); assert.equal(second.store.read(job.id)?.state, "running");
    upstreamStatus = "succeeded";
    await second.store.update(job.id, current => { current.nextAttemptAt = 0; }); await second.tick();
    assert.equal(second.store.read(job.id)?.state, "ready"); await second.tick(); assert.equal(second.store.read(job.id)?.delivered, true);
    const submissions = sent.filter(request => request.path.endsWith("/generations")); assert.equal(submissions.length, 1);
    assert.equal(submissions[0].key, `artduo-${job.id}`); assert.equal(submissions[0].body.layout.text, "看到这里，留一刻安静。\n观展人");
    assert.deepEqual(Object.keys(submissions[0].body).sort(), ["label", "layout", "model", "scene", "style"]);
    assert.ok(!JSON.stringify(submissions[0].body).includes("met-1")); assert.ok(!JSON.stringify(submissions[0].body).includes("ex-saved"));
    assert.ok(readFileSync(second.store.assetPath(job.id)).includes(Buffer.from("AIGC")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("private asset routes reject another session and canceled jobs cannot return late artwork", async () => {
  const dir = root(), previous = process.env.ARTDUO_STATE_DIR; process.env.ARTDUO_STATE_DIR = dir;
  try {
    const store = new HandwritingStore(path.join(dir, "handwriting")); const job = await store.create(owner, draft(), "stable-request-0001");
    await store.update(job.id, current => { current.state = "ready"; }); mkdirSync(path.dirname(store.assetPath(job.id)), { recursive: true }); writeFileSync(store.assetPath(job.id), "png");
    const own = new Request("http://localhost/api/handwriting", { headers: { cookie: `artduo_handwriting=${"a".repeat(64)}` } });
    const other = new Request(own.url, { headers: { cookie: `artduo_handwriting=${"b".repeat(64)}` } });
    assert.equal((await getHandwritingAsset(other, job.id, "layer")).status, 404); assert.equal((await getHandwritingAsset(own, job.id, "layer")).status, 200);
    const wrongOrigin = new Request(own.url, { method: "POST", headers: { ...Object.fromEntries(own.headers), origin: "https://other.test" } }); assert.equal((await cancelHandwritingJob(wrongOrigin, job.id)).status, 403);
    await store.cancel(job.id, owner); assert.equal((await getHandwritingAsset(own, job.id, "layer")).status, 410);
    const response = await getHandwritingJob(own, job.id); assert.equal((await response.json()).state, "canceled");
  } finally { if (previous === undefined) delete process.env.ARTDUO_STATE_DIR; else process.env.ARTDUO_STATE_DIR = previous; rmSync(dir, { recursive: true, force: true }); }
});

test("canceling during an uncertain submission preserves its upstream ID and stops late results", async () => {
  const dir = root(); let release!: () => void, submitted!: () => void;
  const started = new Promise<void>(resolve => { submitted = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  let cancellations = 0;
  const api = new InkoClient({ base: "https://inko.test/v1", key: "test" }, (async (url: string) => {
    if (url.includes("/styles")) return Response.json({ data: [{ code: 1, label: "No.001" }] });
    if (url.endsWith("/quote")) return Response.json({ ok: true, price: { list_cents: 0 }, errors: [] });
    if (url.endsWith("/layout")) return Response.json({ price: { list_cents: 0 }, pages: 1, unplaced: 0 });
    if (url.endsWith("/cancel")) { cancellations++; return Response.json({ status: "canceled" }); }
    submitted(); await gate; return Response.json({ id: "late-upstream", status: "queued" });
  }) as typeof fetch);
  try {
    const worker = new HandwritingWorker(dir, api); await worker.initialize();
    const job = await worker.store.create(owner, draft(), "stable-request-0001"); const running = worker.tick();
    await started; await worker.store.cancel(job.id, owner); release(); await running;
    const canceled = worker.store.read(job.id)!; assert.equal(canceled.state, "canceled"); assert.equal(canceled.upstreamId, "late-upstream"); assert.equal(canceled.cancelRequested, true);
    await worker.store.update(job.id, current => { current.nextAttemptAt = 0; }); await worker.tick();
    assert.equal(cancellations, 1); assert.equal(worker.store.read(job.id)?.cancelRequested, false); assert.equal(worker.store.read(job.id)?.layer, undefined);
  } finally { release(); rmSync(dir, { recursive: true, force: true }); }
});
