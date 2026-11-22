import { useState } from 'react';
import { formatUnits, zeroAddress } from 'viem';
import { bookPayment } from '../business/entries.js';
import type { Book, Payment } from '../business/schema.js';
import type { ScreenProps } from './types.js';
export function EntryForm({ runtime, run, busy, book, payment }: ScreenProps & { book: Book; payment: Payment }) {
  const [name, setName] = useState(''),
    [purpose, setPurpose] = useState(''),
    [category, setCategory] = useState('operations'),
    [notes, setNotes] = useState(''),
    [invoice, setInvoice] = useState<File | undefined>();
  return (
    <form
      className="panel tone-sage"
      onSubmit={(event) => {
        event.preventDefault();
        run(async () => {
          await bookPayment(runtime, book, payment, {
            name,
            purpose,
            category,
            notes,
            ...(invoice ? { invoice } : {}),
          });
          setName('');
          setPurpose('');
          setNotes('');
          setInvoice(undefined);
        });
      }}
    >
      <h2>
        {payment.stage === 'BOOKED' ? 'Resume anchoring' : 'Not booked'} · {payment.direction}{' '}
        {formatUnits(BigInt(payment.note.amountWei), payment.note.asset === zeroAddress ? 18 : 6)}{' '}
        {payment.note.asset === zeroAddress ? 'QOR' : 'fUSD'}
      </h2>
      <p className="hash">{payment.counterparty}</p>
      <p>
        Period {book.active} · {book.mode}
      </p>
      <div className="grid">
        <label>
          Counterparty name
          <input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <label>
          Purpose
          <input
            required
            value={purpose}
            onChange={(event) => {
              setPurpose(event.target.value);
            }}
          />
        </label>
        <label>
          Category
          <input
            required
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          />
        </label>
        <label>
          Notes
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
          />
        </label>
      </div>
      <label>
        Invoice attachment (optional, max 20 KB)
        <input
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && file.size > 20480) {
              event.target.value = '';
              return;
            }
            setInvoice(file);
          }}
        />
      </label>
      <p className="muted">
        The amount, asset, direction and payment commitment are bound to the real payment. Invoice bytes and entry
        fields are sealed locally before publication.
      </p>
      <button disabled={busy || !book.registered}>Prove receipt and save entry</button>
    </form>
  );
}
