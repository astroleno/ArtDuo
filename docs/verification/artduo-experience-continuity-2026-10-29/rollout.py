"""One release's ArtDuo-only rollout; run on the existing Tencent source host."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

RELEASE = "20261029-experience-continuity"
CURRENT = Path("/opt/artduo/current")
TARGET = Path("/opt/artduo/releases") / RELEASE
BASE = Path("/opt/artduo/releases/20261028-first-exhibition-performance")
EVIDENCE = TARGET / ".deployment"
QA = Path("/var/lib/artduo-candidates") / RELEASE
ENV = Path("/etc/artduo/artduo.env")
QA_ENV = Path("/etc/artduo") / ("." + RELEASE + ".candidate.env")
BACKUP = Path("/var/backups/artduo") / RELEASE
RUNTIME = Path("/opt/artduo/runtime/bin")
UNIT = "artduo-continuity-candidate"
MANIFEST = "docs/verification/artduo-experience-continuity-2026-10-29/source-manifest.json"
FIXTURE = "edbe7ad5b816b90767958adc76c5a5297d0df146187ce7eb3636efc40c259073"


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def save(path, value):
    path = Path(path)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    os.replace(temp, path)


def status(phase, **values):
    save(EVIDENCE / "status.json", {"release": RELEASE, "phase": phase, **values})


def fetch(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "ArtDuo-release-verification"})
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read(12_000_001)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def manifest():
    return json.loads((EVIDENCE / "source-manifest.json").read_text())


def verify_sources():
    for row in manifest()["files"]:
        path = TARGET / row["path"]
        if not path.is_file() or path.stat().st_size != row["bytes"] or digest(path) != row["sha256"]:
            raise RuntimeError("Candidate source mismatch: " + row["path"])
    for name, expected in json.loads((EVIDENCE / "base-hashes.json").read_text()).items():
        path = BASE / name
        actual = digest(path) if path.is_file() else None
        if actual != expected:
            raise RuntimeError("Previous release source changed: " + name)


def prepare(commit, expected_manifest):
    assert os.geteuid() == 0 and CURRENT.resolve() == BASE
    assert re.fullmatch(r"[a-f0-9]{40}", commit) and re.fullmatch(r"[a-f0-9]{64}", expected_manifest)
    measurement_file = Path("/root/artduo-continuity-space.log")
    measurement = json.loads(measurement_file.read_text())
    assert measurement["tarExit"] == 0 and measurement["stderrBytes"] == 0
    assert 0 < measurement["compressedBytes"] < 1_000_000_000 and time.time() - measurement_file.stat().st_mtime < 3600
    backup_headroom = int(measurement["compressedBytes"] * 1.2)
    # The measured full archive plus 20% growth and 256 MB for an uncached build.
    assert shutil.disk_usage(TARGET.parent).free > backup_headroom + 256_000_000, "Insufficient candidate and full-backup headroom"
    assert not TARGET.exists(), "Release directory already exists; inspect before resuming"
    raw = fetch(f"https://raw.githubusercontent.com/astroleno/ArtDuo/{commit}/{MANIFEST}")
    assert hashlib.sha256(raw).hexdigest() == expected_manifest, "Manifest transport mismatch"
    spec = json.loads(raw)
    assert spec["schemaVersion"] == 1 and 500 < len(spec["files"]) < 1000
    for row in spec["files"]:
        path = PurePosixPath(row["path"])
        assert not path.is_absolute() and ".." not in path.parts
        assert path.parts[0] in ("apps", "packages", "scripts", "deploy") or len(path.parts) == 1
        assert re.fullmatch(r"[a-f0-9]{64}", row["sha256"]) and 0 <= row["bytes"] <= 12_000_000
    subprocess.run(["cp", "-al", str(BASE), str(TARGET)], check=True)
    if EVIDENCE.exists():
        shutil.rmtree(EVIDENCE)
    EVIDENCE.mkdir(mode=0o700)
    (EVIDENCE / "source-manifest.json").write_bytes(raw)
    save(EVIDENCE / "identity.json", {"commit": commit, "manifestSha256": expected_manifest, "base": str(BASE),
         "measuredBackupBytes": measurement["compressedBytes"], "reservedBackupBytes": backup_headroom, "buildCacheDisabled": True})
    save(EVIDENCE / "base-hashes.json", {row["path"]: digest(BASE / row["path"]) if (BASE / row["path"]).is_file() else None for row in spec["files"]})
    status("preparing")

    def materialize(row):
        path = TARGET / row["path"]
        data = path.read_bytes() if path.is_file() else None
        changed = data is None or hashlib.sha256(data).hexdigest() != row["sha256"]
        if changed:
            data = fetch(f"https://raw.githubusercontent.com/astroleno/ArtDuo/{commit}/" + urllib.parse.quote(row["path"], safe="/"))
        assert len(data) == row["bytes"] and hashlib.sha256(data).hexdigest() == row["sha256"], row["path"]
        # Break source hard links before compilers can write generated declarations.
        if changed or not row["path"].startswith("apps/web/public/"):
            path.parent.mkdir(parents=True, exist_ok=True)
            assert path.parent.resolve().is_relative_to(TARGET)
            temp = path.with_name(path.name + ".artduo-new")
            temp.write_bytes(data)
            os.replace(temp, path)
        return int(changed)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        changed = sum(pool.map(materialize, spec["files"]))
    for folder in [TARGET / "apps/web/.next", *(TARGET / "packages").glob("*/dist"), *(TARGET / "apps").glob("*/dist")]:
        if folder.is_symlink():
            folder.unlink()
        elif folder.is_dir():
            shutil.rmtree(folder)
    for parent in [*(TARGET / "packages").glob("*"), *(TARGET / "apps").glob("*")]:
        for file in parent.glob("*.tsbuildinfo"):
            file.unlink()
    for name in ("contracts", "corpus", "ui"):
        assert (TARGET / "apps/web/node_modules/@artduo" / name).resolve() == TARGET / "packages" / name, "Workspace link leaves the candidate"
    user = pwd.getpwnam("artduo")
    QA.parent.mkdir(mode=0o750, exist_ok=True)
    os.chown(QA.parent, 0, user.pw_gid)
    QA.mkdir(mode=0o700)
    (QA / "curations").mkdir(mode=0o700)
    for source in Path("/var/lib/artduo/curations").glob(FIXTURE + "*.json"):
        shutil.copy2(source, QA / "curations" / source.name)
    assert (QA / "curations" / (FIXTURE + ".json")).is_file()
    (QA / "artwork-previews").symlink_to("/var/lib/artduo/artwork-previews", target_is_directory=True)
    for directory, dirs, files in os.walk(QA):
        os.chown(directory, user.pw_uid, user.pw_gid)
        for name in files:
            os.chown(Path(directory) / name, user.pw_uid, user.pw_gid)
    QA_ENV.write_bytes(ENV.read_bytes() + ("\nARTDUO_STATE_DIR=" + str(QA) + "\nARTDUO_CURATION_PROVIDER=disabled\nARTDUO_EXPLANATION_PROVIDER=disabled\nINKO_API_KEY=\n").encode())
    os.chmod(QA_ENV, 0o600)
    verify_sources()
    status("prepared", changedFiles=changed, managedFiles=len(spec["files"]), diskFree=shutil.disk_usage(TARGET).free)


def environment():
    values = dict(os.environ)
    values.update(PATH=str(RUNTIME) + ":" + values.get("PATH", ""), ARTDUO_BASE_PATH="/ArtDuo", ARTDUO_STATE_DIR=str(QA),
                  ARTDUO_CURATION_PROVIDER="disabled", ARTDUO_EXPLANATION_PROVIDER="disabled", INKO_API_KEY="",
                  ARTDUO_DISABLE_BUILD_CACHE="1", NEXT_TELEMETRY_DISABLED="1", NODE_OPTIONS="--max-old-space-size=1536", NODE_ENV="production")
    assert values.get("ARTDUO_PUBLIC_MODE") == "1", "Load the existing service environment in the private child shell"
    return values


def run(name, args, cwd=TARGET, env=None):
    status("validating", step=name)
    with (EVIDENCE / (name + ".log")).open("wb") as log:
        subprocess.run(["runuser", "-u", "artduo", "--", *map(str, args)], cwd=cwd, env=env or environment(), stdout=log, stderr=subprocess.STDOUT, check=True)


def get(url):
    request = urllib.request.Request(url, headers={"Host": "aitoshuu.me", "X-Real-IP": "127.0.0.1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status, response.read()


def validate():
    verify_sources()
    env = environment()
    run("build", [RUNTIME / "pnpm", "-r", "--workspace-concurrency=1", "build"], env=env)
    run("typecheck", [RUNTIME / "pnpm", "-r", "--workspace-concurrency=1", "typecheck"], env=env)
    # Tests use their own fixtures, not live provider credentials or public policy.
    test_env = {key: value for key, value in env.items() if not key.startswith(("ARTDUO_", "DEEPSEEK_", "INKO_"))}
    test_env["NODE_ENV"] = "test"
    ui = TARGET / "packages/ui"
    tests = sorted(str(p.relative_to(ui)) for p in (ui / "src").rglob("*") if p.name.endswith((".test.ts", ".test.tsx")))
    run("ui-tests", [RUNTIME / "pnpm", "exec", "tsx", "--test", "--test-concurrency=1", *tests], cwd=ui, env=test_env)
    run("api-tests", [RUNTIME / "pnpm", "exec", "tsx", "--test", "test/services/exhibition-narrative.test.ts"], cwd=TARGET / "apps/api", env=test_env)
    run("web-tests", [RUNTIME / "pnpm", "exec", "tsx", "--test", "--test-concurrency=1", "test/lib/exhibition-narrative-server.test.ts", "test/lib/experience-navigation.test.ts", "test/lib/experience-analytics.test.ts"], cwd=TARGET / "apps/web", env=test_env)
    run("readiness", [RUNTIME / "pnpm", "release:check", "--", "--warm"], env=env)
    verify_sources()
    subprocess.run(["systemd-run", "--unit=" + UNIT, "--collect", "-p", "User=artduo", "-p", "WorkingDirectory=" + str(TARGET / "apps/web"),
                    "-p", "EnvironmentFile=" + str(QA_ENV), str(RUNTIME / "node"), str(TARGET / "apps/web/node_modules/next/dist/bin/next"),
                    "start", "--hostname", "127.0.0.1", "--port", "3243"], check=True)
    for attempt in range(30):
        try:
            code, body = get("http://127.0.0.1:3243/ArtDuo/api/health")
            assert code == 200 and json.loads(body)["ok"]
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(1)
    fixture = json.loads((QA / "curations" / (FIXTURE + ".json")).read_text())
    query = fixture["query"]
    params = urllib.parse.urlencode({"query": query, "view": "experience", "releaseVersion": "2026-10-24-da3-curated-630", "recipeVersion": "experience-v2", "phase": "walk", "curationId": FIXTURE})
    code, body = get("http://127.0.0.1:3243/ArtDuo/gallery/local/immersive?" + params)
    assert code == 200 and b"experience-shell" in body
    build_id = (TARGET / "apps/web/.next/BUILD_ID").read_text().strip()
    identity = json.loads((EVIDENCE / "identity.json").read_text())
    counts = {}
    for name in ("ui-tests", "api-tests", "web-tests"):
        log = (EVIDENCE / (name + ".log")).read_text()
        count = re.findall(r"^# tests (\d+)$", log, re.M)
        assert count and re.search(r"^# fail 0$", log, re.M), name
        counts[name] = sum(map(int, count))
    save(EVIDENCE / "validation.json", {**identity, "buildId": build_id, "tests": counts, "candidateHealth": True, "savedExhibition": True,
         "previousSourceUnchanged": True, "logs": {p.name: digest(p) for p in EVIDENCE.glob("*.log")}})
    status("validated", buildId=build_id, tests=counts)


def activate():
    validation = json.loads((EVIDENCE / "validation.json").read_text())
    assert CURRENT.resolve() == BASE and not BACKUP.exists(), "Live release changed or backup name already exists"
    verify_sources()
    env_hash = digest(ENV)
    state = Path("/var/lib/artduo")
    assert shutil.disk_usage(TARGET).free > validation["reservedBackupBytes"] + 64_000_000, "Insufficient headroom for a full consistent backup"
    subprocess.run(["systemctl", "stop", "artduo-web.service", "artduo-handwriting.service"], check=True)
    switched = False
    try:
        BACKUP.mkdir(mode=0o700)
        before_pngs = {str(p.relative_to(state)): digest(p) for p in state.rglob("*.png") if p.is_file()}
        subprocess.run(["tar", "-czf", str(BACKUP / "state.tar.gz"), "-C", str(state.parent), state.name], check=True)
        shutil.copy2(ENV, BACKUP / "artduo.env")
        os.chmod(BACKUP / "state.tar.gz", 0o600)
        os.chmod(BACKUP / "artduo.env", 0o600)
        save(BACKUP / "private-state.json", {"pngs": before_pngs})
        os.chmod(BACKUP / "private-state.json", 0o600)
        assert shutil.disk_usage(TARGET).free > 64_000_000, "Backup complete but insufficient switching headroom"
        link = CURRENT.with_name("current.artduo-continuity-new")
        link.symlink_to(TARGET, target_is_directory=True)
        os.replace(link, CURRENT)
        switched = True
        subprocess.run(["systemctl", "start", "artduo-web.service", "artduo-handwriting.service"], check=True)
        for attempt in range(40):
            try:
                code, body = get("http://127.0.0.1:3240/ArtDuo/api/health")
                assert code == 200 and json.loads(body)["ok"]
                break
            except Exception:
                if attempt == 39:
                    raise
                time.sleep(1)
        subprocess.run(["systemctl", "is-active", "artduo-web.service", "artduo-handwriting.service"], check=True)
        assert digest(ENV) == env_hash == digest(BACKUP / "artduo.env")
        assert all((state / p).is_file() and digest(state / p) == value for p, value in before_pngs.items())
        receipt = {**validation, "release": RELEASE, "activatedAt": time.strftime("%Y-%m-%d %H:%M:%S %z"), "current": str(CURRENT.resolve()),
                   "backup": str(BACKUP), "backupBytes": (BACKUP / "state.tar.gz").stat().st_size, "backupSha256": digest(BACKUP / "state.tar.gz"),
                   "environmentUnchanged": True, "preservedPngCount": len(before_pngs), "servicesActive": True, "diskFree": shutil.disk_usage(TARGET).free}
        save(EVIDENCE / "rollout.json", receipt)
        status("active", buildId=validation["buildId"], commit=validation["commit"])
        print(json.dumps(receipt))
    except Exception:
        if switched:
            link = CURRENT.with_name("current.artduo-continuity-rollback")
            link.symlink_to(BASE, target_is_directory=True)
            os.replace(link, CURRENT)
        subprocess.run(["systemctl", "start", "artduo-web.service", "artduo-handwriting.service"], check=False)
        raise


def cleanup():
    assert CURRENT.resolve() == TARGET and (EVIDENCE / "rollout.json").exists()
    subprocess.run(["systemctl", "stop", UNIT + ".service"], check=False)
    QA_ENV.unlink(missing_ok=True)
    if QA.exists():
        shutil.rmtree(QA)
    save(EVIDENCE / "cleanup.json", {"candidateStopped": subprocess.run(["systemctl", "is-active", "--quiet", UNIT + ".service"]).returncode != 0,
         "candidateStateRemoved": not QA.exists(), "candidateEnvRemoved": not QA_ENV.exists(), "previousReleaseKept": BASE.is_dir(),
         "servicesActive": all(subprocess.run(["systemctl", "is-active", "--quiet", unit]).returncode == 0 for unit in ("artduo-web.service", "artduo-handwriting.service"))})
    print((EVIDENCE / "cleanup.json").read_text())


if __name__ == "__main__":
    try:
        action = sys.argv[1]
        if action == "prepare":
            prepare(sys.argv[2], sys.argv[3])
        elif action == "validate":
            validate()
        elif action == "activate":
            activate()
        elif action == "cleanup":
            cleanup()
        elif action == "status":
            print((EVIDENCE / "status.json").read_text())
        else:
            raise ValueError("Unknown rollout phase")
    except Exception as error:
        if EVIDENCE.exists():
            status("failed", error=str(error))
        raise
