// Replays recorded intent plans through stage selection and asks an independent
// model to judge whether each selected work offers what its stage asked for.
// Freeze one replay with --rerank --recent --no-judge, then use --judge-from=<label>
// with each --judge=<model> to grade the same stage assignments.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCurationIntentPlan, type CurationIntentPlan } from "@artduo/contracts";
import { createLocalSemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { semanticArtworkText } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { createCurationChatStream, readCurationChatConfig } from "../../api/src/services/curation/chat-provider";
import { loadWebReleaseCatalog, type WebArtwork } from "../lib/release-catalog";
import { selectForCurationStages } from "../lib/semantic-selection";
import { requestStageRerank } from "../lib/stage-rerank";
import { refineAfterglow } from "../lib/afterglow-selection";
import { withCurationVisualCorrections } from "../lib/curation-visual-corrections";
import { artworkOffering } from "../lib/artwork-offering";
import { affectReadingPath } from "../lib/artwork-affect-reading";
import { compareCurvePositions, measureCurves, type CurveExhibition } from "./curve-metrics";
import { readTrackedCurveFixture, sha256, TRACKED_REPLAY_LABEL } from "./stage-fit-curve-fixture";
import { STAGE_VECTOR_PARAMETERS } from "../lib/stage-vector-experiment";
import { rankingExperiment, type VectorEvaluationName } from "./stage-vector-evaluation";
import { tryStageOrder } from "./stage-order-experiment";

const rootDir = path.resolve(__dirname, "../../..");
const label = process.argv[2] ?? "current";
const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const judgeEnabled = !process.argv.includes("--no-judge");
// A different model from the curation planner, so selection is not graded by itself.
const JUDGE_MODEL = option("judge") ?? "deepseek-v4-pro";
const judgeFrom = option("judge-from");
const rerankEnabled = process.argv.includes("--rerank");
// Replays plans in order as successive visitors, so earlier exhibitions count as recent exposure.
const recentEnabled = process.argv.includes("--recent");
const requestedRanking = option("ranking");
const observationIndex = option("observation-index");
const orderExperiment = process.argv.includes("--stage-order-experiment");
const compareFrom = option("compare-from");
const outDir = path.join(rootDir, ".cache", "stage-fit-eval");
const judgeCachePath = path.join(outDir, "judge-cache.json");

interface JudgedWork { artworkId: string; stage: number; fit: number; reason: string }
type RerankRun = { status: "accepted" | "rejected" | "failed"; ms: number };
type ReplayWork = { artworkId: string; title: string; stage: number };
interface ExhibitionResult {
  query: string; stages: string[]; works: ReplayWork[]; seedWorks?: ReplayWork[];
  selectionMode?: "rules" | "model"; rerank?: RerankRun; judged?: JudgedWork[];
  ordering?: Omit<ReturnType<typeof tryStageOrder>, "assignments">;
}

function artworkBrief(artwork: WebArtwork): string {
  return JSON.stringify({
    id: artwork.id, title: artwork.title, artist: artwork.artistDisplayName, year: artwork.yearLabel, medium: artwork.medium,
    observed: artwork.visualEvidence?.observation?.slice(0, 260), moods: artwork.moodTags, subjects: artwork.subjectTags.slice(0, 6),
  });
}

function judgeMessages(plan: CurationIntentPlan, works: Array<{ artwork: WebArtwork; stage: number }>) {
  return [
    { role: "system" as const, content: "你是严格的展览评审。只依据给出的阶段要求和作品资料判断，不迎合，不补充资料中没有的事实。只输出 JSON。" },
    { role: "user" as const, content: [
      `观众原话：${JSON.stringify(plan.desiredExperience)}`,
      "阶段（数值0–1表示该阶段希望作品提供的感受：valence愉悦、arousal唤醒、tension紧张、wonder惊奇、intimacy亲密）：",
      ...plan.stages.map((stage, index) => `stage ${index}: ${JSON.stringify({ label: stage.label, role: stage.role, want: stage.query, signals: stage.signals,
        valence: stage.valence, arousal: stage.arousal, tension: stage.tension, wonder: stage.wonder, intimacy: stage.intimacy })}`),
      "作品与其被分配的阶段：",
      ...works.map(({ artwork, stage }) => `stage ${stage} <- ${artworkBrief(artwork)}`),
      "对每件作品打 fit 1–5：5=明显提供该阶段要的感受与画面；3=勉强相关；1=与该阶段相反或明显不合。reason 不超过30字。",
      "输出 {\"works\":[{\"artworkId\":string,\"fit\":integer,\"reason\":string}]}",
    ].join("\n") },
  ];
}

async function judge(plan: CurationIntentPlan, works: Array<{ artwork: WebArtwork; stage: number }>, cache: Record<string, JudgedWork[]>): Promise<JudgedWork[]> {
  const messages = judgeMessages(plan, works);
  const key = createHash("sha256").update(JSON.stringify([JUDGE_MODEL, messages])).digest("hex");
  if (cache[key]) return cache[key];
  const config = readCurationChatConfig(rootDir);
  if (!config) throw new Error("Judge provider unavailable");
  // Evaluation calls stay out of the visitor quota ledger.
  const stream = createCurationChatStream({ ...config, model: JUDGE_MODEL, rootDir: undefined });
  let text = "";
  for (let attempt = 1; ; attempt++) {
    try {
      text = "";
      for await (const chunk of stream(messages, { json: true, timeoutMs: 120_000, maxTokens: 2400 })) text += chunk;
      break;
    } catch (error) {
      if (attempt >= 8) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
  const parsed = JSON.parse(text) as { works?: Array<{ artworkId?: string; fit?: number; reason?: string }> };
  const judged = works.map(({ artwork, stage }) => {
    const row = parsed.works?.find((item) => item.artworkId === artwork.id);
    const fit = Number(row?.fit);
    if (!Number.isInteger(fit) || fit < 1 || fit > 5) throw new Error(`Judge omitted ${artwork.id}`);
    return { artworkId: artwork.id, stage, fit, reason: String(row?.reason ?? "").slice(0, 60) };
  });
  cache[key] = judged;
  return judged;
}

function validateFrozenReplay(results: ExhibitionResult[], plans: Record<string, unknown>, hasArtwork: (id: string) => boolean) {
  const queries = Object.keys(plans);
  if (results.length !== queries.length || results.some(({ query, stages, works, seedWorks, selectionMode }, index) => {
    if (query !== queries[index]) return true;
    const plan = parseCurationIntentPlan(plans[query]);
    const validRoute = (route: ReplayWork[]) => Array.isArray(route) && route.length <= plan.artworkCount
      && new Set(route.map(work => work.artworkId)).size === route.length
      && route.every((work, i) => hasArtwork(work.artworkId) && Number.isInteger(work.stage) && plan.stages[work.stage]
        && (i === 0 || work.stage >= route[i - 1]!.stage));
    return JSON.stringify(stages) !== JSON.stringify(plan.stages.map((stage) => stage.label))
      || !validRoute(works) || seedWorks !== undefined && (!validRoute(seedWorks) || seedWorks.length !== works.length)
      || selectionMode !== undefined && selectionMode !== "rules" && selectionMode !== "model";
  })) throw new Error("Frozen replay does not match the fixed exhibition plans");
}

function readFrozenReplay(catalog: ReturnType<typeof loadWebReleaseCatalog>, plans: Record<string, unknown>, fixtureSha256: string, source = judgeFrom) {
  if (!source) return undefined;
  const raw = readFileSync(path.join(outDir, `${source}.json`));
  const { summary, results } = JSON.parse(raw.toString()) as { summary: { releaseVersion?: string; fixtureSha256?: string }; results: ExhibitionResult[] };
  if (summary.releaseVersion && summary.releaseVersion !== catalog.releaseVersion) throw new Error("Frozen replay belongs to a different release");
  if (summary.fixtureSha256 && summary.fixtureSha256 !== fixtureSha256) throw new Error("Frozen replay uses different stage fixtures");
  validateFrozenReplay(results, plans, id => catalog.artworkById.has(id));
  return { sourceReplaySha256: sha256(raw),
    results: results.map(({ query, stages, works, seedWorks, selectionMode, rerank }) => ({ query, stages, works, seedWorks, selectionMode, rerank })) };
}

async function replay(catalog: ReturnType<typeof loadWebReleaseCatalog>, plans: Record<string, unknown>, rawCatalog = catalog) {
  const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest,
    artworks: catalog.artworkRecords.map((artwork) => ({ id: artwork.id, text: semanticArtworkText({ ...artwork.metadata, description: artwork.metadata.descriptionClean ?? artwork.metadata.storySnippet }) })) });
  if (!index) throw new Error("Semantic index unavailable");
  const config = rerankEnabled ? readCurationChatConfig(rootDir) : undefined;
  if (rerankEnabled && !config) throw new Error("Rerank provider unavailable");
  const stream = config && createCurationChatStream({ ...config, rootDir: undefined });
  const ranking = requestedRanking ? rankingExperiment(requestedRanking as VectorEvaluationName, observationIndex, rawCatalog, index) : undefined;
  const encoder = createLocalSemanticEncoder({ rootDir, allowDownload: false });
  const results: ExhibitionResult[] = [];
  try {
    for (const [query, rawPlan] of Object.entries(plans)) {
      const plan = parseCurationIntentPlan(rawPlan);
      const queries = await encoder.embedQueries(plan.stages.map((stage) => stage.query));
      const recentExposure = new Map<string, number>();
      if (recentEnabled) for (const earlier of results.slice(-40)) for (const work of earlier.works) recentExposure.set(work.artworkId, (recentExposure.get(work.artworkId) ?? 0) + 1);
      const selection = selectForCurationStages({ catalog, query, plan, semantic: { index, queries }, recentExposure, rankingExperiment: ranking?.experiment });
      let assignments = selection.assignments;
      let rerank: RerankRun | undefined;
      if (stream && selection.stagePools?.some((pool, stage) => pool.length > assignments.filter((item) => item.stageIndex === stage).length)) {
        const started = Date.now();
        try {
          const choice = await requestStageRerank({ catalog, plan, assignments, pools: selection.stagePools, stream, timeoutMs: 10_000 });
          if (choice.status !== "skip") rerank = { status: choice.status === "unavailable" ? "failed" : choice.status, ms: Date.now() - started };
          if (choice.status === "accepted") assignments = choice.assignments;
        } catch {
          rerank = { status: "failed", ms: Date.now() - started };
        }
      }
      const toWorks = (route: typeof assignments) => route.map((item) => ({ artworkId: item.artworkId,
        title: catalog.artworkById.get(item.artworkId)!.title, stage: item.stageIndex }));
      const seedWorks = toWorks(assignments);
      const ending = selection.stagePools && refineAfterglow({ catalog, query, plan, assignments, pools: selection.stagePools });
      const finale = ending ?? assignments;
      const order = orderExperiment && tryStageOrder({ query, plan, assignments: finale, modelOrdered: rerank?.status === "accepted",
        ruleReading: id => { const artwork = catalog.artworkById.get(id); return artwork && artworkOffering(artwork); } });
      const ordering = order ? { considered: order.considered, improved: order.improved,
        protectedOrder: order.protectedOrder, swap: order.swap } : undefined;
      results.push({ query, stages: plan.stages.map((stage) => stage.label), rerank, seedWorks,
        selectionMode: rerank?.status === "accepted" ? "model" : "rules", works: order ? toWorks(order.assignments) : ending ? toWorks(ending) : seedWorks, ordering });
    }
    return { results, ranking: requestedRanking ? { requested: requestedRanking, effective: ranking?.experiment?.variant ?? "baseline",
      fallback: ranking?.fallback, observation: ranking?.observation, parameters: STAGE_VECTOR_PARAMETERS } : undefined };
  } finally {
    await encoder.dispose();
  }
}

async function main(): Promise<void> {
  if (requestedRanking && (!["baseline", "bounded", "observation"].includes(requestedRanking) || judgeEnabled || judgeFrom || rerankEnabled)) {
    throw new Error("--ranking=baseline|bounded|observation is an offline live replay option and requires --no-judge without --rerank or --judge-from");
  }
  if (orderExperiment && (judgeEnabled || judgeFrom || rerankEnabled || requestedRanking && requestedRanking !== "baseline")) {
    throw new Error("--stage-order-experiment requires an offline baseline live replay with --no-judge");
  }
  if (compareFrom && (!/^[a-z0-9_-]+$/iu.test(compareFrom) || compareFrom === label || judgeEnabled || judgeFrom || rerankEnabled)) {
    throw new Error("--compare-from requires a different local replay label and --no-judge without --judge-from or --rerank");
  }
  const outputPath = path.resolve(outDir, `${label}.json`);
  if (judgeFrom && outputPath === path.resolve(outDir, `${judgeFrom}.json`)) throw new Error("Use a new label for the frozen replay report");
  const fixture = readFileSync(path.join(__dirname, "../test/fixtures/stage-fit-plans.json"), "utf8");
  const plans = JSON.parse(fixture) as Record<string, unknown>;
  const fixtureSha256 = sha256(fixture);
  const tracked = !judgeEnabled && judgeFrom === TRACKED_REPLAY_LABEL && !option("manifest")
    ? readTrackedCurveFixture(fixtureSha256, option("release")) : undefined;
  const rawCatalog = tracked ? undefined : loadWebReleaseCatalog({ rootDir, releaseVersion: option("release"), manifestPath: option("manifest") });
  const catalog = rawCatalog && withCurationVisualCorrections(rawCatalog);
  const releaseVersion = tracked?.source.releaseVersion ?? catalog!.releaseVersion;
  mkdirSync(outDir, { recursive: true });
  const frozen = catalog && readFrozenReplay(catalog, plans, fixtureSha256);
  let results: ExhibitionResult[];
  let ranking: Awaited<ReturnType<typeof replay>>["ranking"];
  if (tracked) {
    const queries = Object.keys(plans);
    if (tracked.routes.length !== queries.length) throw new Error("Frozen curve fixture does not match the plan count");
    results = tracked.routes.map((route, index) => {
      const query = queries[index]!;
      return { query, stages: parseCurationIntentPlan(plans[query]).stages.map(stage => stage.label), ...route };
    });
    validateFrozenReplay(results, plans, id => tracked.byId.has(id));
  } else {
    if (frozen) results = frozen.results;
    else ({ results, ranking } = await replay(catalog!, plans, rawCatalog));
  }
  if (judgeEnabled && catalog) {
    const cache: Record<string, JudgedWork[]> = existsSync(judgeCachePath) ? JSON.parse(readFileSync(judgeCachePath, "utf8")) : {};
    for (const result of results) {
      const works = result.works.map((work) => ({ artwork: catalog.artworkById.get(work.artworkId)!, stage: work.stage }));
      result.judged = works.length ? await judge(parseCurationIntentPlan(plans[result.query]), works, cache) : [];
      writeFileSync(judgeCachePath, JSON.stringify(cache));
    }
  }
  const fits = results.flatMap((result) => result.judged ?? []);
  const uses = new Map<string, number>();
  for (const work of results.flatMap((result) => result.works)) uses.set(work.artworkId, (uses.get(work.artworkId) ?? 0) + 1);
  const total = [...uses.values()].reduce((sum, value) => sum + value, 0);
  const reranks = results.flatMap((result) => result.rerank ? [result.rerank] : []);
  const rerankMs = reranks.map((run) => run.ms).sort((a, b) => a - b);
  const titles = new Map(results.flatMap(result => result.works.map(work => [work.artworkId, catalog?.artworkById.get(work.artworkId)?.title ?? work.title] as const)));
  const summary = {
    label, releaseVersion, fixtureSha256, judge: judgeEnabled ? JUDGE_MODEL : undefined, judgeFrom, exhibitions: results.length, works: total, ranking,
    orderingExperiment: orderExperiment ? { examined: results.reduce((sum, row) => sum + (row.ordering?.considered ?? 0), 0),
      improved: results.reduce((sum, row) => sum + (row.ordering?.improved ?? 0), 0),
      applied: results.filter(row => row.ordering?.swap).length, protected: results.filter(row => row.ordering?.protectedOrder).length } : undefined,
    rerank: reranks.length ? { attempted: reranks.length, accepted: reranks.filter((run) => run.status === "accepted").length,
      rejected: reranks.filter((run) => run.status === "rejected").length, failed: reranks.filter((run) => run.status === "failed").length,
      medianMs: rerankMs[Math.floor(rerankMs.length / 2)], maxMs: rerankMs.at(-1) } : undefined,
    meanFit: fits.length ? Number((fits.reduce((sum, item) => sum + item.fit, 0) / fits.length).toFixed(2)) : undefined,
    misfitShare: fits.length ? Number((fits.filter((item) => item.fit <= 2).length / fits.length).toFixed(3)) : undefined,
    distinctShare: Number((uses.size / Math.max(1, total)).toFixed(3)),
    mostRepeated: [...uses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => `${titles.get(id)} ×${count}`),
  };
  const ledger = affectReadingPath(rootDir, releaseVersion);
  const proxyModels = new Set<string>();
  const measuredRoutes = (replayed: ExhibitionResult[]): CurveExhibition[] => replayed.map((result, index) => {
    const plan = parseCurationIntentPlan(plans[result.query]);
    return { id: String(index + 1), requestedWorks: plan.artworkCount, slots: result.works.map(work => {
      const frozenWork = tracked?.byId.get(work.artworkId);
      const artwork = catalog?.artworkById.get(work.artworkId);
      const flash = artwork?.affectReading;
      if (flash && !["deepseek-flash", "deepseek-v4-flash"].includes(flash.model)) proxyModels.add(flash.model);
      return { artworkId: work.artworkId, stageIndex: work.stage, target: plan.stages[work.stage]!,
        readings: { rules: frozenWork?.rules ?? (artwork && artworkOffering(artwork)),
          flash: frozenWork?.flash ?? (flash && ["deepseek-flash", "deepseek-v4-flash"].includes(flash.model) ? flash : undefined) } };
    }) };
  });
  const curves = measuredRoutes(results);
  const pairedSource = compareFrom && catalog ? readFrozenReplay(catalog, plans, fixtureSha256, compareFrom) : undefined;
  const paired = pairedSource && { baseline: compareFrom, baselineSha256: pairedSource.sourceReplaySha256,
    ...compareCurvePositions(measuredRoutes(pairedSource.results), curves) };
  const input = {
    mode: tracked ? "tracked-frozen" : frozen ? "cached-frozen" : "replay",
    selectionModes: [...new Set(results.map(result => result.selectionMode ?? "unknown"))],
    ...(tracked?.source ?? {
      releaseVersion, fixtureSha256,
      sourceReplaySha256: frozen?.sourceReplaySha256,
      releaseManifestSha256: sha256(readFileSync(catalog!.manifestPath)),
      flashLedgerSha256: existsSync(ledger) ? sha256(readFileSync(ledger)) : undefined,
      flashLedgerVersion: catalog!.affectReadingVersion,
    }),
    excludedReadingModels: [...proxyModels].sort(),
    readings: { rules: "artworkOffering", flash: "DeepSeek Flash image readings; shares a model family with Flash judging" },
  };
  const curve = { input, ...measureCurves(curves), paired };
  writeFileSync(outputPath, JSON.stringify({ summary, results, curve }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  for (const result of results) {
    const misfits = (result.judged ?? []).filter((item) => item.fit <= 2);
    if (misfits.length) console.log(`- ${result.query.slice(0, 28)}… ${misfits.map((item) => `[${result.stages[item.stage]}] ${titles.get(item.artworkId)} fit${item.fit}: ${item.reason}`).join("; ")}`);
  }
}

void main();
