import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LOCAL_SEMANTIC_MODEL } from "@artduo/corpus/src/semantic-index";
import { fallbackCurationIntent, eligibleCurationArtworks, selectForCurationStages } from "../../lib/semantic-selection";
import { curateExhibition, readSavedCuration } from "../../lib/semantic-curator";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../lib/release-catalog";
import { matchesViewingIntent, parseViewingIntent } from "../../lib/viewing-intent";

const rootDir = path.resolve(__dirname, "../../../..");
const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-13-quality" });

test("casual defaults soften intense content while explicit titles remain eligible", () => {
  const base = { ...catalog.artworks[0]!, medium: "Oil on canvas" };
  const gentle = { ...base, id: "gentle", title: "Quiet still life", subjectTags: ["still life"], visualEvidence: undefined, visualEvidenceUnavailable: false };
  const heavy = { ...base, id: "heavy", title: "Crucifixion", subjectTags: ["death"], visualEvidence: undefined, visualEvidenceUnavailable: false };
  const fixture = { ...catalog, artworks: [heavy, gentle], artworkById: new Map([heavy, gentle].map(a => [a.id, a])) };
  const query = "心情还行", plan = { ...fallbackCurationIntent(fixture, query), artworkCount: 1 };
  const semantic = { index: { schemaVersion: 1 as const, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
    records: [heavy, gentle].map(a => ({ artworkId: a.id, textFingerprint: "fixture", vector: [1, 0] })) }, queries: plan.stages.map(() => [1, 0]) };
  assert.equal(selectForCurationStages({ catalog: fixture, query, plan, semantic }).assignments[0]!.artworkId, "gentle");
  assert.equal(selectForCurationStages({ catalog: fixture, query: "Crucifixion", plan, semantic }).assignments[0]!.artworkId, "heavy");
});

test("bright requests use actual pixels and still honor an explicit medium", () => {
  const base = { ...catalog.artworks[0]!, title: "Still life", subjectTags: ["still life"], visualEvidence: undefined, description: "Quiet arrangement", storySnippet: "" };
  const dark = { ...base, id: "dark", medium: "Oil on canvas", appearance: { meanLightness: .12, brightShare: 0, darkShare: .85, chroma: .05, colorVariation: .1 } };
  const bright = { ...base, id: "bright", medium: "Oil on canvas", appearance: { meanLightness: .68, brightShare: .65, darkShare: .02, chroma: .32, colorVariation: .8 } };
  const print = { ...bright, id: "print", medium: "Etching", appearance: { meanLightness: .9, brightShare: .9, darkShare: 0, chroma: 0, colorVariation: 0 } };
  const fixture = { ...catalog, artworks: [dark, bright, print], artworkById: new Map([dark, bright, print].map(a => [a.id, a])) };
  const query = "想看一幅明亮的油画", plan = { ...fallbackCurationIntent(fixture, query), artworkCount: 1 };
  const semantic = { index: { schemaVersion: 1 as const, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
    records: [dark, bright, print].map(a => ({ artworkId: a.id, textFingerprint: "fixture", vector: [1, 0] })) }, queries: plan.stages.map(() => [1, 0]) };
  assert.equal(selectForCurationStages({ catalog: fixture, query, plan, semantic }).assignments[0]!.artworkId, "bright");
  assert.equal(selectForCurationStages({ catalog: fixture, query: "想看一幅明亮的画", plan, semantic }).assignments[0]!.artworkId, "bright", "blank light paper must not outweigh actual colorful light");
  assert.equal(selectForCurationStages({ catalog: fixture, query: "想看一幅明亮的版画", plan, semantic }).assignments[0]!.artworkId, "print", "an explicit monochrome medium stays eligible");
});
test("every planned stage searches the full eligible pool before truncation", () => {
  const query = "quiet";
  const plan = { ...fallbackCurationIntent(catalog, query), artworkCount: 5 };
  const old = new Set(searchReleaseCatalog(catalog, query).results.map((item) => item.artwork.id));
  const beyond = eligibleCurationArtworks(catalog, query, plan).filter((artwork) => !old.has(artwork.id)).slice(0, plan.stages.length);
  assert.equal(beyond.length, plan.stages.length);
  const dimensions = plan.stages.length + 1;
  const unitVector = (position: number) => Array.from({ length: dimensions }, (_, index) => Number(index === position));
  const selected = selectForCurationStages({ catalog, query, plan, semantic: {
    index: { schemaVersion: 1, releaseVersion: catalog.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions },
      records: catalog.artworks.map((artwork) => ({ artworkId: artwork.id, textFingerprint: "fixture", vector: unitVector(beyond.findIndex((candidate) => candidate.id === artwork.id) + 1) })) },
    queries: plan.stages.map((_, index) => unitVector(index + 1)),
  } });
  assert.ok(beyond.every((artwork) => selected.assignments.some((assignment) => assignment.artworkId === artwork.id)));
  assert.equal(new Set(selected.assignments.map((item) => item.stageIndex)).size, plan.stages.length);
});

