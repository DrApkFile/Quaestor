import { useEffect, useState } from 'react';
import { activationReceipts, type ActivationReceipt } from './activationReceipts.js';
import { Hash } from './Hash.js';
export function ActivationDetails({ address, busy }: { address: string; busy: boolean }) {
  const [records, setRecords] = useState<ActivationReceipt[]>([]);
  useEffect(() => {
    void activationReceipts(address)
      .then(setRecords)
      .catch(() => {
        setRecords([]);
      });
  }, [address, busy]);
  return (
    <details className="panel">
      <summary>Transaction details</summary>
      {records.map((record) => (
        <article
          key={record.hash}
          data-testid="activation-receipt"
          data-hash={record.hash}
          data-block={record.block}
          data-step={record.id}
        >
          <p>
            {record.id.startsWith('pqc')
              ? 'Signature registration'
              : record.id.startsWith('kem')
                ? 'Encryption key registration'
                : record.id.startsWith('window') || record.id.startsWith('prepare')
                  ? 'EVM window'
                  : 'Payment card'}{' '}
            · Block {record.block}
          </p>
          <Hash value={record.hash} transaction />
        </article>
      ))}
      {!records.length && <p>Confirmed setup transactions appear here.</p>}
    </details>
  );
}
