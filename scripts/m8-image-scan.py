import hashlib
import json
import pathlib
import re
import os
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
from m8_scan_values import local_secrets

root = pathlib.Path(__file__).resolve().parent.parent
run = os.environ.get('QUAESTOR_IMAGE_RUN', 'm7b')
if run not in {'m7b', 'm9'}:
    raise SystemExit('INVALID_IMAGE_RUN')
private = root / ('.accounts/' + ('m9' if run == 'm9' else 'm7b') + '-browser')
secrets = local_secrets(root)
normalize = lambda value: re.sub(r'[^a-z0-9]', '', value.lower())
checks = [normalize(value) for value in secrets if len(normalize(value)) > 20]
engine = RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1)
results = []
images = sorted((root / ('evidence/' + run + '-screens')).glob('*.png'))
if not images:
    raise SystemExit('NO_IMAGES')
for path in images:
    image = Image.open(path).convert('RGB')
    texts = []
    for top in range(0, image.height, 900):
        result, _ = engine(np.array(image.crop((0, top, image.width, min(top + 1050, image.height)))))
        texts.extend(item[1] for item in result or [])
    if not texts:
        raise SystemExit('OCR_TEXT_REQUIRED: ' + path.name)
    dom = private / (path.stem + '-visible.txt')
    if not dom.exists():
        raise SystemExit('VISIBLE_TEXT_REQUIRED: ' + path.name)
    visible = normalize('\n'.join(texts) + '\n' + dom.read_text())
    if any(secret in visible for secret in checks):
        raise SystemExit('IMAGE_SECRET_SCAN_FAILED: ' + path.name)
    results.append({'file': str(path.relative_to(root)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'width': image.width, 'height': image.height, 'ocrFragments': len(texts), 'secretMatches': 0})
    print('IMAGE_SECRET_SCAN_PASSED: ' + path.name, flush=True)
report = {'command': 'pnpm evidence --m9-secret-scan' if run == 'm9' else 'pnpm evidence --m7b', 'status': 'PASSED', 'method': 'RapidOCR 1.4.4 plus captured visible DOM text, normalized against locally derived account/seal keys, mnemonics, journal note secrets, period keys, historical private job keys, private passphrases and canaries; values excluded', 'images': results, 'limits': 'OCR can misread glyphs; exact local values and visible DOM are checked, not arbitrary unknown secrets or hidden/steganographic data.'}
(root / ('evidence/' + run + '-image-secret-scan.json')).write_text(json.dumps(report, indent=2) + '\n')
