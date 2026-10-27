export async function register() {
  // Keep the positive runtime branch: Next's development compiler removes it
  // from the Edge instrumentation bundle before following native imports.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const [{ prepareCurationRuntime }, { projectRootFromCwd }] = await Promise.all([
      import("./lib/semantic-curator"), import("../api/src/runtime/environment"),
    ]);
    const started = performance.now();
    let prepared = false;
    try { await prepareCurationRuntime(projectRootFromCwd()); prepared = true; }
    catch { /* Missing local weights retain the existing request-time fallback and retry. */ }
    console.info("[artduo:startup]", JSON.stringify({ phase: "semantic-model", prepared, durationMs: Math.round(performance.now() - started) }));
  }
}
