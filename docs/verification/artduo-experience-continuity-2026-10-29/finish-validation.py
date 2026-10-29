"""Resume at production-config readiness after the unchanged tests passed."""
import json
import os
from pathlib import Path
import runpy
import shutil

scope = runpy.run_path("/root/artduo-continuity-20261029.py")
folder, qa = scope["EVIDENCE"], scope["QA"]
status = json.loads((folder / "status.json").read_text())
assert status["phase"] == "failed" and "release:check" in status["error"]
assert not (scope["TARGET"] / "data/releases/2026-10-15-experience").exists()
completed = {name: scope["digest"](folder / (name + ".log")) for name in ("build", "typecheck", "ui-tests", "api-tests", "web-tests")}
for name in ("ui-tests", "api-tests", "web-tests"):
    assert "# fail 0\n" in (folder / (name + ".log")).read_text()
scope["save"](folder / "completed-before-readiness.json", completed)
shutil.copy2(folder / "readiness.log", folder / "readiness-disabled-config.log")
scope["QA_ENV"].write_bytes(scope["ENV"].read_bytes() + ("\nARTDUO_STATE_DIR=" + str(qa) + "\nARTDUO_EXPLANATION_PROVIDER=disabled\nINKO_API_KEY=\n").encode())
os.chmod(scope["QA_ENV"], 0o600)
original_run = scope["run"]


def run(name, *args, **kwargs):
    if name in completed:
        assert scope["digest"](folder / (name + ".log")) == completed[name]
        print("REUSE_PASSED_STEP", name, flush=True)
        return
    original_run(name, *args, **kwargs)


try:
    scope["validate"].__globals__["run"] = run
    scope["validate"]()
    # The preview only requests health and an immutable saved exhibition HTML;
    # it never runs a browser SSE client or starts a new curation.
    assert not (qa / "request-policy.json").exists()
    assert not (qa / "provider-events").exists() or not any((qa / "provider-events").iterdir())
    scope["save"](folder / "candidate-provider-check.json", {"noProviderCalls": True, "historicalFixtureRemoved": True})
    print((folder / "status.json").read_text())
except Exception as error:
    scope["status"]("failed", error=str(error))
    raise
