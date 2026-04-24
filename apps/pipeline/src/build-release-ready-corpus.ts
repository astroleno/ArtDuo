import { readReleaseReadyBuildOptions } from "./cli";
import { buildReleaseReadyCorpus } from "./release-ready-corpus";

const result = buildReleaseReadyCorpus(readReleaseReadyBuildOptions());

console.log(`release-ready corpus: ${result.outputPath}`);
console.log(`report: ${result.reportPath}`);
console.log(`artworks: ${result.records.length}`);
