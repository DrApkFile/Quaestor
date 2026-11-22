import type { UnifiedAccount } from '@qorechain/sdk';
import { hexToBytes, toHex, type Abi, type Hex } from 'viem';
import {
  createGateway,
  createPool,
  executeOperation,
  resolveOperation,
  accountSealKeys,
  type Prepared,
  type Gateway,
} from '@quaestor/chain/browser';
import type { SigningKeys } from '@quaestor/core';
import { PrivateJournal } from '../privateJournal.js';
import { privateStorage, type PrivateStorage } from '../privateStore.js';
import { browserChain, client, deployment } from '../client.js';
import { browserProver } from '../browserProof.js';
import type { DownloadProgress } from '../circuits.js';
import { emptyState, stateSchema, type BusinessState } from './schema.js';
import poolArtifact from '../abi/pool.json';
import memoArtifact from '../abi/memo.json';
import booksArtifact from '../abi/books.json';
import boardArtifact from '../abi/board.json';
import { z } from 'zod';
const abi = (value: unknown): Abi =>
  z
    .object({ abi: z.array(z.object({ type: z.string() }).passthrough()) })
    .passthrough()
    .parse(value).abi as unknown as Abi;
export const poolAbi = abi(poolArtifact),
  memoAbi = abi(memoArtifact),
  booksAbi = abi(booksArtifact),
  boardAbi = abi(boardArtifact);
export class BusinessRuntime {
  state: BusinessState = emptyState();
  private queue = Promise.resolve();
  private readonly witnessSecrets = new Set<string>();
  private readonly gateways = new Map<Hex, Gateway>();
  readonly sealKeys;
  readonly signing: SigningKeys;
  constructor(
    readonly account: UnifiedAccount,
    readonly journal: PrivateJournal,
    readonly storage: PrivateStorage,
    readonly progress: (value: DownloadProgress | string) => void,
  ) {
    this.sealKeys = accountSealKeys(account);
    this.signing = {
      signer: account.cosmos,
      classicalKey: {
        type: 'eth_secp256k1',
        privateKey: hexToBytes(account.privateKey as Hex),
        publicKey: hexToBytes(account.publicKey as Hex),
      },
      pqKey: { secretKey: account.pqc.secretKey },
    };
  }
  static async open(account: UnifiedAccount, progress: (value: DownloadProgress | string) => void) {
    const storage = await privateStorage(account.cosmos, account.pqc.secretKey);
    const journal = await PrivateJournal.open(storage, account.cosmos);
    const runtime = new BusinessRuntime(account, journal, storage, progress);
    const saved = await storage.get('business');
    if (saved !== undefined) runtime.state = stateSchema.parse(saved);
    return runtime;
  }
  rememberSecret(value: string) {
    if (value.length > 20) this.witnessSecrets.add(value);
  }
  secretChecks() {
    return [...this.witnessSecrets];
  }
  rememberWitness(input: Record<string, string | string[] | string[][]>) {
    for (const [name, value] of Object.entries(input))
      if (/secret/i.test(name))
        for (const text of typeof value === 'string' ? [value] : value.flat()) {
          if (/^\d+$/.test(text) && BigInt(text) > 1n) {
            this.rememberSecret(text);
            this.rememberSecret(toHex(BigInt(text), { size: 32 }));
          }
        }
  }
  save() {
    const data = stateSchema.parse(structuredClone(this.state));
    this.queue = this.queue.then(() => this.storage.put('business', data));
    return this.queue;
  }
  gateway(to: Hex = browserChain.pool) {
    const cached = this.gateways.get(to);
    if (cached) return cached;
    const gateway = createGateway(browserChain, this.account, client, poolAbi, to);
    const result = this.journal.protectGateway(gateway, () => this.save());
    this.gateways.set(to, result);
    return result;
  }

  pool() {
    return createPool({
      config: browserChain,
      reader: client,
      abi: poolAbi,
      journal: this.journal,
      gateway: this.gateway(),
      owner: this.journal.owner,
      provers: {
        shield: browserProver('shield', this.progress, (input) => this.rememberWitness(input)),
        transfer: browserProver('transfer', this.progress, (input) => this.rememberWitness(input)),
        unshield: browserProver('unshield', this.progress, (input) => this.rememberWitness(input)),
      },
    });
  }
  async requireResult(id: string, result: Awaited<ReturnType<typeof executeOperation>>) {
    if (result.kind !== 'LANDED' || !result.operation.hash || !result.operation.receipt) throw new Error(result.kind);
    if (!this.state.transactions.some((tx) => tx.id === id))
      this.state.transactions.push({ id, hash: result.operation.hash, block: result.operation.receipt.blockNumber });
    await this.save();
    return result.operation;
  }
  async call(id: string, to: Hex, data: Hex) {
    const prepared: Prepared = { data, valueWei: '0', outputs: [], root: null, nullifier: null, feeWei: '0' };
    return this.requireResult(
      id,
      await executeOperation(
        this.journal,
        { id, input: null, requestKey: data, build: () => Promise.resolve(prepared) },
        this.gateway(to),
      ),
    );
  }
  async resolve() {
    for (const operation of this.journal.read().operations) {
      if (operation.stage === 'OUTCOME_UNKNOWN' || operation.stage === 'BROADCAST')
        await this.requireResult(operation.id, await resolveOperation(this.journal, operation.id, this.gateway()));
    }
  }
}
export { browserChain, client, deployment };
