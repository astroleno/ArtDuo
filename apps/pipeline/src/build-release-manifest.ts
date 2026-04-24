import { readReleaseBuildOptions } from "./cli";
import { buildReleaseArtifact } from "./release-artifact";

const result = buildReleaseArtifact(readReleaseBuildOptions());

console.log(`release artifact: ${result.outputDir}`);
console.log(`manifest: ${result.manifestPath}`);
console.log(`artworks: ${result.records.artworks.length}`);
console.log(`background scenes: ${result.records.backgroundScenes.length}`);
