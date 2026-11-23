import base64
import json
import re

def local_secrets(root):
    secrets = set()
    def collect(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if isinstance(item, str) and len(item) > 20:
                    explicit = key in {'mnemonic', 'privateKey', 'secretKey', 'secret', 'password'}
                    material = key in {'key', 'epochKey'} and re.fullmatch(r'(?:0x)?[a-fA-F0-9]{64}|[A-Za-z0-9+/]{43}=', item)
                    if explicit or material:
                        secrets.add(item)
                if key == 'canaries' and isinstance(item, list):
                    secrets.update(part for part in item if isinstance(part, str))
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
    for path in (root / '.accounts').rglob('*.json'):
        if 'm8-ocr' in path.parts or 'tmp' in path.parts:
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
    return secrets
