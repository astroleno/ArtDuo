import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { LOCAL_DEPTH_MODEL } from "@artduo/corpus/src/local-depth-provider";

export interface CompletedDepthOutput {
  ordinal: number; artworkId: string; inputSha256: string; url: string; outputSha256: string;
}
export function readCompletedDepthRecovery(root: string, filename: string, version: string, baseVersion: string) {
  const read = (file: string) => {
    const resolved = realpathSync(path.resolve(root, file));
    if (!resolved.startsWith(realpathSync(root) + path.sep)) throw new TypeError("Recovery evidence escaped the project");
    return readFileSync(resolved);
  };
  const hash = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const proof = JSON.parse(read(filename).toString());
  if (proof.schemaVersion !== 1 || proof.releaseVersion !== version || proof.baseVersion !== baseVersion
    || proof.modelWeightsSha256 !== LOCAL_DEPTH_MODEL.weightsSha256 || !Number.isSafeInteger(proof.completedCount)
    || proof.completedCount <= 0 || !Array.isArray(proof.records) || proof.records.length !== proof.completedCount)
    throw new TypeError("Invalid completed-depth recovery evidence");
  for (const item of [proof.originalPublisher, proof.assessment, proof.runLog])
    if (!item || hash(read(item.file)) !== item.sha256) throw new TypeError("Recovery evidence fingerprint changed");
  const completed = read(proof.runLog.file).toString().split("\n").filter(Boolean).flatMap(line => {
    try { const item = JSON.parse(line); return item.phase === "depth" ? [item.completed] : []; } catch { return []; }
  });
  const ready = JSON.parse(read(proof.assessment.file).toString()).ready;
  if (completed.length !== proof.completedCount || completed.some((value, index) => value !== index + 1))
    throw new TypeError("The original run did not confirm every recovered depth output");
  const result = new Map<string, CompletedDepthOutput>();
  for (const [index, row] of (proof.records as CompletedDepthOutput[]).entries()) {
    if (row.ordinal !== index + 1 || row.artworkId !== ready[index]
      || !/^sha256:[a-f0-9]{64}$/u.test(row.inputSha256) || !/^[a-f0-9]{64}$/u.test(row.outputSha256)
      || row.url !== `depth/${encodeURIComponent(row.artworkId)}.png`
      || hash(read(`data/curation/verified-import/${version}/release/${row.url}`)) !== `sha256:${row.outputSha256}`)
      throw new TypeError("Completed depth output no longer matches its original run");
    result.set(row.artworkId, row);
  }
  return { records: result, runLogSha256: proof.runLog.sha256 as string };
}
