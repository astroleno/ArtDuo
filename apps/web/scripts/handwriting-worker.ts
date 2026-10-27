import { projectRootFromCwd } from "../../api/src/runtime/environment";
import { HandwritingWorker } from "../lib/handwriting/worker";

const controller = new AbortController();
for (const event of ["SIGTERM", "SIGINT"] as const) process.once(event, () => controller.abort());
new HandwritingWorker(projectRootFromCwd()).run(controller.signal).catch(() => {
  console.error("ArtDuo handwriting worker stopped; check its configuration and persistent state."); process.exitCode = 1;
});
