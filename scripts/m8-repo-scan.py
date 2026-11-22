import base64
import datetime
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
secrets = set()
def collect(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {'mnemonic', 'privateKey', 'secretKey', 'secret', 'key', 'epochKey', 'password'} and isinstance(item, str) and len(item) > 20:
                secrets.add(item)
            if key == 'canaries' and isinstance(item, list):
                secrets.update(part for part in item if isinstance(part, str))
            collect(item)
    elif isinstance(value, list):
        for item in value:
            collect(item)
for path in (root / '.accounts').rglob('*.json'):
    if 'm8-ocr' in path.parts:
        continue
    try:
        value = json.loads(path.read_text())
        if path.name == 'scan-secrets.json':
            secrets.update(value)
        collect(value)
    except (ValueError, UnicodeDecodeError):
        continue
for value in list(secrets):
    secrets.add(value.encode().hex())
    secrets.add(base64.b64encode(value.encode()).decode())
    if value.startswith('0x'):
        try:
            raw = bytes.fromhex(value[2:])
            secrets.add(value[2:])
            secrets.add(base64.b64encode(raw).decode())
        except ValueError:
            continue
paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).split(b'\0')
count = 0
for raw in paths:
    if not raw:
        continue
    path = root / raw.decode()
    if not path.is_file():
        continue
    if any(secret.encode() in path.read_bytes() for secret in secrets):
        raise SystemExit('REPOSITORY_SECRET_SCAN_FAILED: ' + raw.decode())
    count += 1
history = subprocess.check_output(['git', 'log', '-p', '2aea6bd..HEAD'], cwd=root)
if any(secret.encode() in history for secret in secrets):
    raise SystemExit('HISTORY_SECRET_SCAN_FAILED')
images = json.loads((root / 'evidence/m7b-image-secret-scan.json').read_text())
for image in images['images']:
    if hashlib.sha256((root / image['file']).read_bytes()).hexdigest() != image['sha256']:
        raise SystemExit('IMAGE_CHANGED_AFTER_SCAN')
report = {'command': 'pnpm evidence --m8-secret-scan', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'PASSED', 'repositoryFiles': count, 'historyFromExclusive': '2aea6bd', 'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip(), 'imageHashesVerified': len(images['images']), 'secretMatches': 0, 'scope': 'Exact local mnemonic, account/seal keys, private passphrases, period keys, note secrets and canaries plus encoded forms; all tracked/nonignored files and new commit diffs. OCR/visible text report is separately bound to image hashes. Not universal secret detection.'}
(root / 'evidence/m8-secret-scan.json').write_text(json.dumps(report, indent=2) + '\n')
print('REPOSITORY_SECRET_SCAN_PASSED: ' + str(count) + ' files and new commit diffs; image hashes verified')
