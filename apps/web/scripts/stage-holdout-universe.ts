import type { WebReleaseCatalog } from "../lib/release-catalog";
import { judge, verifiedHoldoutArtwork } from "./stage-holdout-evidence";
import { hash, type readHoldoutFixture } from "./stage-holdout-fixture";
import { CUTOFFS, type HoldoutStage } from "./stage-holdout-metrics";

type Fixture = ReturnType<typeof readHoldoutFixture>;
type Label = ReturnType<typeof judge>["label"];
const EXPECTED_UNIVERSE = "1a721073024256539c6c8ffe6e0cf6633a5544485e4eb91ff1fe13182b91f9e3";
const BLIND_SEED = "artduo-stage-holdout-image-audit-v1";
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function freezeUniverse(catalog: WebReleaseCatalog, fixture: Fixture) {
  const artworks = catalog.artworks.filter(verifiedHoldoutArtwork).sort((a, b) => compare(a.id, b.id));
  if (artworks.length !== 739 || new Set(artworks.map(artwork => artwork.id)).size !== artworks.length) {
    throw new Error("Expected 739 distinct image-bound works in the holdout universe");
  }
  const works = artworks.map(artwork => [artwork.id, artwork.visualEvidence!.imageSha256]);
  const labels = new Map(fixture.cases.map(entry => [entry.id,
    new Map(artworks.map(artwork => [artwork.id, judge(artwork, entry.criteria).label]))]));
  const snapshot = [fixture.sha256, works, [...labels].map(([id, values]) => [id, [...values.values()]])];
  const sha256 = hash(JSON.stringify(snapshot));
  if (sha256 !== EXPECTED_UNIVERSE) throw new Error(`Full-catalog reference fingerprint mismatch: ${sha256}`);
  return { artworks, labels, sha256 };
}

export function createBlindPackets(fixture: Fixture, { artworks, labels, sha256 }: ReturnType<typeof freezeUniverse>) {
  const items = [...new Set(fixture.cases.map(entry => entry.stratum))].flatMap(stratum => {
    const ranked = fixture.cases.filter(entry => entry.stratum === stratum).flatMap(entry => artworks.map(artwork => ({
      draw: hash(JSON.stringify([BLIND_SEED, entry.id, artwork.id])), entry, artwork,
      label: labels.get(entry.id)!.get(artwork.id)!,
    }))).sort((a, b) => compare(a.draw, b.draw));
    const selected = (["positive", "negative", "unknown"] as const)
      .flatMap(label => ranked.filter(row => row.label === label).slice(0, 2));
    const selectedDraws = new Set(selected.map(row => row.draw));
    return [...selected, ...ranked.filter(row => !selectedDraws.has(row.draw)).slice(0, 6 - selected.length)];
  }).map(row => ({ ...row, order: hash(`${BLIND_SEED}:presentation:${row.draw}`) }))
    .sort((a, b) => compare(a.order, b.order)).map(({ entry, artwork }) => ({
      caseId: entry.id, stratum: entry.stratum, query: entry.query, artworkId: artwork.id,
      imagePath: artwork.visualEvidence!.imagePath, imageSha256: artwork.visualEvidence!.imageSha256,
      museumMedium: artwork.medium ?? null,
      label: null, basis: null,
    }));
  return { schemaVersion: 1, seed: BLIND_SEED, sourceFixtureSha256: fixture.sha256, referenceSha256: sha256,
    instruction: "Use the exact source image, request and supplied museum medium. Record positive, negative or unknown, and the concrete basis. Keep uncertainty as unknown.",
    items };
}

