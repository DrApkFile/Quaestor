export const errorMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : 'REQUEST_FAILED';
  const messages: Record<string, string> = {
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
