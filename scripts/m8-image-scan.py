import hashlib
import json
import pathlib
import re
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

root = pathlib.Path(__file__).resolve().parent.parent
private = root / '.accounts/m7b-browser'
secrets = json.loads((private / 'scan-secrets.json').read_text())
normalize = lambda value: re.sub(r'[^a-z0-9]', '', value.lower())
checks = [normalize(value) for value in secrets if len(normalize(value)) > 20]
engine = RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1)
results = []
images = sorted((root / 'evidence/m7b-screens').glob('*.png'))
if not images:
    raise SystemExit('NO_IMAGES')
for path in images:
    image = Image.open(path).convert('RGB')
    texts = []
    for top in range(0, image.height, 900):
        result, _ = engine(np.array(image.crop((0, top, image.width, min(top + 1050, image.height)))))
        texts.extend(item[1] for item in result or [])
    dom = private / (path.stem + '-visible.txt')
    if not dom.exists():
        raise SystemExit('VISIBLE_TEXT_REQUIRED: ' + path.name)
    visible = normalize('\n'.join(texts) + '\n' + dom.read_text())
    if any(secret in visible for secret in checks):
        raise SystemExit('IMAGE_SECRET_SCAN_FAILED: ' + path.name)
    results.append({'file': str(path.relative_to(root)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'width': image.width, 'height': image.height, 'ocrFragments': len(texts), 'secretMatches': 0})
    print('IMAGE_SECRET_SCAN_PASSED: ' + path.name, flush=True)
report = {'command': 'pnpm evidence --m7b', 'status': 'PASSED', 'method': 'RapidOCR 1.4.4 plus captured visible DOM text, normalized against locally derived account/seal keys, mnemonics, journal note secrets, period keys, private passphrase and canaries; values excluded', 'images': results, 'limits': 'OCR can misread glyphs; exact local values and visible DOM are checked, not arbitrary unknown secrets or hidden/steganographic data.'}
(root / 'evidence/m7b-image-secret-scan.json').write_text(json.dumps(report, indent=2) + '\n')
