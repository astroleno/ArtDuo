import { readVisualPresentationPreviewOptions } from "./cli";
import { buildVisualPresentationPreview } from "./visual-presentation-preview";

function main(): void {
  const result = buildVisualPresentationPreview(readVisualPresentationPreviewOptions());

  console.log(`Visual presentation preview written: ${result.reportPath}`);
  console.log(`Candidates: ${result.report.counts.emittedCandidateCount}/${result.report.counts.signalCandidateCount}`);
}

main();
