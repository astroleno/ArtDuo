import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('acquire_sculptures', Path(__file__).with_name('acquire-sculptures.py'))
acquire = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acquire)


class ExternalSourceReceiptTests(unittest.TestCase):
    def test_reviewed_source_keeps_attribution_and_conversion_receipt(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, output = root / 'official-downloads', root / 'prepared-originals'
            source.mkdir()
            output.mkdir()
            data = bytes(80) + struct.pack('<I12fH', 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0)
            model = {'id': 'reviewed-sculpture', 'catalogId': 'commons-sculpture-reviewed',
                     'source': 'https://commons.wikimedia.org/wiki/File:Reviewed.stl',
                     'rights': 'CC BY-SA 4.0', 'rightsUrl': acquire.SOURCE_GRANTS['CC BY-SA 4.0'],
                     'sourceCredit': 'Original sculptor; credited scanner', 'sha256': hashlib.sha256(data).hexdigest()}
            record = {**model, 'originalArchive': {'filename': 'official.zip', 'sha256': '1' * 64}}
            (source / 'reviewed-sculpture.stl').write_bytes(data)
            (source / 'reviewed-sculpture.source.json').write_text(json.dumps(record))
            imported = acquire.import_external_stl(model, source, output)
            self.assertEqual(imported['sourceCredit'], model['sourceCredit'])
            self.assertEqual(imported['originalArchive'], record['originalArchive'])
            self.assertEqual(imported['originalTriangles'], 1)
            self.assertEqual((output / 'reviewed-sculpture.stl').read_bytes(), data)

            model['rights'] = 'CC BY-NC-SA 4.0'
            model['rightsUrl'] = acquire.SOURCE_GRANTS[model['rights']]
            record.update(model)
            (source / 'reviewed-sculpture.source.json').write_text(json.dumps(record))
            self.assertEqual(acquire.import_external_stl(model, source, output)['rights'], 'CC BY-NC-SA 4.0')

            with self.assertRaisesRegex(ValueError, 'source record mismatch'):
                acquire.import_external_stl({**model, 'sha256': '2' * 64}, source, output)
            with self.assertRaisesRegex(ValueError, 'source record mismatch'):
                acquire.import_external_stl({**model, 'source': 'https://example.org/another-scan'}, source, output)
            (source / 'reviewed-sculpture.stl').write_bytes(data[:-1])
            with self.assertRaisesRegex(ValueError, 'fingerprint'):
                acquire.import_external_stl(model, source, output)

    def test_nonderivative_or_uncredited_source_is_not_admitted(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            model = {'id': 'calais', 'source': 'https://example.org/calais', 'catalogId': 'calais', 'sourceCredit': 'Scanner',
                     'rights': 'CC BY-ND 4.0', 'rightsUrl': 'https://creativecommons.org/licenses/by-nd/4.0/'}
            (directory / 'calais.source.json').write_text(json.dumps(model))
            with self.assertRaisesRegex(ValueError, 'grant'):
                acquire.import_external_stl(model, directory, directory)
            with self.assertRaisesRegex(ValueError, 'attribution'):
                acquire.import_external_stl({**model, 'rights': 'CC BY 4.0', 'rightsUrl': acquire.SOURCE_GRANTS['CC BY 4.0'], 'sourceCredit': ''}, directory, directory)
            with self.assertRaisesRegex(ValueError, 'Official external download required'):
                acquire.import_external_stl(model, None, directory)


if __name__ == '__main__':
    unittest.main()
