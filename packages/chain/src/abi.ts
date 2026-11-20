import { readFileSync } from 'node:fs';
import type { Abi } from 'viem';
import { z } from 'zod';
export function loadPoolAbi(path: string): Abi {
    const body: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const artifact = z.object({ abi: z.array(z.object({ type: z.string() }).passthrough()) }).passthrough().parse(body);
    return artifact.abi as unknown as Abi;
}
