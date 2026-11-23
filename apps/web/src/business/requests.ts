import type { JournalData } from '@quaestor/chain/journal';
type Request = Pick<JournalData['operations'][number], 'id' | 'stage'>;
export function depositRequestId(operations: readonly Request[], proposed: string) {
  const pending = operations.find(
    (operation) =>
      operation.id.startsWith('deposit-') &&
      ['PLANNED', 'PROVED', 'BROADCAST', 'OUTCOME_UNKNOWN'].includes(operation.stage),
  );
  return pending?.id.replace(/-approve$/, '') ?? proposed;
}
