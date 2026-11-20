import { join } from 'node:path';
import { groth16 } from 'snarkjs';
import { packGroth16Proof, type Prover } from '@gloamtrade/sdk';
export type Circuit = 'shield' | 'transfer' | 'unshield';
export function createProver(directory: string, circuit: Circuit): Prover {
    return async (input) => {
        const { proof, publicSignals } = await groth16.fullProve(input, join(directory, `${circuit}.wasm`), join(directory, `${circuit}_final.zkey`), undefined, undefined, { singleThread: true });
        return { proofBytes: packGroth16Proof(proof), publicSignals };
    };
}
