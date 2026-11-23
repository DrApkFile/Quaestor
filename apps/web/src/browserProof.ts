import { groth16 } from 'snarkjs';
import { packGroth16Proof, type Prover } from '@gloamtrade/sdk';
import { loadCircuit, type CircuitName, type DownloadProgress } from './circuits.js';
export async function browserProof(
  name: CircuitName,
  input: Record<string, string | string[] | string[][]>,
  progress: (value: DownloadProgress | string) => void,
) {
  const assets = await loadCircuit(name, true, progress);
  const required = (file: string) => {
    const response = assets.get(file);
    if (!response) throw new Error('CIRCUIT_UNAVAILABLE');
    return response;
  };
  const wasm = new Uint8Array(await required(`${name}.wasm`).arrayBuffer());
  const zkey = new Uint8Array(await required(`${name}_final.zkey`).arrayBuffer());
  const vkey: unknown = await required(`${name}_vkey.json`).json();
  progress(
    name === 'transfer'
      ? 'Building your private payment proof… usually 5–15 s'
      : 'Building your private proof… usually 5–15 s',
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  const result = await groth16.fullProve(input, wasm, zkey, undefined, undefined, { singleThread: true });
  if (!(await groth16.verify(vkey, result.publicSignals, result.proof, undefined, { singleThread: true })))
    throw new Error('BAD_PROOF');
  progress(`${name} proved`);
  return result;
}
export const browserProver =
  (
    name: 'shield' | 'transfer' | 'unshield',
    progress: (value: DownloadProgress | string) => void,
    remember?: (input: Record<string, string | string[] | string[][]>) => void,
  ): Prover =>
  async (input) => {
    remember?.(input);
    const result = await browserProof(name, input, progress);
    return { proofBytes: packGroth16Proof(result.proof), publicSignals: result.publicSignals };
  };
