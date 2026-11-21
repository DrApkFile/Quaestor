import { generateMnemonic, deriveUnifiedAccount, EthNativeSigner, openEvmWindowMsg } from '@qorechain/sdk';
import { deriveSealKeys, seal, open, recipientOf } from '@qorechain/qoreseal';
import { signMessage, verifyMessage } from '@qorechain/qoresign';
import { buildShieldBoundIntent, packGroth16Proof } from '@gloamtrade/sdk';
import { hexToBytes, toBytes, zeroAddress } from 'viem';
import { StargateClient } from '@cosmjs/stargate';
import { loadCircuit } from './circuits.js';
import { groth16 } from 'snarkjs';
export async function cryptoSpike() {
  const start = performance.now();
  const mnemonic = generateMnemonic();
  const account = await deriveUnifiedAccount(mnemonic, 0);
  const sdkMs = performance.now() - start;
  const keys = deriveSealKeys({ mnemonic, index: 0 });
  const data = toBytes('Browser fixture (demo)');
  const sig = signMessage({
    chainId: 'qorechain-diana',
    signer: account.cosmos,
    data,
    classicalKey: {
      type: 'eth_secp256k1',
      privateKey: hexToBytes(account.privateKey as `0x${string}`),
      publicKey: hexToBytes(account.publicKey as `0x${string}`),
    },
    pqKey: { secretKey: account.pqc.secretKey },
  });
  verifyMessage({
    chainId: 'qorechain-diana',
    signer: account.cosmos,
    data,
    signature: sig,
    pqPublicKey: account.pqc.publicKey,
    requirePq: true,
  });
  const envelope = seal({
    chainId: 'qorechain-diana',
    purpose: 'quaestor:browser-spike',
    mode: 'hybrid',
    anonymous: true,
    recipients: [recipientOf(keys)],
    plaintext: data,
  });
  const opened = open({ chainId: 'qorechain-diana', purpose: 'quaestor:browser-spike', envelope, keys });
  if (new TextDecoder().decode(opened) !== new TextDecoder().decode(data)) throw new Error('SEAL_SPIKE_FAILED');
  const native = new EthNativeSigner(account, { signMode: 'hybrid', signBytesVersion: 'v2' }).sign({
    chainId: 'qorechain-diana',
    accountNumber: 0n,
    sequence: 0n,
    fee: { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' },
    messages: [openEvmWindowMsg({ sender: account.cosmos, blocks: 10n, maxTxs: 1n, maxValue: 1000000n })],
    signBytesVersion: 'v2',
  });
  let proofVerified = false;
  const downloads = new Map<string, { file: string; cached: boolean; loaded: number }>();
  const assets = await loadCircuit('shield', true, (state) => {
    downloads.set(state.file, { file: state.file, cached: state.cached, loaded: state.loaded });
  });
  const required = (name: string) => {
    const response = assets.get(name);
    if (!response) throw new Error('CIRCUIT_UNAVAILABLE');
    return response;
  };
  const wasm = new Uint8Array(await required('shield.wasm').arrayBuffer());
  const zkey = new Uint8Array(await required('shield_final.zkey').arrayBuffer());
  const vkey: unknown = await required('shield_vkey.json').json();
  const proveStart = performance.now();
  await buildShieldBoundIntent({
    chainId: 9800,
    poolAddress: '0x27dD6Fd63B1CFdce96F6202B259E45A9587C8C55',
    amountWei: 1_000_000_000_000_000_000n,
    asset: zeroAddress,
    async prover(input) {
      const result = await groth16.fullProve(input, wasm, zkey, undefined, undefined, { singleThread: true });
      proofVerified = await groth16.verify(vkey, result.publicSignals, result.proof, undefined, { singleThread: true });
      return { proofBytes: packGroth16Proof(result.proof), publicSignals: result.publicSignals };
    },
  });
  const warm: boolean[] = [];
  await loadCircuit('shield', true, (state) => {
    warm.push(state.cached);
  });
  const transport = await StargateClient.connect(`${location.origin}/api/qore/rpc`);
  const broadcastReceipt = await transport.getTx('F821A2BB83C65E3A529C8D3D0E94E04ADD34C5C58A9D7E6DFB4AAE228E18C5F9');
  transport.disconnect();
  return {
    sdkReceiptRead: broadcastReceipt?.code === 0,
    warmCircuitCacheHits: warm.filter(Boolean).length,
    circuitDownloads: [...downloads.values()],
    sdkDerived: true,
    browserHybridSigned: native.txRawBytes.length > 0,
    sdkMs,
    hybridSignatureVerified: true,
    anonymousHybridOpened: true,
    shieldProofVerified: proofVerified,
    shieldMs: performance.now() - proveStart,
    totalMs: performance.now() - start,
  };
}
export async function corsSpike(address: string) {
  const evm = 'https://evm-testnet.qore.host';
  const relay = new URLSearchParams(location.search).get('relay') === '1';
  const rest = relay ? `${location.origin}/api/qore/rest` : 'https://api-testnet.qore.host';
  const rpc = relay ? `${location.origin}/api/qore/rpc` : 'https://rpc-testnet.qore.host';
  let height: string | null = null;
  try {
    const data: unknown = await (
      await fetch(evm, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      })
    ).json();
    if (typeof data === 'object' && data !== null && 'result' in data && typeof data.result === 'string')
      height = BigInt(data.result).toString();
  } catch {
    height = null;
  }
  const tests = [
    ['kem', `${rest}/qorechain/pqc/v1/kem/${address}`],
    ['account', `${rest}/qorechain/pqc/v1/account/${address}`],
    ['evm_window', `${rest}/qorechain/pqc/v1/evm_window/${address}`],
    ['cosmos_auth', `${rest}/cosmos/auth/v1beta1/accounts/${address}`],
  ] as const;
  const results = [];
  for (const [name, url] of tests) {
    for (const pinned of [false, true]) {
      try {
        const response = await fetch(url, { headers: pinned && height ? { 'x-cosmos-block-height': height } : {} });
        await response.text();
        results.push({ name, pinned, ok: response.ok, status: response.status });
      } catch {
        results.push({ name, pinned, ok: false, status: null });
      }
    }
  }
  let consensus = false;
  try {
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'status', params: {} }),
    });
    const value: unknown = await response.json();
    consensus = response.ok && typeof value === 'object' && value !== null && 'result' in value;
  } catch {
    consensus = false;
  }
  return { evm: height !== null, height, consensus, rest: results };
}
Object.assign(window, {
  quaestorSpike: {
    crypto: cryptoSpike,
    cors: corsSpike,
    broadcast: async (tx: string) => {
      const response = await fetch('/api/qore/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'broadcast_tx_sync', params: { tx } }),
      });
      return (await response.json()) as unknown;
    },
  },
});
