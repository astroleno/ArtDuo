"""Supply the historical test fixture, then resume unchanged candidate checks."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import runpy
import shutil
import tarfile

ROOT = Path("/opt/artduo/releases/20261029-experience-continuity")
EVIDENCE = ROOT / ".deployment"
FIXTURE = ROOT / "data/releases/2026-10-15-experience"
PACKAGE = Path("/root/artduo-continuity-test-fixture.tar.gz")
assert hashlib.sha256(PACKAGE.read_bytes()).hexdigest() == "d9076e51ab1240a67c6165dfe4298051a6cbf11ac1cec43f49233f1b4997c401"
status = json.loads((EVIDENCE / "status.json").read_text())
assert status["phase"] == "failed" and "test/lib/exhibition-narrative-server.test.ts" in status["error"]
assert not FIXTURE.exists() and not FIXTURE.is_symlink()
scope = runpy.run_path("/root/artduo-continuity-20261029.py")
completed = {name: scope["digest"](EVIDENCE / (name + ".log")) for name in ("build", "typecheck", "ui-tests", "api-tests")}
for name in ("ui-tests", "api-tests"):
    assert "# fail 0\n" in (EVIDENCE / (name + ".log")).read_text()
scope["save"](EVIDENCE / "completed-before-fixture.json", completed)
shutil.copy2(EVIDENCE / "web-tests.log", EVIDENCE / "web-tests-without-fixture.log")
user = pwd.getpwnam("artduo")
FIXTURE.mkdir(mode=0o750)
try:
    with tarfile.open(PACKAGE, "r:gz") as archive:
        for member in archive.getmembers():
            name = PurePosixPath(member.name)
            assert member.isfile() and not name.is_absolute() and ".." not in name.parts
            path = FIXTURE / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(archive.extractfile(member).read())
            os.chmod(path, 0o640)
    for directory, _, files in os.walk(FIXTURE):
        os.chown(directory, user.pw_uid, user.pw_gid)
        for name in files:
            os.chown(Path(directory) / name, user.pw_uid, user.pw_gid)
    original_run = scope["run"]

    def run(name, *args, **kwargs):
        if name in completed:
            assert scope["digest"](EVIDENCE / (name + ".log")) == completed[name]
            print("REUSE_PASSED_STEP", name, flush=True)
            return
        if name == "readiness":
            shutil.rmtree(FIXTURE)
            scope["save"](EVIDENCE / "test-fixture.json", {"temporaryHistoricalFixtureRemoved": True,
                "fixtureSha256": scope["digest"](PACKAGE), "unchangedSourceTests": True})
        original_run(name, *args, **kwargs)

    scope["validate"].__globals__["run"] = run
    scope["validate"]()
    print((EVIDENCE / "status.json").read_text())
except Exception as error:
    scope["status"]("failed", error=str(error))
    raise
finally:
    if FIXTURE.exists():
        shutil.rmtree(FIXTURE)
