import { readQuantityPreviewBuildOptions } from "./cli";
import { buildQuantityPreview } from "./quantity-preview";

const result = buildQuantityPreview(readQuantityPreviewBuildOptions());

console.log(`quantity preview: ${result.outputDir}`);
console.log(`report: ${result.reportPath}`);
console.log(`preview records: ${result.report.counts.finalPreviewCount}`);
