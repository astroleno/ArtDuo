import { readFileSync } from "node:fs";

import { readReleaseBuildOptions } from "./cli";
import { buildReleaseArtifact } from "./release-artifact";

const result = buildReleaseArtifact(readReleaseBuildOptions());
const records = JSON.parse(readFileSync(result.backgroundScenesPath, "utf8")) as unknown[];

console.log(`background scenes shard: ${result.backgroundScenesPath}`);
console.log(`record count: ${records.length}`);
