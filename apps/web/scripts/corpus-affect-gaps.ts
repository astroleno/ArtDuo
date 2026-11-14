// Compares what recorded plans ask stages to offer with what the eligible
// corpus can offer, to decide which works the collection needs next.
// Usage: pnpm --filter @artduo/web exec tsx scripts/corpus-affect-gaps.ts [evalLabel]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCurationIntentPlan, type AffectState } from "@artduo/contracts";
import { artworkOffering, stageFit } from "../lib/artwork-offering";
import { isGalleryArtwork } from "../lib/artwork-eligibility";
import { loadWebReleaseCatalog, type WebArtwork } from "../lib/release-catalog";

const rootDir = path.resolve(__dirname, "../../..");
const evalLabel = process.argv[2] ?? "v13b";

// Editorial archetypes of what a stage can ask for. Centres are 0–1 affect targets.
const ARCHETYPES: Array<{ id: string; label: string; centre: AffectState; open?: boolean }> = [
  { id: "still", label: "安静低唤醒", centre: { valence: .5, arousal: .15, tension: .1, wonder: .3, intimacy: .55 } },
  { id: "melancholy", label: "低落忧郁", centre: { valence: .3, arousal: .25, tension: .35, wonder: .3, intimacy: .55 } },
  { id: "warm", label: "温暖亲密", centre: { valence: .7, arousal: .35, tension: .1, wonder: .35, intimacy: .7 } },
  { id: "open", label: "开阔远景", centre: { valence: .55, arousal: .25, tension: .1, wonder: .6, intimacy: .3 }, open: true },
  { id: "hope", label: "微光希望", centre: { valence: .62, arousal: .3, tension: .12, wonder: .5, intimacy: .45 } },
  { id: "joy", label: "明亮欢快", centre: { valence: .88, arousal: .75, tension: .12, wonder: .5, intimacy: .35 } },
  { id: "wonder", label: "惊奇神秘", centre: { valence: .55, arousal: .55, tension: .4, wonder: .8, intimacy: .35 } },
  { id: "drama", label: "戏剧张力", centre: { valence: .35, arousal: .75, tension: .75, wonder: .55, intimacy: .3 } },
];
const STRONG_FIT = .8;

function nearest(state: AffectState): (typeof ARCHETYPES)[number] {
  return ARCHETYPES.reduce((best, item) => stageFit(state, item.centre) > stageFit(state, best.centre) ? item : best);
}

function main(): void {
  const catalog = loadWebReleaseCatalog({ rootDir });
  const eligible = catalog.artworks.filter(isGalleryArtwork);
  const offered = new Map<string, AffectState>(eligible.map((artwork) => [artwork.id, artworkOffering(artwork)]));
  const plans = JSON.parse(readFileSync(path.join(__dirname, "../test/fixtures/stage-fit-plans.json"), "utf8")) as Record<string, unknown>;
  const stages = Object.values(plans).flatMap((raw) => parseCurationIntentPlan(raw).stages);
  const evalPath = path.join(rootDir, ".cache", "stage-fit-eval", `${evalLabel}.json`);
  const judged = existsSync(evalPath)
    ? (JSON.parse(readFileSync(evalPath, "utf8")) as { results: Array<{ query: string; judged?: Array<{ stage: number; fit: number }> }> }).results : [];
  const misfitStages = judged.flatMap((result) => {
    const plan = parseCurationIntentPlan(plans[result.query]);
    return (result.judged ?? []).filter((item) => item.fit <= 2).map((item) => plan.stages[item.stage]!);
  });

  const supplyFor = (archetype: (typeof ARCHETYPES)[number]): WebArtwork[] => eligible
    .filter((artwork) => stageFit(offered.get(artwork.id)!, archetype.centre) >= STRONG_FIT
      && (!archetype.open || artwork.visualEvidence?.spatialFraming === "open"))
    .sort((a, b) => stageFit(offered.get(b.id)!, archetype.centre) - stageFit(offered.get(a.id)!, archetype.centre));
  const rows = ARCHETYPES.map((archetype) => {
    const supply = supplyFor(archetype);
    const demand = stages.filter((stage) => nearest(stage).id === archetype.id).length;
    const misfits = misfitStages.filter((stage) => nearest(stage).id === archetype.id).length;
    const artists = new Set(supply.map((artwork) => artwork.artistDisplayName ?? "?"));
    return { id: archetype.id, label: archetype.label, demandStages: demand, misfitStages: misfits, strongSupply: supply.length,
      distinctArtists: artists.size, supplyPerDemand: demand ? Number((supply.length / demand).toFixed(1)) : null,
      examples: supply.slice(0, 4).map((artwork) => `${artwork.title.slice(0, 32)} / ${artwork.artistDisplayName ?? "?"}`) };
  });
  const output = { release: catalog.releaseVersion, eligible: eligible.length, recordedStages: stages.length, judgedEval: existsSync(evalPath) ? evalLabel : null, strongFit: STRONG_FIT, rows };
  writeFileSync(path.join(rootDir, ".cache", "corpus-affect-gaps.json"), JSON.stringify(output, null, 1));
  console.log(`release ${output.release}: ${output.eligible} eligible works, ${output.recordedStages} recorded stages, judge=${output.judgedEval}`);
  console.log("archetype | demand stages | misfit stages | strong supply | artists | supply/demand");
  for (const row of rows) console.log(`${row.label} | ${row.demandStages} | ${row.misfitStages} | ${row.strongSupply} | ${row.distinctArtists} | ${row.supplyPerDemand ?? "-"}`);
  for (const row of rows) console.log(`  ${row.label}: ${row.examples.join("; ")}`);
}

main();
