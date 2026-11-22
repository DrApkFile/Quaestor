import {
  buildShieldBoundIntent,
  buildPrivateSendIntent,
  buildUnshieldIntent,
  cashOutFeeLive,
  type IntentExec,
  type Prover,
  type NoteExport,
} from '@gloamtrade/sdk';
import { encodeFunctionData, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import type { ChainConfig } from './config.js';
import type { Role } from './accounts.js';
import type { Journal, Prepared, StoredNote } from './journal.js';
import { executeOperation, resolveOperation, type Gateway } from './executor.js';
import { pinnedReader, requireNotePath, syncPoolTree } from './tree.js';
export interface PoolDependencies {
  config: ChainConfig;
  reader: PublicClient;
  abi: Abi;
  journal: Journal;
  gateway: Gateway;
  owner: Role;
  provers: Record<'shield' | 'transfer' | 'unshield', Prover>;
}
export function createPool(dependencies: PoolDependencies) {
  const { config, reader, abi, journal, gateway, owner, provers } = dependencies;
  const chain = { chainId: config.chainId, poolAddress: config.pool };
  const savedNote = (commitment: Hex): StoredNote => {
    const note = journal.read().notes.find((item) => item.commitment === commitment && item.owner === owner);
    if (!note) throw new Error('NOTE_NOT_OWNED');
    return note;
  };
  const outputNote = (note: NoteExport, payee: Role): StoredNote => ({
    secret: note.secret,
    commitment: note.commitment,
    nullifier: note.nullifier,
    amountWei: note.amountWei,
    asset: note.asset,
    owner: payee,
    state: 'INCOMING',
  });
  const prepare = (
    exec: IntentExec,
    outputs: StoredNote[],
    root: Hex | null,
    nullifier: Hex | null,
    feeWei = 0n,
  ): Prepared => ({
    data: encodeFunctionData({ abi, functionName: exec.fn, args: exec.args }),
    valueWei: exec.valueWei.toString(),
    outputs,
    root,
    nullifier,
    feeWei: feeWei.toString(),
  });
  const requestKey = (parameters: unknown) =>
    JSON.stringify({ chain: config.chainId, pool: config.pool, owner, parameters });
  return {
    resolve: (id: string) => resolveOperation(journal, id, gateway),
    shield(id: string, asset: Address, amountWei: bigint) {
      return executeOperation(
        journal,
        {
          id,
          input: null,
          requestKey: requestKey(['shield', asset, amountWei.toString()]),
          async build() {
            const block = await reader.getBlockNumber({ cacheTime: 0 });
            const intent = await buildShieldBoundIntent({
              ...chain,
              asset,
              amountWei,
              prover: provers.shield,
              client: pinnedReader(reader, block),
            });
            const note = outputNote({ ...intent.note, amountWei: amountWei.toString(), asset }, owner);
            return prepare(intent.exec, [note], null, null);
          },
        },
        gateway,
      );
    },
    privateSend(id: string, commitment: Hex, amountPayWei: bigint, payee: Role) {
      return executeOperation(
        journal,
        {
          id,
          input: commitment,
          requestKey: requestKey(['privateSend', commitment, amountPayWei.toString(), payee]),
          async build() {
            const note = savedNote(commitment);
            const block = await reader.getBlockNumber({ cacheTime: 0 });
            const { tree } = await syncPoolTree(reader, config, abi, block);
            const path = await requireNotePath(tree, commitment);
            const intent = await buildPrivateSendIntent({
              ...chain,
              asset: note.asset,
              secretHex: note.secret,
              amountInWei: BigInt(note.amountWei),
              amountPayWei,
              path,
              prove: provers.transfer,
            });
            return prepare(
              intent.exec,
              [outputNote(intent.paymentNote, payee), outputNote(intent.changeNote, owner)],
              tree.root,
              note.nullifier,
            );
          },
        },
        gateway,
      );
    },
    unshield(id: string, commitment: Hex, to: Address) {
      return executeOperation(
        journal,
        {
          id,
          input: commitment,
          requestKey: requestKey(['unshield', commitment, to]),
          async build() {
            const note = savedNote(commitment);
            const block = await reader.getBlockNumber({ cacheTime: 0 });
            const pinned = pinnedReader(reader, block);
            const { tree } = await syncPoolTree(reader, config, abi, block);
            const path = await requireNotePath(tree, commitment);
            const fee = await cashOutFeeLive(pinned, config.pool, BigInt(note.amountWei));
            const intent = await buildUnshieldIntent({
              ...chain,
              asset: note.asset,
              secretHex: note.secret,
              amountWei: BigInt(note.amountWei),
              to,
              path,
              prove: provers.unshield,
              client: pinned,
            });
            return prepare(intent.exec, [], tree.root, note.nullifier, fee.fee);
          },
        },
        gateway,
      );
    },
  };
}
