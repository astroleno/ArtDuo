import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AffectState } from "@artduo/contracts";
import { CURVE_AXES } from "./curve-metrics";

export const TRACKED_REPLAY_LABEL = "20261125-finale-local";
type FrozenSlot = [artworkId: string, stage: number];
type FrozenWork = [artworkId: string, title: string, rules?: number[], flash?: number[]];
type FrozenFile = {
  schemaVersion: 1; releaseVersion: string; selectionVersion: number; selectionMode: "rules"; rulesRevision: string;
  fixtureSha256: string; sourceReplaySha256: string; releaseManifestSha256: string; flashLedgerSha256: string; flashLedgerVersion: string; flashModel: string;
  axisOrder: string[]; routes: Array<{ works: FrozenSlot[]; seed?: FrozenSlot[] }>; works: FrozenWork[];
};

export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const fingerprint = /^[a-f0-9]{64}$/u;

function reading(row?: number[]): AffectState | undefined {
  if (row === undefined) return undefined;
  if (row.length !== CURVE_AXES.length || row.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError("Frozen replay has invalid affect readings");
  }
  const [valence, arousal, tension, wonder, intimacy] = row;
  return { valence: valence!, arousal: arousal!, tension: tension!, wonder: wonder!, intimacy: intimacy! };
}

/** The tracked baseline runs without installing the release, media or local encoder. */
export function readTrackedCurveFixture(fixtureSha256: string, releaseVersion?: string) {
  const filename = path.join(__dirname, "../test/fixtures", `stage-fit-replay-${TRACKED_REPLAY_LABEL}.json`);
  const bytes = readFileSync(filename);
  const { routes, works, axisOrder, ...source } = JSON.parse(bytes.toString()) as FrozenFile;
  if (source.schemaVersion !== 1 || source.fixtureSha256 !== fixtureSha256 || source.selectionMode !== "rules"
    || (releaseVersion !== undefined && source.releaseVersion !== releaseVersion) || axisOrder.join(",") !== CURVE_AXES.join(",")
    || ![source.sourceReplaySha256, source.releaseManifestSha256, source.flashLedgerSha256].every(value => fingerprint.test(value))) {
    throw new TypeError("Frozen curve fixture does not match its plans or release");
  }
  const byId = new Map(works.map(([id, title, rules, flash]) => [id, { title, rules: reading(rules), flash: reading(flash) }]));
  if (byId.size !== works.length) throw new TypeError("Frozen curve fixture contains duplicate works");
  const toWorks = (slots: FrozenSlot[]) => slots.map(([artworkId, stage]) => {
    const work = byId.get(artworkId);
    if (!work) throw new TypeError("Frozen curve fixture references an unknown work");
    return { artworkId, title: work.title, stage };
  });
  return {
    source: { ...source, trackedReplaySha256: sha256(bytes) },
    byId,
    routes: routes.map(row => ({ works: toWorks(row.works), seedWorks: toWorks(row.seed ?? row.works), selectionMode: source.selectionMode })),
  };
}