export function scoreBlindPackets(
  packets: ReturnType<typeof createBlindPackets>,
  submitted: unknown,
  labels: ReturnType<typeof freezeUniverse>["labels"],
  pools?: ReturnType<typeof measureUniverse>["rows"],
) {
  if (!submitted || typeof submitted !== "object" || !("items" in submitted) || !Array.isArray(submitted.items)
    || submitted.items.length !== packets.items.length
    || !("referenceSha256" in submitted) || submitted.referenceSha256 !== packets.referenceSha256
    || !("seed" in submitted) || submitted.seed !== packets.seed) throw new Error("Submit the completed blind packet");
  const submittedItems = submitted.items;
  const reviewerCategory = "reviewerCategory" in submitted && typeof submitted.reviewerCategory === "string"
    ? submitted.reviewerCategory.trim() : undefined;
  const counts = { comparable: 0, sameJudgment: 0, reviewerUnknown: 0, referenceUnknown: 0, bothUnknown: 0 };
  const results = packets.items.map((expected, index) => {
    const item = submittedItems[index];
    if (!item || Object.entries(expected).some(([key, value]) => key !== "label" && key !== "basis" && item[key] !== value)
      || !["positive", "negative", "unknown"].includes(item.label) || typeof item.basis !== "string" || !item.basis.trim()) {
      throw new Error(`Incomplete or modified blind packet row ${index + 1}`);
    }
    const reference = labels.get(expected.caseId)!.get(expected.artworkId)!;
    if (item.label === "unknown") counts.reviewerUnknown++;
    if (reference === "unknown") counts.referenceUnknown++;
    if (item.label === "unknown" && reference === "unknown") counts.bothUnknown++;
    if (item.label !== "unknown" && reference !== "unknown") {
      counts.comparable++;
      if (item.label === reference) counts.sameJudgment++;
    }
    const { label: _, basis: __, ...identity } = expected;
    const shown = pools?.filter(row => row.caseId === expected.caseId)
      .flatMap(row => row.pool.slice(0, 6)).includes(expected.artworkId);
    return { ...identity, reviewerLabel: item.label, basis: item.basis, reference, shownAt6: shown };
  });
  const coverage = pools && {
    pairsShown: results.filter(row => row.shownAt6).length,
    reviewerPositive: results.filter(row => row.reviewerLabel === "positive").length,
    reviewerPositiveShown: results.filter(row => row.reviewerLabel === "positive" && row.shownAt6).length,
    reviewerNegativeShown: results.filter(row => row.reviewerLabel === "negative" && row.shownAt6).length,
    reviewerUnknownShown: results.filter(row => row.reviewerLabel === "unknown" && row.shownAt6).length,
  };
  const sampling = Object.fromEntries([...new Set(results.map(row => row.stratum))].map(stratum => [stratum,
    Object.fromEntries(["positive", "negative", "unknown"].map(label => [label, results.filter(row => row.stratum === stratum && row.reference === label).length])),
  ]));
  return { referenceSha256: packets.referenceSha256, reviewerCategory, total: results.length, ...counts, sampling, coverage, results };
}

export function measureUniverse(stages: HoldoutStage[], labels: Map<string, Map<string, Label>>) {
  const ratio = (numerator: number, denominator: number) => ({ numerator, denominator, value: denominator ? numerator / denominator : null });
  const metrics = ({ hits, positives, cap, negative, judged, unknown, returned }: {
    hits: number; positives: number; cap: number; negative: number; judged: number; unknown: number; returned: number;
  }) => ({ recall: ratio(hits, positives), cappedRecall: ratio(hits, cap), judgedError: ratio(negative, judged), unknownShare: ratio(unknown, returned) });
  const rows = stages.filter(stage => stage.requested).map(stage => {
    const reference = labels.get(stage.caseId)!;
    const positives = [...reference].filter(([, label]) => label === "positive").map(([id]) => id);
    const eligiblePositives = positives.filter(id => stage.allowed.has(id)).length;
    const counts = CUTOFFS.map(k => {
      const prefix = stage.pool.slice(0, k);
      const judgments = prefix.map(id => {
        const label = reference.get(id);
        if (!label) throw new Error(`Production shortlist contains unbound work ${id}`);
        return label;
      });
      const hits = judgments.filter(label => label === "positive").length;
      const negative = judgments.filter(label => label === "negative").length;
      const row = { k, hits, negative, judged: hits + negative, unknown: prefix.length - hits - negative,
        returned: prefix.length, positives: positives.length, cap: Math.min(k, positives.length), eligiblePositives };
      return { ...row, ...metrics(row) };
    });
    return { caseId: stage.caseId, stageIndex: stage.stageIndex, stratum: stage.stratum, counts, pool: stage.pool,
      reference: { positive: positives.length, negative: [...reference.values()].filter(label => label === "negative").length,
        unknown: [...reference.values()].filter(label => label === "unknown").length, eligiblePositives } };
  });
  const summarize = (group: typeof rows) => CUTOFFS.map((k, index) => {
    const total = { hits: 0, positives: 0, eligiblePositives: 0, cap: 0, negative: 0, judged: 0, unknown: 0, returned: 0 };
    for (const row of group) for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += row.counts[index]![key];
    return { k, ...total, ...metrics(total) };
  });
  const groups = (key: "caseId" | "stratum") =>
    Object.fromEntries([...new Set(rows.map(row => row[key]))].map(value => [value, summarize(rows.filter(row => row[key] === value))]));
  return { requestedStages: rows.length, unrequestedStages: stages.length - rows.length,
    withoutPool: rows.filter(row => !row.pool.length).length, zeroPositiveStages: rows.filter(row => !row.reference.positive).length,
    overall: summarize(rows), strata: groups("stratum"), cases: groups("caseId"),
    rows };
}
