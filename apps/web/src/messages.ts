export const errorMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : 'REQUEST_FAILED';
  const messages: Record<string, string> = {
    WINDOW_CLOSED: 'WINDOW_CLOSED — use Prepare to transact in Wallet before starting this operation.',
    NO_KEM_KEY: 'NO_KEM_KEY — this address has no registered encryption key.',
    CARD_INVALID: 'CARD_INVALID — no valid registry-bound recipient card was found.',
    CONSOLIDATION_UNSUPPORTED:
      "This period's balance is spread across more than four private notes, and the pool can't merge notes, so it can't be proven in one step yet.",
    INVALID_PASSPHRASE_OR_BACKUP: 'Incorrect passphrase or damaged backup.',
    PASSPHRASE_TOO_SHORT: 'Use a passphrase of at least 12 characters.',
    BACKUP_REQUIRED: 'Download your encrypted backup before sending a transaction.',
    BOOK_UNAVAILABLE: 'This book is not registered on Diana.',
    BLOB_UNAVAILABLE: 'A required blob is not available on chain.',
    TAMPERED: 'The data failed its integrity check.',
    OUTCOME_UNKNOWN: 'Transaction outcome unknown. It is held and will not be sent again.',
    NETWORK_UNAVAILABLE: 'The chain could not be reached. Try refreshing.',
    VAULT_STORAGE_FAILED: 'Encrypted storage is unavailable in this browser.',
  };
  return (
    messages[code] ??
    (/^[A-Z_]+$/.test(code) ? code.replaceAll('_', ' ').toLowerCase() : 'The request could not be completed.')
  );
};