test("architectural requests prefer a building focus over a portrait's background building", () => {
  const query = "想看一幅建筑版画";
  const base = catalog.artworks[0];
  const portrait = { ...base, id: "portrait-background", title: "Portrait of a man", medium: "Etching", subjectTags: ["portrait"],
    visualEvidence: { ...base.visualEvidence!, facts: { architecture: "present" as const, portrait: "present" as const } } };
  for (const kind of ["title", "interior"] as const) {
    const building = { ...base, id: "building-focus", title: kind === "title" ? "Church Façade" : "Interiør", medium: "Etching", subjectTags: [],
      visualEvidence: { ...base.visualEvidence!, facts: { architecture: "present" as const, ...(kind === "interior" ? { interior: "present" as const } : {}) } } };
    const fixture = { ...catalog, artworks: [building, portrait], artworkById: new Map([building, portrait].map(art => [art.id, art])) };
    const plan = { ...fallbackCurationIntent(fixture, query), artworkCount: 1 };
    const selected = selectForCurationStages({ catalog: fixture, query, plan, semantic: {
      index: { schemaVersion: 1, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
        records: [{ artworkId: building.id, textFingerprint: "fixture", vector: [.99, Math.sqrt(1 - .99 ** 2)] },
          { artworkId: portrait.id, textFingerprint: "fixture", vector: [1, 0] }] },
      queries: plan.stages.map(() => [1, 0]),
    } });
    assert.equal(selected.assignments[0].artworkId, building.id, kind);
    assert.ok(selected.assignments[0].evidence.includes("focus:architecture"));
  }
});
test("hard exclusions, explicit authors and short results survive stage planning", () => {
  for (const query of ["不要森林，想看海", "不想看莫奈，想看水面", "想看莫奈", "想看静物", "难过，想看战争绘画", "Water Lilies"]) {
    const plan = fallbackCurationIntent(catalog, query);
    const selected = selectForCurationStages({ catalog, query, plan });
    const eligible = eligibleCurationArtworks(catalog, query, plan);
    assert.equal(selected.search.results.length, Math.min(plan.artworkCount, eligible.length));
    assert.ok(selected.search.results.every((item) => matchesViewingIntent(item.artwork, parseViewingIntent(query))));
    assert.equal(new Set(selected.assignments.map((item) => item.artworkId)).size, selected.assignments.length);
  }
  const titlePlan = fallbackCurationIntent(catalog, "Water Lilies");
  assert.ok(selectForCurationStages({ catalog, query: "Water Lilies", plan: titlePlan }).search.results.every((item) => item.artwork.title === "Water Lilies"));
  const plan = fallbackCurationIntent(catalog, "只看三幅安静的画");
  assert.equal(plan.artworkCount, 3);
  assert.equal(selectForCurationStages({ catalog, query: "只看三幅安静的画", plan }).search.results.length, 3);
});

test("a hand-focused portrait request ranks observed hands without relaxing any subject or medium", () => {
  const query = "想看一幅肖像版画，重点看手势";
  const base = catalog.artworks[0];
  const bust = { ...base, id: "portrait-bust", title: "Bust portrait", medium: "Etching", subjectTags: ["portrait"],
    visualEvidence: { ...base.visualEvidence!, observation: "人物头像与衣领由细线描绘。", facts: { portrait: "present" as const } } };
  const hands = { ...bust, id: "portrait-hands", title: "Seated portrait", visualEvidence: { ...bust.visualEvidence, observation: "人物用手托着头，面部刻线较密。" } };
  const fixture = { ...catalog, artworks: [bust, hands], artworkById: new Map([bust, hands].map(a => [a.id, a])) };
  const plan = { ...fallbackCurationIntent(fixture, query), artworkCount: 1 };
  const semantic = { index: { schemaVersion: 1 as const, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
    records: [{ artworkId: bust.id, textFingerprint: "fixture", vector: [1, 0] }, { artworkId: hands.id, textFingerprint: "fixture", vector: [.99, Math.sqrt(1 - .99 ** 2)] }] }, queries: plan.stages.map(() => [1, 0]) };
  const selection = selectForCurationStages({ catalog: fixture, query, plan, semantic });
  assert.equal(selection.assignments[0].artworkId, hands.id);
  assert.ok(selection.assignments[0].evidence.includes("focus:hands"));
  assert.equal(selectForCurationStages({ catalog: fixture, query: `${query}，不要人物`, plan, semantic }).assignments.length, 0);
});

