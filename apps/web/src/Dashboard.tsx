import { redactNativeText, accountSecrets } from '@quaestor/chain/browser';
import { useState } from 'react';
import { Wallet } from './screens/Wallet.js';
import { Pay } from './screens/Pay.js';
import { Receive } from './screens/Receive.js';
import { Books } from './screens/Books.js';
import { Grants } from './screens/Grants.js';
import type { BusinessRuntime } from './business/runtime.js';
import { errorMessage } from './messages.js';
export type BusinessView = 'wallet' | 'pay' | 'receive' | 'books' | 'grants';
export function Dashboard({ runtime, view }: { runtime: BusinessRuntime; view: BusinessView }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [, setRevision] = useState(0);
  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    void work()
      .catch((value: unknown) => {
        const diagnostic =
          value instanceof Error
            ? redactNativeText(`${value.name}: ${value.message}`, accountSecrets(runtime.account))
            : 'REQUEST_FAILED';
        Object.assign(window, { quaestorLastError: diagnostic });
        setError(errorMessage(value));
      })
      .finally(() => {
        setBusy(false);
        setRevision((value) => value + 1);
      });
  };
  const props = { runtime, run, busy };
  const held = runtime.journal
    .read()
    .operations.filter((operation) => operation.stage === 'BROADCAST' || operation.stage === 'OUTCOME_UNKNOWN');
  return (
    <>
      <div className="workflow" aria-busy={busy}>
        {view === 'wallet' ? (
          <Wallet {...props} />
        ) : view === 'pay' ? (
          <Pay {...props} />
        ) : view === 'receive' ? (
          <Receive {...props} />
        ) : view === 'books' ? (
          <Books {...props} />
        ) : (
          <Grants {...props} />
        )}
      </div>
      {busy && (
        <p role="status" className="notice">
          Working locally or waiting for the chain. Please keep this tab open.
        </p>
      )}
      {error && (
        <p role="alert" className="error" data-testid="workflow-error">
          {error}
        </p>
      )}
      {held.length > 0 && (
        <aside className="panel">
          <h2>OUTCOME_UNKNOWN — held</h2>
          <p>These operations will not be rebuilt or broadcast again. Resolve their original hashes.</p>
          {held.map((operation) => (
            <p className="hash" key={operation.id}>
              {operation.hash}
            </p>
          ))}
          <button
            disabled={busy}
            onClick={() => {
              run(() => runtime.resolve());
            }}
          >
            Resolve held transactions by hash
          </button>
        </aside>
      )}
    </>
  );
}
