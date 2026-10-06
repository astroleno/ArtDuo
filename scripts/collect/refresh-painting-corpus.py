"""Bounded, resumable official-source refresh; never changes an existing release.

Run from the repository root. Cached responses retain the source facts; curation
is recorded separately and is not attributed to either museum.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[2]
VERSION = "2026-10-06-paintings"
OUT = ROOT / "data/curation/painting-refresh" / VERSION
RAW = OUT / "sources"
RAW.mkdir(parents=True, exist_ok=True)
OLD = json.loads((ROOT / "data/curation/release-ready/2026-04-25-curation-b.json").read_text())


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def fetch(url, key):
    dest = RAW / (key + ".json")
    if dest.exists():
        return json.loads(dest.read_text())["response"]
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ArtDuo-source-verification/1.0"}), timeout=35) as response:
                data = json.load(response)
            write(dest, {"sourceUrl": url, "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "response": data})
            return data
        except Exception as error:
            if attempt == 2:
                return {"fetchError": str(error)}
            time.sleep(attempt + 1)


def met(object_id):
    if os.environ.get("ARTDUO_MET_CACHE_ONLY") == "1" and not (RAW / f"met-{object_id}.json").exists():
        return object_id, {"fetchError": "Met API returned an access challenge; existing catalog facts retained, no bypass attempted"}
    return object_id, fetch(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{object_id}", f"met-{object_id}")


def main():
    extra = [436535, 436532, 437112, 437133, 435882, 437881, 436121, 437494,
             438008, 436244, 437329, 436965, 436838, 436524, 438158, 45434]
    ids = sorted(set([int(r["sourceArtworkId"]) for r in OLD if r["source"] == "met"] + extra))
    with ThreadPoolExecutor(max_workers=3) as pool:
        sources = dict(pool.map(met, ids))
    print(f"Met responses: {len(sources)}", flush=True)
    aic_ids = [16568, 16571, 64818, 14620, 87088, 28560, 27992, 80607, 111628, 16487, 16648, 14598, 20684, 81558, 10967, 28067, 111436, 66042]
    aic = []
    for object_id in aic_ids:
        cached = (RAW / f"artic-{object_id}.json").exists()
        result = fetch(f"https://api.artic.edu/api/v1/artworks/{object_id}", f"artic-{object_id}")
        if "data" in result:
            aic.append(result["data"])
        if not cached:
            time.sleep(1.05)
    records, provenance, excluded = [], [], []
    previous = {r["id"]: r for r in OLD}
    for object_id, source in sources.items():
        identity = f"met-{object_id}"
        old = previous.get(identity)
        if "fetchError" in source:
            if not old:
                excluded.append({"id": identity, "reason": source["fetchError"]})
                continue
            record = copy.deepcopy(old)
            metadata = record["metadata"]
            metadata["descriptionRaw"] = metadata["descriptionClean"] = f'{metadata["title"]}. {metadata.get("artistDisplayName", "")}. {metadata.get("medium", "")}.'
            metadata["storySnippet"] = metadata["descriptionClean"]
            metadata["subjectTags"] = [tag for tag in metadata["subjectTags"] if tag not in metadata["moodTags"]]
            provenance.append({"id": identity, "institution": "The Metropolitan Museum of Art", "sourceUrl": metadata["sourceApiUrl"], "objectUrl": metadata["objectUrl"], "rawRecord": "../../release-ready/2026-04-25-curation-b.json", "status": "existing-source-refresh-unavailable", "error": source["fetchError"]})
        else:
            if not old and (not source.get("isPublicDomain") or not source.get("primaryImage") or source.get("classification") not in ["Paintings", "Prints", "Drawings"]):
                excluded.append({"id": identity, "reason": "new work lacks public-domain image or pictorial classification"})
                continue
            record = copy.deepcopy(old or OLD[0])
            record.update(id=identity, source="met", sourceArtworkId=str(object_id))
            metadata = record["metadata"]
            for dest, src in [("title", "title"), ("artistDisplayName", "artistDisplayName"), ("yearLabel", "objectDate"), ("medium", "medium"), ("department", "department"), ("objectUrl", "objectURL")]:
                metadata[dest] = source.get(src) or metadata.get(dest, "")
            metadata["sourceApiUrl"] = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{object_id}"
            metadata["subjectTags"] = list(dict.fromkeys(filter(None, [source.get("classification", "")] + [t["term"] for t in source.get("tags") or []])))
            metadata["descriptionRaw"] = metadata["descriptionClean"] = f'{metadata["title"]} — {metadata["artistDisplayName"]}, {metadata["yearLabel"]}. {metadata["medium"]}.'
            metadata["storySnippet"] = metadata["descriptionClean"]
            if not old:
                metadata.update(moodTags=["contemplation"], colorTags=[], compositionTags=[])
                record["media"] = {"baseImageUrl": source["primaryImage"], "imageUrlPreview": source["primaryImage"], "imageUrlFull": source["primaryImage"], "hasMotionAsset": False, "mediaVersion": VERSION, "sourceAssetFingerprint": hashlib.sha256(source["primaryImage"].encode()).hexdigest()}
            provenance.append({"id": identity, "institution": "The Metropolitan Museum of Art", "sourceUrl": metadata["sourceApiUrl"], "objectUrl": metadata["objectUrl"], "isPublicDomain": source.get("isPublicDomain"), "new": not bool(old), "rawRecord": f"sources/{identity}.json"})
        records.append(record)
    for source in aic:
        identity = f'artic-{source["id"]}'
        if not source.get("is_public_domain") or not source.get("image_id") or source.get("artwork_type_title") != "Painting":
            excluded.append({"id": identity, "reason": "not a public-domain painting with image"})
            continue
        record = copy.deepcopy(OLD[0])
        record.update(id=identity, source="custom", sourceArtworkId=str(source["id"]))
        metadata = record["metadata"]
        metadata.update(title=source["title"], artistDisplayName=source.get("artist_title") or source["artist_display"], yearLabel=source["date_display"], medium=source["medium_display"], department=source["department_title"], objectUrl=f'https://www.artic.edu/artworks/{source["id"]}', sourceApiUrl=f'https://api.artic.edu/api/v1/artworks/{source["id"]}', subjectTags=["Paintings"] + (source.get("subject_titles") or []), moodTags=["contemplation"], colorTags=[], compositionTags=[])
        metadata["descriptionRaw"] = metadata["descriptionClean"] = f'{metadata["title"]} — {metadata["artistDisplayName"]}, {metadata["yearLabel"]}. {metadata["medium"]}.'
        metadata["storySnippet"] = metadata["descriptionClean"]
        base = f'https://www.artic.edu/iiif/2/{source["image_id"]}/full'
        record["media"] = {"baseImageUrl": base + "/843,/0/default.jpg", "imageUrlPreview": base + "/843,/0/default.jpg", "imageUrlFull": base + "/1686,/0/default.jpg", "hasMotionAsset": False, "mediaVersion": VERSION, "sourceAssetFingerprint": source["image_id"]}
        provenance.append({"id": identity, "institution": "Art Institute of Chicago", "sourceUrl": metadata["sourceApiUrl"], "objectUrl": metadata["objectUrl"], "isPublicDomain": True, "imageLicense": "CC0", "creditLine": source.get("credit_line"), "new": True, "rawRecord": f"sources/{identity}.json"})
        records.append(record)
    for record in records:
        record["version"] = VERSION
        metadata = record["metadata"]
        for key in list(metadata):
            if metadata[key] == "":
                del metadata[key]
        retrieval = record["retrieval"]
        retrieval.update(searchText=" ".join([metadata["title"], metadata.get("artistDisplayName", ""), metadata["descriptionClean"]] + metadata["subjectTags"] + metadata["moodTags"]), searchTextShort=metadata["title"] + " " + metadata.get("artistDisplayName", ""), keywordBoosts=metadata["subjectTags"], emotionLabels=metadata["moodTags"] or ["contemplation"])
    write(OUT / "corpus.json", records)
    write(OUT / "provenance.json", {"version": VERSION, "sources": provenance, "excluded": excluded, "curationNote": "Descriptions combine catalog facts only; mood labels are ArtDuo interpretations, not museum assertions. AIC description text is not reused."})
    print(f"Wrote {len(records)} records ({sum(bool(p.get('new')) for p in provenance)} new); excluded {len(excluded)}", flush=True)


if __name__ == "__main__":
    main()
