import { fetchKemKey } from '@qorechain/qoreseal/network';
import { parseAddress } from '@qorechain/qoresign';
import { readRegistry, registryFetch, verifyCard, discoverJSON } from '@quaestor/chain/browser';
import { readerConfig } from '../client.js';
import { browserChain, client } from './runtime.js';
export async function resolveRecipient(input: string, block: bigint) {
  let address: string;
  try {
    address = parseAddress(input).bech32;
  } catch {
    throw new Error('CARD_INVALID');
  }
  if (address !== input || !input.startsWith('qor1')) throw new Error('CARD_INVALID');
  const kem = await fetchKemKey({ rest: browserChain.rest, address, fetch: registryFetch(browserChain, block) });
  if (!kem.registered) throw new Error('NO_KEM_KEY');
  const registry = await readRegistry(browserChain, address, block).catch((error: unknown) => {
    if (error instanceof Error && error.message === 'PQ_POSSESSION_NOT_PROVEN') throw new Error('CARD_INVALID');
    throw error;
  });
  const cards = await discoverJSON(
    readerConfig(() => undefined),
    'card',
    block,
  );
  for (const value of cards) {
    const card = verifyCard(value, registry);
    if (card.kind === 'VERIFIED') return card;
  }
  throw new Error('CARD_INVALID');
}
export async function resolvePair(payer: string, payee: string) {
  const block = await client.getBlockNumber({ cacheTime: 0 });
  return Promise.all([resolveRecipient(payee, block), resolveRecipient(payer, block)] as const);
}
