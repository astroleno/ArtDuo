import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseReleaseManifest, type ReleaseManifest } from "@artduo/contracts";

export interface CorpusRouteOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReleasesRoot(rootDir: string, releasesRoot?: string): string {
  return releasesRoot ? path.resolve(releasesRoot) : path.join(rootDir, "data", "releases");
}

export function resolveLatestReleaseVersion(releasesRoot: string): string {
  const versions = readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const latest = versions.at(-1);
  if (!latest) {
    throw new Error(`No release artifacts found under ${releasesRoot}`);
  }

  return latest;
}

export function resolveCorpusManifestPath(options: CorpusRouteOptions = {}): string {
  const rootDir = resolveRootDir(options.rootDir);
  const releasesRoot = resolveReleasesRoot(rootDir, options.releasesRoot);
  const releaseVersion = options.releaseVersion ?? resolveLatestReleaseVersion(releasesRoot);

  return path.join(releasesRoot, releaseVersion, "manifest.json");
}

export function getCorpusManifestResponse(options: CorpusRouteOptions = {}): ReleaseManifest {
  const manifestPath = resolveCorpusManifestPath(options);
  const payload = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;

  return parseReleaseManifest(payload);
}
