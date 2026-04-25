import { readMetadataBackfillPreviewBuildOptions } from "./cli";
import { buildMetadataBackfillPreview } from "./metadata-backfill-preview";

const result = buildMetadataBackfillPreview(readMetadataBackfillPreviewBuildOptions());

console.log(`metadata preview: ${result.outputDir}`);
console.log(`report: ${result.reportPath}`);
console.log(`preview records: ${result.report.counts.previewRecordCount}`);
