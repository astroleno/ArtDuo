import { readRelationshipGraphBuildOptions } from "./cli";
import { buildRelationshipGraph } from "./relationship-graph";

const result = buildRelationshipGraph(readRelationshipGraphBuildOptions());

console.log(`relationship graph: ${result.graphPath}`);
console.log(`internal report: ${result.reportPath}`);
console.log(`manifest: ${result.manifestPath}`);
console.log(`nodes: ${result.graph.nodes.length}`);
console.log(`edges: ${result.graph.edges.length}`);
console.log(`manifest updated: ${result.report.publicSidecar.manifestUpdated}`);
