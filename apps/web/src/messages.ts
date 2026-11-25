export const errorMessages = {
  WINDOW_DECLINED: 'Cancelled. Nothing was sent.',
  WINDOW_CLOSED: 'Your transaction window has expired or lacks budget. Retry the action to open a new window.',
  NO_PQ_KEY: 'The signing key is not registered. Activate your account, then retry.',
  PQ_POSSESSION_NOT_PROVEN: 'The signing key has not proved ownership. Retry activation with the original backup.',
  NO_KEM_KEY: 'This address has no encryption key. Ask the recipient to activate their account, then retry.',
  CARD_INVALID:
    'The recipient’s payment card could not be verified. Check the address and ask them to activate, then retry.',
  NOT_GRANTED: 'This period has not been shared with you. Ask the business to grant your auditor address, then retry.',
  WRONG_CONTEXT: 'This receipt belongs to a different entry. Choose the original payment and retry.',
  NOTE_SPENT: 'This private note has already been spent. Refresh your wallet and choose an available note, then retry.',
  OUTCOME_UNKNOWN:
    'The chain has not confirmed this transaction yet. It stays held. Retry checks its original hash without sending it again.',
  NETWORK_UNAVAILABLE: 'The chain could not be reached. Check your connection and retry.',
  CONSOLIDATION_UNSUPPORTED:
    'This balance needs more than four private notes, and the pool cannot merge them. Choose a period whose balance fits four notes, then retry.',
  INVALID_PASSPHRASE_OR_BACKUP: 'The passphrase is incorrect or the backup is damaged. Check both and retry.',
  PASSPHRASE_TOO_SHORT: 'Use a passphrase of at least 12 characters, then retry.',
  BACKUP_REQUIRED: 'Download your encrypted backup before sending a transaction, then retry.',
  BOOK_UNAVAILABLE: 'This book is not registered on Diana. Check the book ID and retry.',
  BLOB_UNAVAILABLE: 'An encrypted record could not be read from the chain. Retry the check.',
  TAMPERED: 'The data failed its integrity check. Reload the original record and retry.',
  VAULT_STORAGE_FAILED: 'Encrypted browser storage is unavailable. Allow site storage, reopen your backup and retry.',
  REGISTRY_KEY_MISMATCH:
    'The registered keys differ from this backup. Restore the original backup and retry; keys will not be overwritten.',
  KEM_KEY_MISMATCH: 'The encryption key differs from this backup. Restore the original backup and retry.',
  REGISTRY_NOT_READY: 'Account setup is incomplete. Open Account and retry activation.',
  INSUFFICIENT_PRIVATE_BALANCE:
    'No single available private note covers this payment. Deposit enough QOR or choose a smaller amount, then retry.',
  INVALID_AMOUNT: 'Enter an amount greater than zero, then retry.',
  INVALID_PAYMENT: 'Enter a recipient other than yourself and an amount greater than zero, then retry.',
  REQUEST_CONFLICT: 'This payment was already planned with different details. Resume the original payment instead.',
  TICKET_INVALID:
    'This ticket could not be checked against the pool. Ask the sender to check their payment, then retry.',
} as const;
export const errorMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : 'REQUEST_FAILED';
  return (
    (Object.hasOwn(errorMessages, code) ? errorMessages[code as keyof typeof errorMessages] : undefined) ??
    'The request could not be completed. Check your connection and account state, then retry.'
  );
};
