import { readEmbeddingRuntimeCliOptions, readRelationshipGraphEvaluationOptions } from "./cli";
import { evaluateRelationshipGraph } from "./relationship-graph-evaluation";

async function main(): Promise<void> {
  const result = await evaluateRelationshipGraph(
    readRelationshipGraphEvaluationOptions(),
    readEmbeddingRuntimeCliOptions(),
  );

  console.log(JSON.stringify(result.report, null, 2));
  console.log(`relationship graph evaluation: ${result.reportPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
