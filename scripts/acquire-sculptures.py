"""Acquire approved SMK scans or import fingerprinted, reviewed external STLs."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request
import time
import shutil

SOURCE_GRANTS = {
    'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
    'CC BY-NC-SA 4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
}

def import_external_stl(model, directory, output):
    """A protected download is supplied locally; this never bypasses a login.

    Selection binds the reviewed file fingerprint, source page and grant.
    Original archives/conversion receipts, when present, remain in the record.
    """
    if not directory:
        raise ValueError('Official external download required; pass --external-originals for ' + model['id'])
    directory = Path(directory).resolve()
    identity = model['id']
    source_path = (directory / (identity + '.stl')).resolve()
    if source_path.parent != directory:
        raise ValueError('Invalid external sculpture identity')
    record = json.loads((directory / (identity + '.source.json')).read_text())
    if SOURCE_GRANTS.get(model.get('rights')) != model.get('rightsUrl') or not model.get('sourceCredit') or not model.get('catalogId'):
        raise ValueError('Unapproved external source grant or missing attribution: ' + identity)
    for key in ['id', 'source', 'rights', 'rightsUrl', 'sha256']:
        if not model.get(key) or record.get(key) != model[key]:
            raise ValueError('External source record mismatch: ' + identity + ':' + key)
    data = source_path.read_bytes()
    if len(data) < 84 or len(data) != 84 + int.from_bytes(data[80:84], 'little') * 50 or hashlib.sha256(data).hexdigest() != model['sha256']:
        raise ValueError('External source fingerprint mismatch: ' + identity)
    destination = output / (identity + '.stl')
    if source_path != destination.resolve():
        shutil.copyfile(source_path, destination)
    return {**record, **model, 'originalBytes': len(data), 'originalTriangles': int.from_bytes(data[80:84], 'little')}

def ranged_download(source, destination):
    """Verify every range, retry interrupted parts, and assemble in byte order."""
    size = source['file_size']
    cache = destination.with_suffix('.ranges')
    cache.mkdir(exist_ok=True)
    def part(start):
        end = min(size - 1, start + 1024 * 1024 - 1)
        for attempt in range(4):
            try:
                # A query on retry bypasses upstream cached, empty 206 bodies.
                url = source['url'] + (f'?artduo-range={start}-{attempt}' if attempt else '')
                request = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}', 'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=20) as response:
                    data = response.read()
                    etag = response.headers.get('ETag')
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{size}' or len(data) != end - start + 1 or not etag:
                        raise ValueError('Invalid ranged source transfer')
                    path = cache / str(start)
                    path.write_bytes(data)
                    (cache / (str(start) + '.json')).write_text(json.dumps({'url': source['url'], 'size': size, 'etag': etag, 'sha256': hashlib.sha256(data).hexdigest()}))
                    return path, etag
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(attempt + 1)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor, destination.open('wb') as target:
        etag = None
        for path, current_etag in executor.map(part, range(0, size, 1024 * 1024)):
            if etag and etag != current_etag:
                raise ValueError('Source changed during ranged transfer')
            etag = current_etag
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() != json.loads(path.with_name(path.name + '.json').read_text())['sha256']:
                raise ValueError('Ranged source cache changed')
            target.write(data)
    if destination.stat().st_size != size:
        raise ValueError('Incomplete ranged source transfer')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--metadata-cache')
    parser.add_argument('--selection', help='Reviewed selection JSON; defaults to the formal pool')
    parser.add_argument('--external-originals', help='Officially downloaded and reviewed external STLs with per-file source receipts')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    selection = json.loads((Path(args.selection) if args.selection else root / 'data/sculptures/selection-v1.json').read_text())
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    cached = {}
    if args.metadata_cache:
        cached = {item['object_number']: item for item in json.loads(Path(args.metadata_cache).read_text())['response']['items']}

    def acquire(model):
        if not model.get('museumId'):
            item = import_external_stl(model, args.external_originals, output)
            (output / (model['id'] + '.source.json')).write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps({'id': model['id'], 'bytes': item['originalBytes'], 'triangles': item['originalTriangles'], 'sha256': item['sha256']}), flush=True)
            return item
        identity = model['museumId']
        api = 'https://api.smk.dk/api/v1/art/?object_number=' + identity + '&lang=en'
        if identity in cached:
            record = cached[identity]
        else:
            with urllib.request.urlopen(api, timeout=40) as response:
                record = json.load(response)['items'][0]
        if record.get('public_domain') is not True or record.get('rights') != 'https://creativecommons.org/publicdomain/mark/1.0/':
            raise ValueError('Source rights changed: ' + identity)
        files = sorted((f for f in record['files_3D'] if f.get('file_size', 0) > 0 and f['mime_type'] == 'model/stl'), key=lambda f: f['file_size'])
        # Preserve the already reviewed high-resolution sources for the two
        # original trial works; new works start from SMK's isolated small STL.
        source = files[-1] if model['id'] in ['athena', 'david'] else files[0]
        if not source['url'].startswith('https://api.smk.dk/api/v1/download-3d/'):
            raise ValueError('Unexpected source host')
        destination = output / (model['id'] + '.stl')
        if not destination.exists() or destination.stat().st_size != source['file_size']:
            if source['file_size'] > 100_000_000:
                ranged_download(source, destination.with_suffix('.partial'))
                destination.with_suffix('.partial').replace(destination)
        if not destination.exists() or destination.stat().st_size != source['file_size']:
            for attempt in range(3):
                try:
                    # Some upstream caches have returned a truncated 200. Never
                    # promote partial bytes to an acquired source.
                    url = source['url'] + ('?artduo-complete=' + str(attempt) if attempt else '')
                    request = urllib.request.Request(url, headers={'User-Agent': 'ArtDuo-sculpture-preparation/1.0', 'Cache-Control': 'no-cache'})
                    with urllib.request.urlopen(request, timeout=45) as response, destination.with_suffix('.partial').open('wb') as target:
                        while chunk := response.read(1024 * 1024):
                            target.write(chunk)
                    if destination.with_suffix('.partial').stat().st_size != source['file_size']:
                        raise ValueError('Incomplete source transfer: ' + identity)
                    destination.with_suffix('.partial').replace(destination)
                    break
                except Exception:
                    if attempt == 2:
                        ranged_download(source, destination.with_suffix('.partial'))
                        destination.with_suffix('.partial').replace(destination)
                        break
                    time.sleep(1)
        data = destination.read_bytes()
        if len(data) != source['file_size'] or len(data) < 84 or len(data) != 84 + int.from_bytes(data[80:84], 'little') * 50:
            raise ValueError('Invalid STL: ' + identity)
        museum = {key: record.get(key) for key in ['object_number', 'titles', 'artist', 'materials', 'techniques', 'dimensions', 'original', 'notes', 'frontend_url', 'image_thumbnail', 'rights', 'public_domain']}
        item = {**model, 'source': record['frontend_url'], 'apiSource': api, 'downloadUrl': source['url'], 'sourceFile': source['url'].rsplit('/', 1)[-1],
                'originalBytes': len(data), 'originalTriangles': int.from_bytes(data[80:84], 'little'), 'sha256': hashlib.sha256(data).hexdigest(),
                'rights': 'PDM 1.0', 'rightsUrl': record['rights'], 'provider': 'SMK — Statens Museum for Kunst', 'museum': museum}
        (output / (model['id'] + '.source.json')).write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'id': model['id'], 'bytes': len(data), 'triangles': item['originalTriangles'], 'sha256': item['sha256']}), flush=True)
        return item

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        models = list(executor.map(acquire, selection['models']))
    (output / 'acquired.json').write_text(json.dumps({'version': selection['version'], 'checkedAt': '2026-10-27', 'models': models}, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
