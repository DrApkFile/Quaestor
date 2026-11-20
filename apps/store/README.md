# @quaestor/store

Content-addressed ciphertext store (key = SHA3-256 of the bytes). Accepts only QoreSeal envelopes, sealed batches and signed records; everything else is a 400. Never sees plaintext or keys.
Built in milestone M5.
