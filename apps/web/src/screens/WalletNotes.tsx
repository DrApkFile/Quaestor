import { formatUnits, zeroAddress } from 'viem';
import { Status } from '../Status.js';
import { Hash } from '../Hash.js';
import { cashOut } from '../business/wallet.js';
import type { ScreenProps } from './types.js';
export function WalletNotes({ runtime, run, busy, refresh }: ScreenProps & { refresh: () => Promise<void> }) {
  const journal = runtime.journal.read();
  const spendable = journal.notes.filter((note) => note.state === 'OWNED' && BigInt(note.amountWei) > 0n);
  const history = journal.notes.filter((note) => !spendable.some((owned) => owned.commitment === note.commitment));
  const table = (notes: typeof journal.notes, active: boolean) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Note</th>
            <th>Amount</th>
            <th>State</th>
            <th>{active ? 'Own-address cash-out' : 'Receipts'}</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <tr key={note.commitment}>
              <td data-label="Note">{note.commitment.slice(0, 14)}…</td>
              <td data-label="Amount">
                {formatUnits(BigInt(note.amountWei), note.asset === zeroAddress ? 18 : 6)}{' '}
                {note.asset === zeroAddress ? 'QOR' : 'fUSD'}
                {BigInt(note.amountWei) === 0n && ' · zero-value change'}
              </td>
              <td data-label="State">
                <Status code={note.state} />
              </td>
              <td data-label={active ? 'Own-address cash-out' : 'Receipts'}>
                {active ? (
                  <button
                    disabled={busy}
                    onClick={() => {
                      run(async () => {
                        await cashOut(runtime, note.commitment, `cashout-${crypto.randomUUID()}`);
                        await refresh();
                      });
                    }}
                  >
                    Cash out
                  </button>
                ) : (
                  journal.operations
                    .filter(
                      (operation) =>
                        operation.receipt &&
                        (operation.input === note.commitment ||
                          operation.prepared?.outputs.some((output) => output.commitment === note.commitment)),
                    )
                    .map((operation) => (
                      <p key={operation.id}>
                        <Hash value={operation.receipt?.hash ?? ''} />
                      </p>
                    ))
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="panel">
      <h2>Spendable private notes</h2>
      <p>
        {spendable.length} spendable notes. Totals:{' '}
        {[zeroAddress, ...new Set(spendable.map((note) => note.asset).filter((asset) => asset !== zeroAddress))]
          .map(
            (asset) =>
              `${formatUnits(
                spendable
                  .filter((note) => note.asset === asset)
                  .reduce((sum, note) => sum + BigInt(note.amountWei), 0n),
                asset === zeroAddress ? 18 : 6,
              )} ${asset === zeroAddress ? 'QOR' : 'fUSD'}`,
          )
          .join(' · ')}
      </p>
      {spendable.length ? (
        table(spendable, true)
      ) : (
        <p>Deposit or receive an anonymous ticket to own a spendable private note.</p>
      )}
      <details>
        <summary>History ({history.length})</summary>
        <p>
          Spent notes, zero-value change and notes awaiting confirmation. Held notes remain unavailable until their
          outcome is resolved.
        </p>
        {history.length ? table(history, false) : <p>No note history yet.</p>}
      </details>
      <p className="muted">
        Cash-out destination: your own EVM address {runtime.account.evm}. Deposits and cash-outs are public.
      </p>
    </div>
  );
}
