import { readCandidatePreviewBuildOptions } from "./cli";
import { buildCandidatePreview } from "./candidate-preview";

const result = buildCandidatePreview(readCandidatePreviewBuildOptions());

console.log(`candidate preview: ${result.outputDir}`);
console.log(`report: ${result.reportPath}`);
console.log(`preview records: ${result.report.counts.previewRecordCount}`);
