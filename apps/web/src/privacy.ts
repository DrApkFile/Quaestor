import type { UnifiedAccount } from '@qorechain/sdk';
import type { SealKeyPair } from '@qorechain/qoreseal';
import { toHex, toBytes } from 'viem';
import type { BusinessRuntime } from './business/runtime.js';
export function privateMatcher(account: UnifiedAccount, keys: SealKeyPair, notes: readonly string[], input: string) {
  const decimals = notes.filter((value) => /^0x[\da-f]{64}$/i.test(value)).map((value) => BigInt(value).toString());
  const rawNotes = notes.filter((value) => /^0x[\da-f]{64}$/i.test(value)).map((value) => value.slice(2));
  const strings = [
    ...rawNotes,
    ...decimals,
    account.mnemonic ?? '',
    account.privateKey,
    account.privateKey.slice(2),
    ...notes,
  ];
  for (const bytes of [
    toBytes(account.privateKey),
    keys.seed,
    keys.mlkemSecretKey,
    keys.x25519SecretKey,
    account.pqc.secretKey,
  ])
    strings.push(
      toHex(bytes),
      toHex(bytes).slice(2),
      Buffer.from(bytes).toString('base64'),
      JSON.stringify(Array.from(bytes)),
      JSON.stringify(bytes),
    );
  const normalized = input.toLowerCase();
  return [...new Set(strings)]
    .filter((value) => value.length > 20)
    .some((value) => input.includes(value) || normalized.includes(toHex(toBytes(value)).slice(2).toLowerCase()));
}
export function installAuditPrivacy(account: UnifiedAccount, keys: SealKeyPair) {
  Object.assign(window, { quaestorPrivateCheck: (input: string) => privateMatcher(account, keys, [], input) });
}
export function publicSnapshot(runtime: BusinessRuntime) {
  return {
    address: runtime.account.cosmos,
    transactions: runtime.state.transactions,
    nativeTransactions: runtime.state.nativeTransactions,
    operations: runtime.journal.read().operations.map((operation) => ({
      id: operation.id,
      stage: operation.stage,
      hash: operation.hash,
      gas: operation.gas,
      receipt: operation.receipt,
    })),
    payments: runtime.state.payments.map((payment) => ({
      id: payment.id,
      direction: payment.direction,
      stage: payment.stage,
      commitment: payment.note.commitment,
    })),
    books: runtime.state.books.map((book) => ({
      id: book.id,
      mode: book.mode,
      active: book.active,
      periods: book.periods.map((period) => ({ id: period.id, closed: period.closed, count: period.entries.length })),
    })),
    scanBlock: runtime.state.scanBlock,
  };
}
export function installPrivacyMonitor(runtime: BusinessRuntime | null) {
  Object.assign(window, {
    quaestorPrivateCheck: runtime
      ? (input: string) => {
          const data = runtime.journal.read();
          return privateMatcher(
            runtime.account,
            runtime.sealKeys,
            [
              ...runtime.secretChecks(),
              ...data.notes.map((note) => note.secret),
              ...data.operations.flatMap((operation) => operation.prepared?.outputs.map((note) => note.secret) ?? []),
            ],
            input,
          );
        }
      : undefined,
    quaestorM6: runtime ? { snapshot: () => publicSnapshot(runtime) } : undefined,
  });
}
declare global {
  interface Window {
    quaestorPrivateCheck?: (input: string) => boolean;
    quaestorM6?: { snapshot(): ReturnType<typeof publicSnapshot> };
  }
}
