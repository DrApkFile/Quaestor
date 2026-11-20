import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildShieldBoundIntent } from '@gloamtrade/sdk';
import { decodeAbiParameters, zeroAddress } from 'viem';
import { groth16 } from 'snarkjs';
import { expect, it } from 'vitest';
import { createProver } from '../src/prover.js';
it('T-PROVER verifies a real offline single-threaded shield proof against the self-hosted checking key', async () => {
    const directory = fileURLToPath(new URL('../../../apps/web/public/circuits/', import.meta.url));
    const prove = createProver(directory, 'shield');
    let verified = false;
    await buildShieldBoundIntent({ chainId: 9800, poolAddress: '0x27dD6Fd63B1CFdce96F6202B259E45A9587C8C55',
        amountWei: 5000000000000000000n, asset: zeroAddress, async prover(input) {
            const result = await prove(input);
            const [a, b, c] = decodeAbiParameters([
                { type: 'uint256[2]' }, { type: 'uint256[2][2]' }, { type: 'uint256[2]' },
            ], result.proofBytes);
            const proof = { pi_a: [...a.map(String), '1'], pi_b: [
                    [String(b[0][1]), String(b[0][0])], [String(b[1][1]), String(b[1][0])], ['1', '0'],
                ], pi_c: [...c.map(String), '1'] };
            const vkey: unknown = JSON.parse(readFileSync(`${directory}/shield_vkey.json`, 'utf8'));
            if (!result.publicSignals)
                throw new Error('PUBLIC_SIGNALS_REQUIRED');
            verified = await groth16.verify(vkey, result.publicSignals, proof, undefined, { singleThread: true });
            return result;
        } });
    expect(verified).toBe(true);
}, 30000);
