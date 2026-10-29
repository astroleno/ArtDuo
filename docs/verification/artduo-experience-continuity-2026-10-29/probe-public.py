"""Read-only HTTPS delivery checks; uses only the existing synthetic exhibition."""
import concurrent.futures
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HOSTS = ("aitoshuu.me", "tongye.me")
NEIGHBORS = ("/", "/SonoScope", "/FamilyTree", "/Focuence", "/OutSet", "/CordIndex", "/CoScroll", "/LuBirth", "/InfiDao")
HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / "artduo-first-exhibition-performance-2026-10-28/public-checks.json"
REPLAY = json.loads(PRIOR.read_text())["checks"][0]["savedReplay"]["path"]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def fetch(url, follow=True):
    request = urllib.request.Request(url, headers={"User-Agent": "ArtDuo-continuity-verification", "Cache-Control": "no-cache"})
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        response = opener.open(request, timeout=45)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read()
        return {"url": response.url, "status": response.code, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
                "location": response.headers.get("Location"), "type": response.headers.get("Content-Type")}, body


def build_id(body):
    text = body.decode().replace('\\"', '"')
    value = re.search(r'"b":"([A-Za-z0-9_-]+)"', text)
    assert value, "Missing build marker"
    return value.group(1)


def neighbors():
    jobs = [(host, path) for host in HOSTS for path in NEIGHBORS]
    def probe(item):
        host, path = item
        receipt, body = fetch("https://" + host + path)
        assert urllib.parse.urlsplit(receipt["url"]).hostname == host, receipt
        assert receipt["status"] == 200, receipt
        return {"host": host, "path": path, **receipt}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(probe, jobs))


def check_host(host, expected):
    origin = "https://" + host
    result = {"host": host, "entry": [], "normalization": [], "staticFiles": []}
    home = None
    for suffix in ("", "?view=experience", "?view=classic&query=quiet%20%26%20blue"):
        receipt, body = fetch(origin + "/ArtDuo" + suffix)
        assert receipt["status"] == 200 and urllib.parse.urlsplit(receipt["url"]).hostname == host, receipt
        assert b"experience-entry" in body
        marker = build_id(body)
        if expected:
            assert marker == expected, (host, marker, expected)
        result["buildId"] = marker
        result["entry"].append({"path": suffix, **receipt})
        if home is None:
            home = body
    for prefix in ("/artduo", "/aRtDuO"):
        for suffix in ("?query=quiet%20%26%20blue", "/NoSuch-Continuity-QA.png?probe=A%26B"):
            receipt, body = fetch(origin + prefix + suffix, follow=False)
            assert receipt["status"] == 308, receipt
            target = urllib.parse.urljoin(origin, receipt["location"])
            assert target == origin + "/ArtDuo" + suffix, receipt
            result["normalization"].append({"path": prefix + suffix, **receipt})
    receipt, body = fetch(origin + "/ArtDuo/api/health")
    health = json.loads(body)
    assert receipt["status"] == 200 and health["ok"] and all(health["checks"].values()), health
    result["health"] = health
    receipt, replay = fetch(origin + "/ArtDuo" + REPLAY)
    assert receipt["status"] == 200 and b"experience-shell" in replay and b"artic-16487" in replay
    assert urllib.parse.urlsplit(receipt["url"]).hostname == host
    result["savedReplay"] = {"path": REPLAY, **receipt}
    detail = "/artwork/artic-16487?" + urllib.parse.urlencode({"query": "quiet & blue", "releaseVersion": "2026-10-24-da3-curated-630", "returnTo": REPLAY})
    receipt, body = fetch(origin + "/ArtDuo" + detail)
    assert receipt["status"] == 200 and "返回刚才的位置" in body.decode()
    result["detail"] = {"path": detail, **receipt}
    for name, suffix in (("sculpture", "/experience/sculptures?model=calais&quality=compact&room=bg-022"), ("handwriting", "/api/handwriting/options"), ("notFound", "/continuity-20261029-missing.js")):
        receipt, body = fetch(origin + "/ArtDuo" + suffix)
        assert receipt["status"] == (404 if name == "notFound" else 200), receipt
        if name == "handwriting":
            assert json.loads(body)["available"] is True
        result[name] = {"path": suffix, **receipt}
    assets = sorted(set(html.unescape(p) for p in re.findall(r'(?:src|href)="(/ArtDuo/_next/static/[^"?]+\.(?:js|css))', (home + replay).decode())))
    assert len(assets) >= 10
    for path in assets:
        receipt, body = fetch(origin + path)
        assert receipt["status"] == 200 and receipt["bytes"] > 0, receipt
        result["staticFiles"].append({"path": path, **receipt})
    return result


if __name__ == "__main__":
    mode, output = sys.argv[1:3]
    record = {"checkedAt": datetime.now(timezone.utc).isoformat(), "neighbors": neighbors()}
    if mode == "baseline":
        record["builds"] = {host: build_id(fetch("https://" + host + "/ArtDuo")[1]) for host in HOSTS}
    else:
        expected = sys.argv[3]
        record["checks"] = [check_host(host, expected) for host in HOSTS]
    Path(output).write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"mode": mode, "hosts": list(HOSTS), "neighbors": len(record["neighbors"]), "builds": record.get("builds"), "passed": True}))
