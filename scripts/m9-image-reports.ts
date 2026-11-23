import { z } from 'zod';
const image = z
  .object({
    file: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    ocrFragments: z.number().int().positive(),
    secretMatches: z.literal(0),
  })
  .strict();
const report = z
  .object({ status: z.literal('PASSED'), images: z.array(image), method: z.string(), limits: z.string() })
  .passthrough();
export function mergeImageReports(raw: readonly unknown[], expected: readonly { file: string; sha256: string }[]) {
  const parts = z.tuple([report, report]).parse(raw),
    images = parts.flatMap((part) => part.images);
  if (
    !expected.length ||
    images.length !== expected.length ||
    new Set(images.map((value) => value.file)).size !== expected.length ||
    expected.some((value) => !images.some((scanned) => scanned.file === value.file && scanned.sha256 === value.sha256))
  )
    throw new Error('IMAGE_SCAN_INCOMPLETE_OR_CHANGED');
  return {
    command: 'pnpm evidence --m9-secret-scan',
    status: 'PASSED' as const,
    method: parts[0].method,
    limits: parts[0].limits,
    images: images.sort((a, b) => a.file.localeCompare(b.file)),
  };
}
