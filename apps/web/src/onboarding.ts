import { automaticWindow } from './automaticWindow.js';
import {
  buildRegisterPqcKeyMsg,
  signProofOfPossession,
  openEvmWindowMsg,
  qorechainTypes,
  type UnifiedAccount,
} from '@qorechain/sdk';
import { buildRegisterKemKeyMessage } from '@qorechain/qoreseal';
import { fetchKemKey } from '@qorechain/qoreseal/network';
import { fetchPqKeyStatus } from '@qorechain/qoresign/network';
import { toHex } from 'viem';
import {
  createCard,
  accountSealKeys,
  verifyCard,
  cardSchema,
  registryFetch,
  postBlob,
  createGateway,
  resolveOperation,
  publicRecordBytes,
  discoverJSON,
} from '@quaestor/chain/browser';
import { hashBytes } from '@quaestor/core';
import { browserChain, client, deployment, readerConfig } from './client.js';
import { nativeAction } from './nativeClient.js';
import { BrowserJournal } from './browserJournal.js';
import { dbGet, dbPut } from './db.js';
import { activationReceipts } from './activationReceipts.js';
export async function onboardingStatus(account: UnifiedAccount) {
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const options = { rest: browserChain.rest, address: account.cosmos, fetch: registryFetch(browserChain, block) };
  const [pq, kem, balance] = await Promise.all([
    fetchPqKeyStatus(options),
    fetchKemKey(options),
    client.getBalance({ address: account.evm as `0x${string}`, blockNumber: block }),
  ]);
  const keys = accountSealKeys(account);
  const pqMatches =
    !pq.registered || (pq.publicKey !== undefined && toHex(pq.publicKey) === toHex(account.pqc.publicKey));
  const kemMatches =
    !kem.registered || (kem.publicKey !== undefined && toHex(kem.publicKey) === toHex(keys.mlkemPublicKey));
  let cardPublished = false;
  if (
    pq.registered &&
    pq.possessionProven &&
    pq.publicKey &&
    kem.registered &&
    kem.publicKey &&
    pqMatches &&
    kemMatches
  ) {
    const cards = await discoverJSON(
      readerConfig(() => undefined),
      'card',
      block,
    );
    const registry = {
      address: account.cosmos,
      block,
      pqPublicKey: pq.publicKey,
      mlkemPublicKey: kem.publicKey,
      possessionProven: true,
    };
    cardPublished = cards.some((card) => verifyCard(card, registry).kind === 'VERIFIED');
  }
  return {
    block: block.toString(),
    balance: balance.toString(),
    funded: balance > 0n,
    pqRegistered: pq.registered && pq.algorithmId === 1 && pq.possessionProven === true,
    kemRegistered: kem.registered && kem.algorithmId === 2,
    keysMatch: pqMatches && kemMatches,
    cardPublished,
  };
}
export async function registerPQ(account: UnifiedAccount, backup: boolean) {
  if (!backup) throw new Error('BACKUP_REQUIRED');
  const status = await onboardingStatus(account);
  if (!status.keysMatch) throw new Error('REGISTRY_KEY_MISMATCH');
  if (status.pqRegistered) return;
  const proofOfPossession = signProofOfPossession({
    chainId: 'qorechain-diana',
    account: account.cosmos,
    keypair: account.pqc,
  });
  await nativeAction(account, backup, 'pqc-register', 'classical', [
    buildRegisterPqcKeyMsg(account.cosmos, { pqcKeypair: account.pqc, proofOfPossession }),
  ]);
}
export async function registerKEM(account: UnifiedAccount, backup: boolean) {
  if (!backup) throw new Error('BACKUP_REQUIRED');
  const status = await onboardingStatus(account);
  if (!status.keysMatch) throw new Error('KEM_KEY_MISMATCH');
  if (status.kemRegistered) return;
  const keys = accountSealKeys(account);
  const encoded = buildRegisterKemKeyMessage({ sender: account.cosmos, mlkemPublicKey: keys.mlkemPublicKey });
  await nativeAction(account, backup, 'kem-register', 'hybrid', [
    { typeUrl: encoded.typeUrl, value: qorechainTypes.pqc.MsgRegisterKEMKey.decode(encoded.value) },
  ]);
}
export async function publishCard(account: UnifiedAccount, backup: boolean) {
  if (!backup) throw new Error('BACKUP_REQUIRED');
  const status = await onboardingStatus(account);
  if (!status.pqRegistered || !status.kemRegistered || !status.keysMatch) throw new Error('REGISTRY_NOT_READY');
  const key = `card-plan:${account.cosmos}`;
  const saved = await dbGet('journal', key);
  const keys = accountSealKeys(account);
  const card =
    saved === undefined
      ? createCard(account, keys, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'))
      : cardSchema.parse(saved);
  await dbPut('journal', key, card);
  const journal = await BrowserJournal.open(account.cosmos);
  await activationReceipts(account.cosmos);
  const gateway = createGateway(browserChain, account, client, [], deployment.board.address);
  const safeGateway = {
    ...automaticWindow(
      gateway,
      account,
      deployment.board.address,
      () => ({ operations: 1, valueWei: 0n }),
      async (operations, maxValue) => {
        await nativeAction(account, backup, `window-${hashBytes(publicRecordBytes(card))}-${status.block}`, 'hybrid', [
          openEvmWindowMsg({ sender: account.cosmos, blocks: 600n, maxTxs: BigInt(operations), maxValue }),
        ]);
      },
    ),
    broadcast: async (serialized: `0x${string}`) => {
      await journal.flush();
      return gateway.broadcast(serialized);
    },
  };
  for (const operation of journal.read().operations)
    if (operation.stage === 'BROADCAST' || operation.stage === 'OUTCOME_UNKNOWN') {
      const resolved = await resolveOperation(journal, operation.id, safeGateway);
      if (resolved.kind !== 'LANDED') throw new Error(resolved.kind);
    }
  const abi = [
    {
      type: 'function',
      name: 'post',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'kind', type: 'bytes32' },
        { name: 'sha3', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
      ],
      outputs: [],
    },
  ] as const;
  const result = await postBlob(
    journal,
    `card-${hashBytes(publicRecordBytes(card)).slice(2)}`,
    deployment.board.address,
    'card',
    publicRecordBytes(card),
    abi,
    safeGateway,
  );
  if (result.kind !== 'LANDED') throw new Error(result.kind);
}
