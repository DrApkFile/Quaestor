import { Hash } from '../Hash.js';
import { Status } from '../Status.js';
import { useState } from 'react';
import { parseUnits, zeroAddress, type Hex } from 'viem';
import { pay } from '../business/payments.js';
import { resolveRecipient } from '../business/recipients.js';
import { client } from '../business/runtime.js';
import { fusd } from '../business/schema.js';
import type { ScreenProps } from './types.js';
export function Pay({ runtime, run, busy }: ScreenProps) {
  const [address, setAddress] = useState(''),
    [amount, setAmount] = useState('0.5'),
    [asset, setAsset] = useState<Hex>(zeroAddress),
    [verified, setVerified] = useState('');
  const [id, setId] = useState(`pay-${crypto.randomUUID()}`);
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Pay</p>
        <h1>
          A private payment.
          <br />
          For the right person.
        </h1>
        <p>
          Keys come from QoreChain’s registry and an owner-signed recipient card. Tickets are anonymous hybrid
          envelopes.
        </p>
      </div>
      <form
        className="panel narrow"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            await pay(runtime, address, asset, parseUnits(amount, asset === zeroAddress ? 18 : 6), id);
            setId(`pay-${crypto.randomUUID()}`);
          });
        }}
      >
        <label>
          Recipient qor1 address
          <input
            required
            value={address}
            onChange={(event) => {
              setAddress(event.target.value.trim());
              setVerified('');
            }}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            run(async () => {
              await resolveRecipient(address, await client.getBlockNumber({ cacheTime: 0 }));
              setVerified('Registered key and recipient card verified.');
            });
          }}
        >
          Verify recipient
        </button>
        {verified && <p className="badge good">{verified}</p>}
        <label>
          Payment asset
          <select
            aria-label="Payment asset"
            value={asset}
            onChange={(event) => {
              setAsset(event.target.value as Hex);
            }}
          >
            <option value={zeroAddress}>QOR</option>
            <option value={fusd}>fUSD</option>
          </select>
        </label>
        <label>
          Payment amount
          <input
            required
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
          />
        </label>
        <button disabled={busy}>Prove and pay</button>
        <p className="muted">
          A transaction window opens when needed. After posting the ticket, the payment stays Not booked until you save
          its book entry.
        </p>
      </form>
      <div className="panel">
        <h2>Payment stages</h2>
        {!runtime.state.payments.some((payment) => payment.direction === 'OUT') && (
          <p>No payments yet. Deposit in Wallet, prepare a window, then enter the recipient above.</p>
        )}
        {runtime.state.payments
          .filter((payment) => payment.direction === 'OUT')
          .map((payment) => (
            <article key={payment.id}>
              <Hash value={payment.note.commitment} /> · <Status code={payment.stage} />
            </article>
          ))}
        {runtime.state.plans
          .filter((plan) => !runtime.state.payments.some((payment) => payment.id === plan.id && payment.memo))
          .map((plan) => (
            <p key={plan.id}>
              Held payment {plan.id.slice(0, 16)}{' '}
              <button
                disabled={busy}
                onClick={() => {
                  run(() => pay(runtime, plan.payee, plan.asset, BigInt(plan.amount), plan.id));
                }}
              >
                Resume existing payment
              </button>
            </p>
          ))}
      </div>
    </section>
  );
}
