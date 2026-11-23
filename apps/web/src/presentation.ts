export const statuses = {
  MATCHED: ['Matches a real payment', 'good', 'The receipt matches this entry and a payment in the pool.'],
  UNBACKED: ['No real payment behind this entry', 'bad', 'The receipt cannot back this entry.'],
  TAMPERED: ['Changed after it was recorded', 'bad', 'The data no longer matches its on-chain fingerprint.'],
  UNKNOWN: ["Couldn't check right now", 'unknown', 'The check is incomplete. Retry when the chain is available.'],
  HOLDINGS_COVER_BOOKS: [
    'Holdings cover the books',
    'good',
    'Proven holdings cover the declared closing balance; hidden income is not detected.',
  ],
  HOLDINGS_SHORT: ['Books claim more than is held', 'bad', 'The declared closing balance exceeds the proven holdings.'],
  NOT_GRANTED: ['Not shared with you', 'neutral', 'Only the business can share this period with your auditor account.'],
  OPEN: ['Period still open', 'neutral', 'The business has not closed this period yet.'],
  VERIFIED: [
    'Fingerprint verified',
    'good',
    'The ciphertext matches its on-chain fingerprint. No plaintext was opened.',
  ],
  BLOB_UNAVAILABLE: ['Record unavailable', 'unknown', 'The encrypted record could not be read. Retry the check.'],
  NOT_FOUND: ['Record not found', 'unknown', 'The record could not be found at the checked block.'],
  OWNED: ['Ready to spend', 'good', 'This private note is available in your wallet.'],
  RESERVED: ['Held for a payment', 'unknown', 'This note is reserved until the original transaction is resolved.'],
  SPENDING: ['Held for a payment', 'unknown', 'This note stays held until the original transaction is resolved.'],
  INCOMING: ['Awaiting confirmation', 'unknown', 'This note is not available until its payment is confirmed.'],
  BOOKED: ['Entry sealed', 'neutral', 'The entry is sealed locally and still needs its chain anchor.'],
  SPENT: ['Payment confirmed', 'neutral', 'A chain receipt confirms this note was spent.'],
  SENT: ['Payment confirmed', 'good', 'The private payment landed; its ticket still needs posting.'],
  TICKET_POSTED: ['Ticket delivered', 'good', 'The encrypted ticket is on the memo board. Record its book entry next.'],
  RECEIVED: ['Ticket checked', 'good', 'Your ticket opened locally and its private note was checked against the pool.'],
  ANCHORED: ['Recorded in books', 'good', 'The sealed book entry has an on-chain anchor.'],
  OUTCOME_UNKNOWN: [
    'Waiting for confirmation',
    'unknown',
    'This transaction is held. Resolve its original hash before continuing.',
  ],
} as const;
export type StatusCode = keyof typeof statuses;
export const reasons: Record<string, string> = {
  MISMATCH: 'The payment details differ from this book entry.',
  WRONG_CONTEXT: 'This receipt was reused from a different book, period or entry.',
  DUPLICATE_PAYMENT: 'This payment was already used for another entry in the granted periods.',
  UNKNOWN_ROOT: 'This receipt names a root the pool never had.',
  ROOT_NOT_IN_HISTORY: 'This receipt names a root the pool never had.',
  AMOUNT_MISMATCH: 'The payment amount differs from the entry.',
  ASSET_MISMATCH: 'The payment asset differs from the entry.',
  BAD_PROOF: 'The payment proof did not verify.',
};
export function humanDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        date,
      );
}
export function demoLabel(value: string) {
  return value.replace(/\s*\(demo\)/g, '').replace('Daily (demo-scale)', 'Daily');
}
