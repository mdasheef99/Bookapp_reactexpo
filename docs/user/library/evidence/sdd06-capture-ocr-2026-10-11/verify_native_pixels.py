"""Independent Pillow oracle and binary readback of session-owned emulator fixtures."""
from pathlib import Path
from PIL import Image, ImageOps
import json
import subprocess
import numpy as np

root = Path(__file__).parent
out = root / 'native'
out.mkdir(exist_ok=True)
adb = r'C:\Users\LEGION\AppData\Local\Android\Sdk\platform-tools\adb.exe'
names = ['capture-proof.json', 'regions-crop.png', 'regions-rotated.png', 'regions-rotated-crop.png', 'exif-decoded.png', 'exif-rotated.png', 'english-selection.png']
for name in names:
    with (out / name).open('wb') as target:
        subprocess.run([adb, '-s', 'emulator-5556', 'exec-out', 'run-as', 'com.bookconnect.library.dev', 'cat', 'files/' + name], stdout=target, check=True)

grid = Image.open(root / 'fixtures/regions.png').convert('RGB')
rotated = grid.transpose(Image.Transpose.ROTATE_270)
exif = ImageOps.exif_transpose(Image.open(root / 'fixtures/oriented-regions.jpg')).convert('RGB')
page = Image.open(root / 'fixtures/english-page.png').convert('RGB')
expected = {
    'regions-crop.png': (grid.crop((30, 20, 90, 60)), 0),
    'regions-rotated.png': (rotated, 0),
    'regions-rotated-crop.png': (rotated.crop((20, 30, 60, 90)), 0),
    'exif-decoded.png': (exif, 3),
    'exif-rotated.png': (exif.transpose(Image.Transpose.ROTATE_270), 3),
    'english-selection.png': (page.crop((160, 440, 1440, 1540)), 0),
}
checks = []
for name, (oracle, tolerance) in expected.items():
    actual = Image.open(out / name).convert('RGB')
    same_size = actual.size == oracle.size
    maximum = int(np.max(np.abs(np.asarray(actual, dtype=np.int16) - np.asarray(oracle, dtype=np.int16)))) if same_size else None
    passed = same_size and maximum <= tolerance
    checks.append({'file': name, 'dimensions': actual.size, 'expected': oracle.size, 'max_channel_error': maximum, 'tolerance': tolerance, 'status': 'PASS' if passed else 'FAIL'})
    assert passed, checks[-1]

record = json.loads((out / 'capture-proof.json').read_text())
assert 'error' not in record, record.get('error')
ocr = [item for item in record['records'] if item.get('provider') == 'on-device']
for item in ocr:
    assert 'OUTSIDE' not in item['reviewText'].upper(), item['fixture']
    assert 'A reader walks' in item['reviewText'], item['fixture']
    assert not item['reviewOverflow']
assert any(item.get('canceled') is True for item in record['records'])
assert any(item.get('restored') is True for item in record['records'])
summary = {'oracle': 'Pillow literal source-pixel rectangles and independent clockwise transpose; not captureGeometry', 'checks': checks, 'ocr': [{'fixture': item['fixture'], 'elapsedMs': item['elapsedMs'], 'excluded_sentinels_absent': True} for item in ocr], 'status': 'PASS'}
(out / 'pixel-verification.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