test("concrete stage wishes rank matching interiors and open views before slightly closer generic vectors", () => {
  const base = catalog.artworks[0];
  const interior = { ...base, id: "room", title: "Room", medium: "Oil on canvas", visualEvidence: { ...base.visualEvidence!, facts: { interior: "present" as const }, spatialFraming: "enclosed" as const } };
  const vista = { ...base, id: "vista", title: "Distant View", medium: "Oil on canvas", visualEvidence: { ...base.visualEvidence!, facts: { interior: "absent" as const }, spatialFraming: "open" as const } };
  const still = { ...base, id: "still", title: "Still Life", medium: "Oil on canvas", visualEvidence: { ...base.visualEvidence!, facts: { interior: "absent" as const }, spatialFraming: "enclosed" as const } };
  const fixture = { ...catalog, artworks: [interior, vista, still], artworkById: new Map([interior, vista, still].map(a => [a.id, a])) };
  const plan = { ...fallbackCurationIntent(fixture, "想看两幅作品"), artworkCount: 2 };
  plan.stages = [ { ...plan.stages[0], query: "quiet empty interior room" }, plan.stages[1], { ...plan.stages.at(-1)!, query: "open distant landscape, wide horizon" } ];
  const semantic = { index: { schemaVersion: 1 as const, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
    records: [interior, vista, still].map(a => ({ artworkId: a.id, textFingerprint: "fixture", vector: a.id === "still" ? [1, 0] : [.99, Math.sqrt(1 - .99 ** 2)] })) }, queries: plan.stages.map(() => [1, 0]) };
  const result = selectForCurationStages({ catalog: fixture, query: "想看两幅作品", plan, semantic });
  assert.deepEqual(result.assignments.map(a => a.artworkId), ["room", "vista"]);
  assert.ok(result.assignments[0].evidence.includes("stage-subject:interior"));
  assert.ok(result.assignments[1].evidence.includes("stage-space:open"));
});
test("provider failure freezes a valid fallback and saved links never regenerate or change query", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-curation-"));
  try {
    let calls = 0;
    const query = "不要森林，想看海";
    const input = { catalog, rootDir: temporary, query, stream: async function* () { calls++; throw new Error("provider timeout"); } };
    const result = await curateExhibition(input);
    assert.deepEqual(result.record.degraded, ["intent-unavailable", "semantic-unavailable"]);
    const restored = await curateExhibition({ ...input, curationId: result.curationId });
    assert.equal(calls, 1);
    assert.deepEqual(restored.assignments, result.assignments);
    assert.throws(() => readSavedCuration(catalog, result.curationId, "different", temporary));
    await assert.rejects(curateExhibition({ ...input, curationId: "f".repeat(64) }));
    assert.equal(calls, 1);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("intent finishes before stage retrieval and a stalled encoder has a bounded fallback", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-intent-order-"));
  const semanticCatalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-14-semantic" });
  const query = "希望可以缓口气";
  const plan = fallbackCurationIntent(semanticCatalog, query);
  let releaseIntent!: () => void, started!: () => void;
  const ready = new Promise<void>((resolve) => { releaseIntent = resolve; });
  const entered = new Promise<void>((resolve) => { started = resolve; });
  let retrievals = 0;
  const encoder = { model: LOCAL_SEMANTIC_MODEL, async warmup() {}, async dispose() {}, async embedDocuments() { return []; },
    async embedQueries(texts: string[]) { retrievals++; return texts.map(() => [1, ...Array(383).fill(0)]); } };
  try {
    const pending = curateExhibition({ catalog: semanticCatalog, rootDir: temporary, query, encoder, intentModel: "fixture",
      stream: async function* () { started(); await ready; yield JSON.stringify(plan); } });
    await entered;
    assert.equal(retrievals, 0);
    releaseIntent();
    const result = await pending;
    assert.equal(retrievals, 1);
    assert.deepEqual(result.record.degraded, []);
    const timeout = await curateExhibition({ catalog: semanticCatalog, rootDir: temporary, query: `${query}，慢一点`, retrievalTimeoutMs: 5,
      stream: async function* () { yield JSON.stringify(plan); }, encoder: { ...encoder, warmup: () => new Promise<void>(() => {}) } });
    assert.deepEqual(timeout.record.degraded, ["semantic-unavailable"]);
    assert.equal(timeout.record.retrievalModel, "local-hash-embedding-v1");
    assert.equal(retrievals, 1);
  } finally { releaseIntent(); rmSync(temporary, { recursive: true, force: true }); }
});

test("new visual evidence invalidates request reuse without replacing a saved selection", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-evidence-cache-"));
  const semanticCatalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-14-semantic" });
  const query = "安静的风景";
  const plan = fallbackCurationIntent(semanticCatalog, query);
  let calls = 0;
  const encoder = { model: LOCAL_SEMANTIC_MODEL, async warmup() {}, async dispose() {}, async embedDocuments() { return []; },
    async embedQueries(texts: string[]) { return texts.map(() => [1, ...Array(383).fill(0)]); } };
  const input = { rootDir: temporary, query, encoder, intentModel: "fixture",
    stream: async function* (messages: Array<{ content: string }>) {
      // Stage choice is a separate call; this test counts intent planning only.
      if (messages[0]!.content.includes("选画编辑")) { yield "{}"; return; }
      calls++; yield JSON.stringify(plan);
    } };
  try {
    const firstCatalog = { ...semanticCatalog, visualEvidenceVersion: "review-one" };
    const first = await curateExhibition({ ...input, catalog: firstCatalog });
    assert.deepEqual(first.record.degraded, []);
    assert.equal((await curateExhibition({ ...input, catalog: firstCatalog })).curationId, first.curationId);
    assert.equal(calls, 1);

    const nextCatalog = { ...semanticCatalog, visualEvidenceVersion: "review-two" };
    const next = await curateExhibition({ ...input, catalog: nextCatalog });
    assert.notEqual(next.curationId, first.curationId);
    assert.equal(next.record.visualEvidenceVersion, "review-two");
    assert.equal(calls, 2);
    const saved = readSavedCuration(nextCatalog, first.curationId, query, temporary);
    assert.equal(saved.curationId, first.curationId);
    assert.deepEqual(saved.assignments, first.assignments);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("figurative stage words do not become depicted subjects", () => {
  const base = catalog.artworks[0];
  const evidence = (interior: "present" | "absent", spatialFraming: "open" | "enclosed", architecture: "present" | "absent" = "absent") =>
    ({ ...base.visualEvidence!, facts: { interior, architecture }, spatialFraming });
  const bedroom = { ...base, id: "bedroom", title: "Bedroom", medium: "Oil on canvas", moodTags: ["quiet"], visualEvidence: evidence("present", "enclosed") };
  const nave = { ...base, id: "nave", title: "Church Nave", medium: "Oil on canvas", moodTags: ["quiet"], visualEvidence: evidence("present", "enclosed", "present") };
  const vista = { ...base, id: "vista", title: "Distant View", medium: "Oil on canvas", moodTags: ["quiet"], visualEvidence: evidence("absent", "open") };
  const dawn = { ...base, id: "dawn", title: "Dawn Field", medium: "Oil on canvas", moodTags: ["quiet"], visualEvidence: evidence("absent", "open") };
  const works = [bedroom, nave, vista, dawn];
  const fixture = { ...catalog, artworks: works, artworkById: new Map(works.map(a => [a.id, a])) };
  const plan = { ...fallbackCurationIntent(fixture, "想看两幅作品"), artworkCount: 2 };
  plan.stages = [
    { ...plan.stages[0], query: "wide landscape with distant horizon, calm open space, quiet breathing room" },
    plan.stages[1],
    { ...plan.stages.at(-1)!, query: "small patch of warm light, dawn glow or single lit window, modest hopeful atmosphere" },
  ];
  // Enclosed rooms are marginally closer in text; the stage wording must not reward them as subjects.
  const vector = (id: string) => ["bedroom", "nave"].includes(id) ? [1, 0] : [.99, Math.sqrt(1 - .99 ** 2)];
  const semantic = { index: { schemaVersion: 1 as const, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
    records: works.map(a => ({ artworkId: a.id, textFingerprint: "fixture", vector: vector(a.id) })) }, queries: plan.stages.map(() => [1, 0]) };
  const result = selectForCurationStages({ catalog: fixture, query: "想看两幅作品", plan, semantic });
  assert.ok(["vista", "dawn"].includes(result.assignments[0]!.artworkId), "an open-landscape stage prefers an open view over a bedroom");
  assert.ok(!result.assignments.some(a => a.evidence.includes("stage-subject:interior") || a.evidence.includes("stage-subject:architecture")));
});

test("stages are filled jointly so one stage cannot take another stage's clearest work", () => {
  const base = catalog.artworks[0];
  const plain = { ...base, medium: "Oil on canvas", visualEvidence: undefined, appearance: undefined, emotionLabels: [], colorTags: [] };
  const festive = { ...plain, id: "festive", title: "Dancers", moodTags: ["joy", "lively", "playful"] };
  const sunny = { ...plain, id: "sunny", title: "Field", moodTags: ["bright", "warm"] };
  const calm = { ...plain, id: "calm", title: "Pond", moodTags: ["quiet", "serenity"] };
  const works = [festive, sunny, calm];
  const fixture = { ...catalog, artworks: works, artworkById: new Map(works.map(a => [a.id, a])) };
  const plan = { ...fallbackCurationIntent(fixture, "想看三幅作品"), artworkCount: 3 };
  const stage = (index: number, values: object, signals: string[]) => ({ ...plan.stages[Math.min(index, plan.stages.length - 1)]!, ...values, signals, query: "painting" });
  plan.stages = [
    stage(0, { valence: .75, arousal: .5, tension: .1, wonder: .4, intimacy: .4 }, ["light"]),
    stage(1, { valence: .92, arousal: .9, tension: .15, wonder: .5, intimacy: .4 }, ["joy", "celebration"]),
    { ...plan.stages.at(-1)!, valence: .55, arousal: .15, tension: .1, wonder: .3, intimacy: .5, signals: ["quiet"], query: "painting" },
  ];
  // Sequential greedy filling would hand the dancers to the first stage.
  const vector = (id: string) => id === "festive" ? [1, 0] : id === "sunny" ? [.995, Math.sqrt(1 - .995 ** 2)] : [.99, Math.sqrt(1 - .99 ** 2)];
  const semantic = { index: { schemaVersion: 1 as const, releaseVersion: fixture.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 2 },
    records: works.map(a => ({ artworkId: a.id, textFingerprint: "fixture", vector: vector(a.id) })) }, queries: plan.stages.map(() => [1, 0]) };
  const result = selectForCurationStages({ catalog: fixture, query: "想看三幅作品", plan, semantic });
  assert.deepEqual(result.assignments.map(a => [a.stageIndex, a.artworkId]), [[0, "sunny"], [1, "festive"], [2, "calm"]]);
});

test("a valid model stage choice is saved, and a failed one keeps the deterministic selection", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-stage-choice-"));
  const semanticCatalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-14-semantic" });
  const query = "安静的风景";
  const plan = { ...fallbackCurationIntent(semanticCatalog, query), artworkCount: 3 };
  const encoder = { model: LOCAL_SEMANTIC_MODEL, async warmup() {}, async dispose() {}, async embedDocuments() { return []; },
    async embedQueries(texts: string[]) { return texts.map(() => [1, ...Array(383).fill(0)]); } };
  let pools: string[][] = [];
  const choose = async function* (messages: Array<{ content: string }>) {
    if (!messages[0]!.content.includes("选画编辑")) { yield JSON.stringify(plan); return; }
    // Pick the last candidate listed for every stage, never repeating a work.
    pools = messages[1]!.content.split(/\nstage \d+ /u).slice(1).map((block) => [...block.matchAll(/"id":"([^"]+)"/gu)].map((match) => match[1]!));
    const used = new Set<string>();
    yield JSON.stringify({ stages: pools.map((ids, stage) => {
      const count = Number(/^选 (\d+) 件/u.exec(messages[1]!.content.split(/\nstage \d+ /u)[stage + 1]!)![1]);
      const picked = [...ids].reverse().filter((id) => !used.has(id)).slice(0, count);
      picked.forEach((id) => used.add(id));
      return { stage, artworkIds: picked };
    }) });
  };
  try {
    const chosen = await curateExhibition({ catalog: semanticCatalog, query, rootDir: temporary, encoder, intentModel: "fixture", stream: choose });
    assert.deepEqual(chosen.record.degraded, []);
    assert.ok(chosen.assignments.every((item) => item.evidence.includes("model:stage-fit")));
    assert.ok(chosen.assignments.every((item) => pools[item.stageIndex]!.includes(item.artworkId)));
    assert.deepEqual(readSavedCuration(semanticCatalog, chosen.curationId, query, temporary).assignments, chosen.assignments);

    const failing = async function* (messages: Array<{ content: string }>) {
      if (messages[0]!.content.includes("选画编辑")) throw new Error("provider timeout");
      yield JSON.stringify(plan);
    };
    const kept = await curateExhibition({ catalog: semanticCatalog, query: `${query}。`, rootDir: temporary, encoder, intentModel: "fixture", stream: failing });
    assert.deepEqual(kept.record.degraded, ["stage-choice-unavailable"]);
    assert.ok(kept.assignments.length > 0 && kept.assignments.every((item) => !item.evidence.includes("model:stage-fit")));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
