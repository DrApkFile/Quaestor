import { useState, useEffect } from 'react';
import { parseEther, formatUnits } from 'viem';
import { checkWindow } from '@quaestor/chain/browser';
import { browserChain } from '../business/runtime.js';
import { prepareWindow } from '../business/windows.js';
import type { ScreenProps } from './types.js';
export function Prepare({ runtime, run, busy }: ScreenProps) {
  const [operations, setOperations] = useState('32'),
    [value, setValue] = useState('5');
  const [window, setWindow] = useState<Awaited<ReturnType<typeof checkWindow>> | null>(null);
  useEffect(() => {
    void checkWindow(browserChain, runtime.account.cosmos)
      .then(setWindow)
      .catch(() => {
        setWindow(null);
      });
  }, [runtime, busy]);
  return (
    <details className="panel">
      <summary>Details</summary>
      <details>
        <summary>Advanced: transaction window</summary>
        <div className="row-title">
          <h2>Transaction window</h2>
          <span className="badge">EVM window</span>
        </div>
        <p>
          Plan the transaction count and native value. The maximum allowance uses the 3,000,000 gas cap; each signed
          transaction uses its own estimate × 1.25.
        </p>
        <div className="grid">
          <label>
            Planned operations
            <input
              value={operations}
              type="number"
              min="1"
              max="100"
              onChange={(event) => {
                setOperations(event.target.value);
              }}
            />
          </label>
          <label>
            Planned native QOR value
            <input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
            />
          </label>
        </div>
        <div className="actions">
          <button
            disabled={busy}
            onClick={() => {
              run(async () => {
                setWindow(await prepareWindow(runtime, Number(operations), parseEther(value)));
              });
            }}
          >
            Open transaction window
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              run(async () => {
                setWindow(await checkWindow(browserChain, runtime.account.cosmos));
              });
            }}
          >
            Check window
          </button>
        </div>
        {window && (
          <p role="status">
            {window.kind === 'OPEN'
              ? `${String(window.window.remainingTxs)} transactions · ${formatUnits(window.window.remainingValue, 6)} QOR allowance · ${String(window.window.remainingBlocks)} blocks left`
              : 'Your transaction window is closed. Choose Open transaction window before continuing.'}
          </p>
        )}
      </details>
    </details>
  );
}
