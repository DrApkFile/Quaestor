import { BookError, canonical } from './codec.js';
import type { Balances, HoldingsClose } from './holdings.js';
export function declaredOpening(close: HoldingsClose, registration: Balances | null, expectedPrior: string): Balances {
  const balance = close.openingBalance ?? registration;
  if (!balance || close.priorSha3 !== expectedPrior || (registration && canonical(balance) !== canonical(registration)))
    throw new BookError('TAMPERED');
  return balance;
}
