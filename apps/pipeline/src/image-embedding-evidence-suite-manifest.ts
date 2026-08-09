import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseImageEmbeddingEvidenceSuiteBindings,
  type ImageEmbeddingEvidenceSuiteBindings,
  type ImageEmbeddingEvidenceSuiteSourceFile,
} from "./image-embedding-promotion-evidence";

const MANIFEST_SCHEMA = "image-embedding-evidence-suite-manifest.v1";
const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;

interface ManifestReference {
  schemaVersion: typeof MANIFEST_SCHEMA;
  path: string;
  checksum: string;
}

export interface ImageEmbeddingEvidenceSuiteManifestReadResult {
  bindings?: ImageEmbeddingEvidenceSuiteBindings;
  reasons: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function sha256(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function parseManifestReference(value: unknown): ManifestReference | undefined {
  if (!exactKeys(value, ["schemaVersion", "path", "checksum"])
    || value.schemaVersion !== MANIFEST_SCHEMA
    || typeof value.path !== "string"
    || !value.path.startsWith("./")
    || value.path.includes("\\")
    || typeof value.checksum !== "string"
    || !CHECKSUM.test(value.checksum)) {
    return undefined;
  }
  return {
    schemaVersion: MANIFEST_SCHEMA,
    path: value.path,
    checksum: value.checksum,
  };
}

function verifySourceFile(rootDir: string, source: ImageEmbeddingEvidenceSuiteSourceFile): string | undefined {
  if (path.isAbsolute(source.path)
    || source.path.includes("\\")
    || path.posix.normalize(source.path) !== source.path
    || source.path === "."
    || source.path.startsWith("../")) {
    return `Evidence suite source path is unsafe: ${source.path}.`;
  }
  const sourcePath = path.resolve(rootDir, source.path);
  if (!isInside(rootDir, sourcePath)) {
    return `Evidence suite source path escapes the repository: ${source.path}.`;
  }
  try {
    const observed = sha256(readFileSync(sourcePath));
    return observed === source.checksum
      ? undefined
      : `Evidence suite source checksum does not match: ${source.path}.`;
  } catch {
    return `Evidence suite source file is missing or unreadable: ${source.path}.`;
  }
}

function allSources(bindings: ImageEmbeddingEvidenceSuiteBindings): ImageEmbeddingEvidenceSuiteSourceFile[] {
  return [
    ...bindings.textBenchmark.sourceFiles,
    ...bindings.a2a.caseSet.sourceFiles,
    ...bindings.a2a.replay.sourceFiles,
    ...bindings.e2e.sourceFiles,
    ...bindings.fusionE2e.sourceFiles,
  ];
}

export function readImageEmbeddingEvidenceSuiteManifest(input: {
  rootDir: string;
  anchorPath: string;
  releaseVersion: string;
}): ImageEmbeddingEvidenceSuiteManifestReadResult {
  const rootDir = path.resolve(input.rootDir);
  const anchorPath = path.resolve(input.anchorPath);
  let anchor: unknown;
  try {
    anchor = JSON.parse(readFileSync(anchorPath, "utf8")) as unknown;
  } catch {
    return { reasons: ["Promotion anchor could not be read as JSON."] };
  }
  if (!isRecord(anchor) || anchor.releaseVersion !== input.releaseVersion) {
    return { reasons: ["Promotion anchor does not match the selected release."] };
  }
  const reference = parseManifestReference(anchor.evidenceSuiteManifest);
  if (!reference) {
    return { reasons: ["Promotion anchor evidence suite manifest reference is missing or malformed."] };
  }
  const manifestPath = path.resolve(path.dirname(anchorPath), reference.path);
  if (!isInside(rootDir, manifestPath)) {
    return { reasons: ["Promotion anchor evidence suite manifest path escapes the repository."] };
  }

  let manifest: unknown;
  try {
    const bytes = readFileSync(manifestPath);
    if (sha256(bytes) !== reference.checksum) {
      return { reasons: ["Promotion evidence suite manifest checksum does not match the anchor."] };
    }
    manifest = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return { reasons: ["Promotion evidence suite manifest could not be read as JSON."] };
  }
  if (!exactKeys(manifest, ["schemaVersion", "releaseVersion", "suites"])
    || manifest.schemaVersion !== MANIFEST_SCHEMA
    || manifest.releaseVersion !== input.releaseVersion) {
    return { reasons: ["Promotion evidence suite manifest schema or release binding is invalid."] };
  }
  const parsed = parseImageEmbeddingEvidenceSuiteBindings(manifest.suites);
  if (!parsed.bindings || parsed.reasons.length > 0) {
    return { reasons: parsed.reasons.length > 0 ? parsed.reasons : ["Promotion evidence suites are invalid."] };
  }

  const reasons: string[] = [];
  const verified = new Map<string, string>();
  for (const source of allSources(parsed.bindings)) {
    const prior = verified.get(source.path);
    if (prior && prior !== source.checksum) {
      reasons.push(`Evidence suite source has conflicting checksums: ${source.path}.`);
      continue;
    }
    if (prior) {
      continue;
    }
    verified.set(source.path, source.checksum);
    const reason = verifySourceFile(rootDir, source);
    if (reason) {
      reasons.push(reason);
    }
  }
  return reasons.length > 0 ? { reasons } : { bindings: parsed.bindings, reasons: [] };
}
