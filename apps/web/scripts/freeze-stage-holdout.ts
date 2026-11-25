// This authoring step reads verified public artwork evidence. It never calls the selector or ranks candidates.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadWebReleaseCatalog } from "../lib/release-catalog";
import { HOLDOUT_DESIGN, holdoutPlan } from "./stage-holdout-design";
import { judge, verifiedHoldoutArtwork } from "./stage-holdout-evidence";

const releaseVersion = "2026-11-19-open-gap-739";
const seed = "artduo-stage-holdout-20261125-v1";
const rootDir = path.resolve(__dirname, "../../..");
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function bigrams(text: string): Set<string> {
  const clean = text.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}]/gu, "");
  return new Set(Array.from(clean).slice(1).map((character, index) => clean[index] + character));
}
function similarity(a: Set<string>, b: Set<string>): number {
  return [...a].filter(key => b.has(key)).length / new Set([...a, ...b]).size;
}

const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion });
const earlierPlans = readFileSync(path.join(__dirname, "../test/fixtures/stage-fit-plans.json"));
const earlierQueries = Object.keys(JSON.parse(earlierPlans.toString()) as Record<string, unknown>);
const maximumOldSimilarity = Math.max(...HOLDOUT_DESIGN.flatMap(({ query }) => earlierQueries.map(old => similarity(bigrams(query), bigrams(old)))));
if (maximumOldSimilarity >= .5) throw new Error("Synthetic request overlaps the tuned fixtures");
const reviewPath = path.join(catalog.releaseDir, "visual-reviews.json");
const universe = catalog.artworks.filter(verifiedHoldoutArtwork);
if (!universe.length || HOLDOUT_DESIGN.length !== 30) throw new Error("Missing release evidence or holdout design");

const cases = HOLDOUT_DESIGN.map(item => {
  const plan = holdoutPlan(item);
  const stageIndexes = plan.stages.map((_, index) => index);
  const candidates = universe.map(artwork => ({ artwork, verdict: judge(artwork, item.criteria),
    draw: hash(`${seed}:\n${item.id}:\n${artwork.id}`) })).sort((a, b) => a.draw.localeCompare(b.draw));
  const selected = (["positive", "negative", "unknown"] as const).flatMap((label, index) =>
    candidates.filter(candidate => candidate.verdict.label === label).slice(0, [4, 2, 2][index]!));
  const picked = new Set(selected.map(item => item.artwork.id));
  const fill = candidates.filter(candidate => !picked.has(candidate.artwork.id) && candidate.verdict.label !== "positive").slice(0, 8 - selected.length);
  const samples = [...selected, ...fill].sort((a, b) => a.draw.localeCompare(b.draw)).map(({ artwork, verdict }) => ({
    artworkId: artwork.id, imageSha256: artwork.visualEvidence!.imageSha256, stageIndexes, ...verdict,
  }));
  if (samples.length !== 8) throw new Error(`Case ${item.id} does not have eight references`);
  return { id: item.id, stratum: item.stratum, query: item.query, criteria: item.criteria, plan, samples };
});

process.stdout.write(JSON.stringify({
  schemaVersion: 1, releaseVersion, seed,
  releaseManifestSha256: hash(readFileSync(catalog.manifestPath)),
  visualLedgerSha256: hash(readFileSync(reviewPath)),
  visualEvidenceVersion: catalog.visualEvidenceVersion,
  tunedPlansSha256: hash(earlierPlans), maximumOldQueryBigramJaccard: Number(maximumOldSimilarity.toFixed(3)),
  method: {
    requests: "代理独立编写 30 条合成请求；没有真实访客输入。先按主题、限制及边界案例设计，再以去标点双字组合 Jaccard 与旧 25 条比较；没有读取留出产出的排序。",
    sampling: "限发布版允许展出的本地核验图像。各请求对 seed、请求 ID 和作品 ID 作 SHA-256，按字符串排序后抽至多 4 个正例、2 个确证负例、2 个不确定；不足优先从未抽中的负例或不确定补满 8 件。此为按证据分层样本。",
    labels: "代理预先定义独立核验事实、馆藏媒材及同图观察规则，按条执行并审查观察措辞。没有明确依据归为不确定。同一场的三段固定保留同一具体画面要求，阶段构成及唤醒目标另设；标签没有为五维主观情绪另作人工评定。此批使用绑定实际源图的既有观察，没有重看原图或接触排序。",
    limits: "同图观察有限，标签不穷尽馆藏。明确的逻辑冲突与证据不足分别保留。不是真人盲评。",
  },
  cases,
}, null, 2) + "\n");
