import { readFileSync } from "node:fs";

import { readReleaseBuildOptions } from "./cli";
import { buildReleaseArtifact } from "./release-artifact";

const result = buildReleaseArtifact(readReleaseBuildOptions());
const records = JSON.parse(readFileSync(result.searchPath, "utf8")) as unknown[];

console.log(`search shard: ${result.searchPath}`);
console.log(`record count: ${records.length}`);
