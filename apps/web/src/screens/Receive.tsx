import { formatUnits, zeroAddress } from 'viem';
import { client } from '../business/runtime.js';
import { receive } from '../business/payments.js';
import type { ScreenProps } from './types.js';
export function Receive({ runtime, run, busy }: ScreenProps) {
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Receive (demo)</p>
        <h1>Find your private tickets.</h1>
        <p>
          Only your keys can open tickets addressed to you. Inclusion and unspent status are checked at one pinned
          block.
        </p>
      </div>
      <div className="panel">
        <label>
          Your recipient address (demo)
          <input readOnly value={runtime.account.cosmos} />
        </label>
        <button
          disabled={busy}
          onClick={() => {
            run(() => receive(runtime));
          }}
        >
          Scan memo board
        </button>
        {runtime.state.scanBlock === '0' && runtime.state.payments.length === 0 && (
          <>
            <p className="muted">
              Starting a fresh demo? You may start at the current block. Earlier memos will not be imported; use the
              normal scan for historical recovery.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                run(async () => {
                  runtime.state.scanBlock = (await client.getBlockNumber({ cacheTime: 0 })).toString();
                  await runtime.save();
                });
              }}
            >
              Start at current block (fresh demo)
            </button>
          </>
        )}
        <p className="muted">
          Last completed scan: block {runtime.state.scanBlock}. Non-recipient decryption failures are skipped silently.
        </p>
      </div>
      <div className="panel">
        <h2>Received payments</h2>
        {runtime.state.payments
          .filter((payment) => payment.direction === 'IN')
          .map((payment) => (
            <article key={payment.id}>
              <h3>
                {formatUnits(BigInt(payment.note.amountWei), payment.note.asset === zeroAddress ? 18 : 6)}{' '}
                {payment.note.asset === zeroAddress ? 'QOR' : 'fUSD'}
              </h3>
              <p className="hash">{payment.note.commitment}</p>
              <span className="badge">{payment.stage === 'ANCHORED' ? 'ANCHORED' : 'Not booked'}</span>
            </article>
          ))}
        {runtime.state.errors.map((error, index) => (
          <p className="error" key={`${error.commitment}-${String(index)}`}>
            {error.code} · {error.commitment.slice(0, 18)}…
          </p>
        ))}
      </div>
    </section>
  );
}
