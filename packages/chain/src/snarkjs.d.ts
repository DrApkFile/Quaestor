declare module 'snarkjs' {
  import type { Groth16Proof } from '@gloamtrade/sdk';
  export const groth16: {
    fullProve(
      input: Record<string, string | string[]>,
      wasm: string,
      zkey: string,
      logger: undefined,
      witnessOptions: undefined,
      proverOptions: {
        singleThread: true;
      },
    ): Promise<{
      proof: Groth16Proof;
      publicSignals: string[];
    }>;
    verify(
      vkey: unknown,
      signals: readonly string[],
      proof: Groth16Proof,
      logger: undefined,
      options: {
        singleThread: true;
      },
    ): Promise<boolean>;
  };
}
