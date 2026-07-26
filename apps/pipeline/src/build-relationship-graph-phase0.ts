import { readRelationshipGraphPhase0Options } from "./cli";
import { runRelationshipGraphPhase0 } from "./relationship-graph-phase0";

const result = runRelationshipGraphPhase0(readRelationshipGraphPhase0Options());

console.log(`relationship graph phase0 release: ${result.releaseVersion}`);
console.log(`report dir: ${result.reportDir}`);
console.log(`metadata baseline: ${result.metadataBaselinePath}`);
console.log(`payload measurement: ${result.payloadMeasurementPath}`);
console.log(`evaluation fixture: ${result.evaluationFixturePath}`);
console.log(`phase0 report: ${result.phase0ReportPath}`);
