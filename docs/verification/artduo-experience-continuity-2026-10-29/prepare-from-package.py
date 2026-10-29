"""Offline transport adapter; retains rollout.py's full manifest checks."""
import runpy
import tarfile
import urllib.parse
from pathlib import Path

COMMIT = "6876ae1c2af11c2c52da2a9d7b018b44d6100fa3"
MANIFEST_SHA = "85bc917af3db5e4fb5bb35745d115c26a4376ef3ec31883dc91bb191e49b2604"
PACKAGE = Path("/root/artduo-continuity-source-6876ae1-v2.tar.gz")
with tarfile.open(PACKAGE, "r:gz") as archive:
    files = {member.name: archive.extractfile(member).read() for member in archive.getmembers() if member.isfile()}
scope = runpy.run_path("/root/artduo-continuity-20261029.py")


def fetch_packaged(url):
    prefix = "https://raw.githubusercontent.com/astroleno/ArtDuo/" + COMMIT + "/"
    assert url.startswith(prefix), "Unexpected source identity"
    name = urllib.parse.unquote(url[len(prefix):])
    assert name in files, "A reused immutable asset differs from the manifest: " + name
    return files[name]


scope["prepare"].__globals__["fetch"] = fetch_packaged
scope["prepare"](COMMIT, MANIFEST_SHA)
print((scope["EVIDENCE"] / "status.json").read_text())
