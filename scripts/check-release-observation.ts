import { readdirSync } from "node:fs";
import { createLocalSemanticEncoder, type SemanticEncoder } from "../packages/corpus/src/local-semantic-provider";
import { runtimeDirectories } from "../apps/api/src/runtime/environment";
import { loadWebReleaseCatalog, type WebReleaseCatalog } from "../apps/web/lib/release-catalog";
import { curateExhibition, OBSERVATION_SELECTION_VERSION } from "../apps/web/lib/semantic-curator";
import { fallbackCurationIntent } from "../apps/web/lib/semantic-selection";
import { runtimeObservationStatus } from "../apps/web/lib/semantic-observation-release";

export interface ExpectedObservation {
  releaseVersion: string;
  fileSha256: string;
  contentChecksum: string;
}

export async function checkReleaseObservation(rootDir: string, stateDir: string, expected: ExpectedObservation, options?: {
  catalog?: WebReleaseCatalog; encoder?: SemanticEncoder;
}) {
  const catalog = options?.catalog ?? loadWebReleaseCatalog({ rootDir });
  const index = runtimeObservationStatus(catalog);
  const releaseVersion = catalog.releaseVersion;
  const artifact = index.status === "loaded"
    ? { indexStatus: index.status, fileSha256: index.value.fileSha256, contentChecksum: index.value.checksum }
    : { indexStatus: index.status, indexReason: index.reason };
  const base = { releaseVersion, ...artifact };
  const fail = (reason: string) => ({ ...base, ok: false, actualSelectionVersion: null, retrieval: "not-run", reason });
  if (releaseVersion !== expected.releaseVersion) return fail("release-mismatch");
  if (index.status !== "loaded") return fail(index.reason);
  if (index.value.fileSha256 !== expected.fileSha256) return fail("file-sha-mismatch");
  if (index.value.checksum !== expected.contentChecksum) return fail("content-checksum-mismatch");
  if (runtimeDirectories(rootDir).state !== stateDir || readdirSync(stateDir).length) return fail("state-not-isolated");

  const encoder = options?.encoder ?? createLocalSemanticEncoder({ rootDir, allowDownload: false });
  const query = "想看一幅画";
  const plan = fallbackCurationIntent(catalog, query);
  let intentCalls = 0;
  try {
    const result = await curateExhibition({ catalog, query, rootDir, encoder, intentModel: "release-observation-probe-v1",
      stream: async function* (messages) {
        if (!messages[0]?.content.includes("选画编辑")) { intentCalls++; yield JSON.stringify(plan); return; }
        const id = /^  候选 .*?"id":"([^"]+)"/mu.exec(messages[1]?.content ?? "")?.[1];
        if (id) yield JSON.stringify({ stages: [{ stage: 0, artworkIds: [id] }] });
      } });
    const observed = result.record.selectionVersion === OBSERVATION_SELECTION_VERSION && result.record.observationChecksum === expected.contentChecksum;
    const reason = intentCalls !== 1 ? "not-fresh" : !observed ? "retrieval-fallback"
      : result.assignments.length === 0 ? "empty-selection" : result.record.degraded.length ? "curation-degraded" : "verified";
    return { ...base, ok: reason === "verified", actualSelectionVersion: result.record.selectionVersion ?? null,
      retrieval: observed ? "observation" : result.record.retrievalModel === "local-hash-embedding-v1" ? "hash" : "museum", reason };
  } catch { return { ...fail("curation-failed"), retrieval: "failed" }; }
  finally { if (!options?.encoder) await encoder.dispose().catch(() => undefined); }
}
