import { readMetadataBackfillBuildOptions } from "./cli";
import { buildConfirmedMetadataBackfill } from "./confirmed-metadata-backfill";

async function main(): Promise<void> {
  const result = await buildConfirmedMetadataBackfill(readMetadataBackfillBuildOptions());

  console.log(`metadata backfill: ${result.outputPath}`);
  console.log(`report: ${result.reportPath}`);
  console.log(`validated records: ${result.report.counts.contractValidatedCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
