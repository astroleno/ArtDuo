import { readFileSync } from "node:fs";

import { readReleaseBuildOptions } from "./cli";
import { buildReleaseArtifact } from "./release-artifact";

const result = buildReleaseArtifact(readReleaseBuildOptions());
const records = JSON.parse(readFileSync(result.metadataPath, "utf8")) as unknown[];

console.log(`metadata shard: ${result.metadataPath}`);
console.log(`record count: ${records.length}`);
