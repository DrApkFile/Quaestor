import { useState } from 'react';
import { parseEther, formatUnits } from 'viem';
import { checkWindow } from '@quaestor/chain/browser';
import { browserChain } from '../business/runtime.js';
import { prepareWindow } from '../business/windows.js';
import type { ScreenProps } from './types.js';
export function Prepare({ runtime, run, busy }: ScreenProps) {
  const [operations, setOperations] = useState('32'),
    [value, setValue] = useState('5');
  const [window, setWindow] = useState<Awaited<ReturnType<typeof checkWindow>> | null>(null);
  return (
    <section className="panel tone-lemon">
      <div className="row-title">
        <h2>Prepare to transact</h2>
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
          Prepare to transact
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
            : 'WINDOW_CLOSED — prepare a new window before continuing.'}
        </p>
      )}
    </section>
  );
}
