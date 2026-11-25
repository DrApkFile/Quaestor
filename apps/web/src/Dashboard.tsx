import { redactNativeText, accountSecrets } from '@quaestor/chain/browser';
import { useRef, useState } from 'react';
import { Wallet } from './screens/Wallet.js';
import { Pay } from './screens/Pay.js';
import { Receive } from './screens/Receive.js';
import { Books } from './screens/Books.js';
import { Grants } from './screens/Grants.js';
import type { BusinessRuntime } from './business/runtime.js';
import { Hash } from './Hash.js';
import { errorMessage } from './messages.js';
export type BusinessView = 'wallet' | 'pay' | 'receive' | 'books' | 'grants';
export function Dashboard({ runtime, view }: { runtime: BusinessRuntime; view: BusinessView }) {
  const [busy, setBusy] = useState(false),
    [cancelled, setCancelled] = useState(false),
    [error, setError] = useState(''),
    [, setRevision] = useState(0);
  const retry = useRef<(() => Promise<unknown>) | null>(null);
  const run = (work: () => Promise<unknown>) => {
    retry.current = work;
    setBusy(true);
    setError('');
    setCancelled(false);
    void work()
      .catch((value: unknown) => {
        const diagnostic =
          value instanceof Error
            ? redactNativeText(`${value.name}: ${value.message}`, accountSecrets(runtime.account))
            : 'REQUEST_FAILED';
        Object.assign(window, { quaestorLastError: diagnostic });
        setError(errorMessage(value));
        setCancelled(value instanceof Error && value.message === 'WINDOW_DECLINED');
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
          <progress aria-label="Payment progress" />
          Building proofs or waiting for chain confirmation… proofs usually take 5–15 s; confirmation can take 10–60 s.
          Please keep this tab open.
        </p>
      )}
      {error && (
        <p
          role={cancelled ? 'status' : 'alert'}
          className={cancelled ? 'notice' : 'error'}
          data-testid="workflow-error"
        >
          {error}
          {!cancelled && (
            <button
              disabled={busy}
              onClick={() => {
                run(held.length ? () => runtime.resolve() : (retry.current ?? (() => runtime.resolve())));
              }}
            >
              Retry
            </button>
          )}
        </p>
      )}
      {held.length > 0 && (
        <aside className="panel">
          <h2>Waiting for confirmation</h2>
          <p>These operations will not be rebuilt or broadcast again. Resolve their original hashes.</p>
          {held.map((operation) => (
            <div key={operation.id}>{operation.hash && <Hash value={operation.hash} transaction />}</div>
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
