"""Check only ArtDuo's current release, private-state continuity and services."""
import json
from pathlib import Path
import runpy
import stat
import subprocess
import tarfile

scope = runpy.run_path("/root/artduo-continuity-20261029.py")
folder, backup, state = scope["EVIDENCE"], scope["BACKUP"], Path("/var/lib/artduo")
assert scope["CURRENT"].resolve() == scope["TARGET"]
receipt = json.loads((folder / "rollout.json").read_text())
scope["verify_sources"]()
for path, mode in ((backup, 0o700), (backup / "state.tar.gz", 0o600), (backup / "artduo.env", 0o600), (backup / "private-state.json", 0o600)):
    assert stat.S_IMODE(path.stat().st_mode) == mode
assert scope["digest"](scope["ENV"]) == scope["digest"](backup / "artduo.env")
active = all(subprocess.run(["systemctl", "is-active", "--quiet", unit]).returncode == 0 for unit in ("artduo-web.service", "artduo-handwriting.service"))
assert active
code, body = scope["get"]("http://127.0.0.1:3240/ArtDuo/api/health")
health = json.loads(body)
assert code == 200 and health["ok"] and all(health["checks"].values())
code, body = scope["get"]("http://127.0.0.1:3240/ArtDuo")
html = body.decode().replace('\\"', '"')
assert code == 200 and '"b":"' + receipt["buildId"] + '"' in html
with tarfile.open(backup / "state.tar.gz", "r:gz") as archive:
    previous = json.loads(archive.extractfile("artduo/request-policy.json").read())
    current = json.loads((state / "request-policy.json").read_text())
    rollover = current["day"] > previous["day"]
    assert current["day"] >= previous["day"]
    if not rollover:
        assert current["requests"] >= previous["requests"] and current["reservedTokens"] >= previous["reservedTokens"]
    jobs = [member.name for member in archive.getmembers() if member.isfile() and member.name.startswith("artduo/handwriting/") and member.name.endswith(".json")]
    assert all((state / name.removeprefix("artduo/")).is_file() for name in jobs)
result = {"buildId": receipt["buildId"], "servicesActive": active, "health": health, "productionHttpBuildMatches": True,
          "sourceManifestAndPreviousReleaseUnchanged": True, "backupPermissionsVerified": True, "privateEnvironmentUnchanged": True,
          "quotaContinuity": True, "quotaDayRolledOver": rollover, "preservedHandwritingStateFiles": len(jobs),
          "preservedPngCount": receipt["preservedPngCount"], "temporaryHistoricalFixtureRemoved": not (scope["TARGET"] / "data/releases/2026-10-15-experience").exists()}
assert result["temporaryHistoricalFixtureRemoved"]
scope["save"](folder / "post-deploy.json", result)
print(json.dumps(result))
