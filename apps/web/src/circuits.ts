import { z } from 'zod';
export type CircuitName = 'shield' | 'transfer' | 'unshield' | 'receipt' | 'funds';
export interface DownloadProgress {
  file: string;
  loaded: number;
  total: number | null;
  cached: boolean;
}
const files = (name: CircuitName, proof: boolean) =>
  proof ? [`${name}.wasm`, `${name}_final.zkey`, `${name}_vkey.json`] : [`${name}_vkey.json`];
async function download(file: string, progress: (state: DownloadProgress) => void) {
  const url = `/circuits/${file}`;
  const cache = await caches.open('quaestor-circuits-v1');
  const saved = await cache.match(url);
  if (saved) {
    progress({ file, loaded: Number(saved.headers.get('content-length') ?? 0), total: null, cached: true });
    return saved;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error('CIRCUIT_UNAVAILABLE');
  const total = Number(response.headers.get('content-length')) || null;
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    progress({ file, loaded, total, cached: false });
  }
  const blob = new Blob(parts.map((part) => Uint8Array.from(part)));
  const stored = new Response(blob, {
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
      'content-length': String(loaded),
    },
  });
  await cache.put(url, stored.clone());
  return stored;
}
export async function loadCircuit(name: CircuitName, proof: boolean, progress: (state: DownloadProgress) => void) {
  const result = new Map<string, Response>();
  for (const file of files(name, proof)) result.set(file, await download(file, progress));
  return result;
}
export async function cachedVkey(
  name: 'receipt' | 'funds',
  progress: (state: DownloadProgress) => void,
): Promise<unknown> {
  const assets = await loadCircuit(name, false, progress);
  const response = assets.get(`${name}_vkey.json`);
  if (!response) throw new Error('CIRCUIT_UNAVAILABLE');
  const data: unknown = await response.json();
  return z
    .object({ protocol: z.literal('groth16'), curve: z.literal('bn128'), nPublic: z.number().int() })
    .passthrough()
    .parse(data);
}
