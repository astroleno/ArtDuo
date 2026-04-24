import { readFileSync } from "node:fs";

import { readReleaseBuildOptions } from "./cli";
import { buildReleaseArtifact } from "./release-artifact";

const result = buildReleaseArtifact(readReleaseBuildOptions());
const records = JSON.parse(readFileSync(result.mediaIndexPath, "utf8")) as unknown[];

console.log(`media index shard: ${result.mediaIndexPath}`);
console.log(`record count: ${records.length}`);
