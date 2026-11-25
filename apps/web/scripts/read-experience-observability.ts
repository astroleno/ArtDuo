// ARTDUO_OBSERVABILITY=1 ARTDUO_STATE_DIR=/private/state node --import tsx scripts/read-experience-observability.ts
import { experienceObservabilityDirectory, readExperienceObservability } from "../lib/experience-observability";

async function main() {
  const directory = experienceObservabilityDirectory();
  if (!directory) throw new Error("Provide ARTDUO_OBSERVABILITY=1 and a private absolute ARTDUO_STATE_DIR");
  const report = await readExperienceObservability(directory);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

void main();
