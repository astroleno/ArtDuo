// Replays recorded intent plans through stage selection and asks an independent
// model to judge whether each selected work offers what its stage asked for.
// Usage: pnpm --filter @artduo/web exec tsx scripts/stage-fit-eval.ts <label> [--no-judge]
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

const rootDir = path.resolve(__dirname, "../../..");
const label = process.argv[2] ?? "current";
const judgeEnabled = !process.argv.includes("--no-judge");
// A different model from the curation planner, so selection is not graded by itself.
const JUDGE_MODEL = process.argv.find((arg) => arg.startsWith("--judge="))?.slice(8) ?? "deepseek-v4-pro";
const rerankEnabled = process.argv.includes("--rerank");
// Replays plans in order as successive visitors, so earlier exhibitions count as recent exposure.
const recentEnabled = process.argv.includes("--recent");
const outDir = path.join(rootDir, ".cache", "stage-fit-eval");
const judgeCachePath = path.join(outDir, "judge-cache.json");

interface JudgedWork { artworkId: string; stage: number; fit: number; reason: string }
interface ExhibitionResult { query: string; stages: string[]; works: Array<{ artworkId: string; title: string; stage: number }>; judged?: JudgedWork[] }

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

async function judge(plan: CurationIntentPlan, works: Array<{ artwork: WebArtwork; stage: number }>, cache: Record<string, JudgedWork[]>): Promise<JudgedWork[] | undefined> {
  const key = createHash("sha256").update(JSON.stringify([JUDGE_MODEL, plan, works.map((work) => [work.artwork.id, work.stage])])).digest("hex");
  if (cache[key]) return cache[key];
  const config = readCurationChatConfig(rootDir);
  if (!config) return undefined;
  // Evaluation calls stay out of the visitor quota ledger.
  const stream = createCurationChatStream({ ...config, model: JUDGE_MODEL, rootDir: undefined });
  let text = "";
  for (let attempt = 1; ; attempt++) {
    try {
      text = "";
      for await (const chunk of stream(judgeMessages(plan, works), { json: true, timeoutMs: 120_000, maxTokens: 2400 })) text += chunk;
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

async function main(): Promise<void> {
  const catalog = loadWebReleaseCatalog({ rootDir });
  const plans = JSON.parse(readFileSync(path.join(__dirname, "../test/fixtures/stage-fit-plans.json"), "utf8")) as Record<string, unknown>;
  const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest,
    artworks: catalog.artworkRecords.map((artwork) => ({ id: artwork.id, text: semanticArtworkText({ ...artwork.metadata, description: artwork.metadata.descriptionClean ?? artwork.metadata.storySnippet }) })) });
  if (!index) throw new Error("Semantic index unavailable");
  const encoder = createLocalSemanticEncoder({ rootDir });
  mkdirSync(outDir, { recursive: true });
  const cache: Record<string, JudgedWork[]> = existsSync(judgeCachePath) ? JSON.parse(readFileSync(judgeCachePath, "utf8")) : {};
  const results: ExhibitionResult[] = [];
  const rerankMs: number[] = [];
  for (const [query, rawPlan] of Object.entries(plans)) {
    const plan = parseCurationIntentPlan(rawPlan);
    const queries = await encoder.embedQueries(plan.stages.map((stage) => stage.query));
    const recentExposure = new Map<string, number>();
    if (recentEnabled) for (const earlier of results.slice(-40)) for (const work of earlier.works) recentExposure.set(work.artworkId, (recentExposure.get(work.artworkId) ?? 0) + 1);
    const selection = selectForCurationStages({ catalog, query, plan, semantic: { index, queries }, recentExposure });
    let assignments = selection.assignments;
    if (rerankEnabled && selection.stagePools) {
      const config = readCurationChatConfig(rootDir)!;
      const started = Date.now();
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          assignments = await requestStageRerank({ catalog, plan, assignments, pools: selection.stagePools, stream: createCurationChatStream({ ...config, rootDir: undefined }), timeoutMs: 10_000 }) ?? assignments;
          break;
        } catch { await new Promise((resolve) => setTimeout(resolve, attempt * 3000)); }
      }
      rerankMs.push(Date.now() - started);
    }
    const works = assignments.map((item) => ({ artwork: catalog.artworkById.get(item.artworkId)!, stage: item.stageIndex }));
    const judged = judgeEnabled && works.length ? await judge(plan, works, cache) : undefined;
    results.push({ query, stages: plan.stages.map((stage) => stage.label),
      works: works.map(({ artwork, stage }) => ({ artworkId: artwork.id, title: artwork.title, stage })), judged });
    writeFileSync(judgeCachePath, JSON.stringify(cache));
  }
  const fits = results.flatMap((result) => result.judged ?? []);
  const uses = new Map<string, number>();
  for (const work of results.flatMap((result) => result.works)) uses.set(work.artworkId, (uses.get(work.artworkId) ?? 0) + 1);
  const total = [...uses.values()].reduce((sum, value) => sum + value, 0);
  const summary = {
    label, judge: JUDGE_MODEL, exhibitions: results.length, works: total,
    rerankMs: rerankMs.length ? { median: rerankMs.sort((a, b) => a - b)[Math.floor(rerankMs.length / 2)], max: Math.max(...rerankMs) } : undefined,
    meanFit: fits.length ? Number((fits.reduce((sum, item) => sum + item.fit, 0) / fits.length).toFixed(2)) : undefined,
    misfitShare: fits.length ? Number((fits.filter((item) => item.fit <= 2).length / fits.length).toFixed(3)) : undefined,
    distinctShare: Number((uses.size / Math.max(1, total)).toFixed(3)),
    mostRepeated: [...uses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => `${catalog.artworkById.get(id)?.title} ×${count}`),
  };
  writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify({ summary, results }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  for (const result of results) {
    const misfits = (result.judged ?? []).filter((item) => item.fit <= 2);
    if (misfits.length) console.log(`- ${result.query.slice(0, 28)}… ${misfits.map((item) => `[${result.stages[item.stage]}] ${catalog.artworkById.get(item.artworkId)?.title} fit${item.fit}: ${item.reason}`).join("; ")}`);
  }
}

void main();
