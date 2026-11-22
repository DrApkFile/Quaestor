import { useEffect, useState } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits, zeroAddress, type Hex } from 'viem';
import { balances, deposit, cashOut, convert, fusdDenom } from '../business/wallet.js';
import { fusd } from '../business/schema.js';
import { errorMessage } from '../messages.js';
import { Prepare } from './Prepare.js';
import type { ScreenProps } from './types.js';
export function Wallet(props: ScreenProps) {
  const { runtime, run, busy } = props;
  const [publicBalances, setBalances] = useState<Awaited<ReturnType<typeof balances>> | null>(null),
    [error, setError] = useState(''),
    [amount, setAmount] = useState('2'),
    [asset, setAsset] = useState<Hex>(zeroAddress);
  const refresh = async () => {
    setBalances(await balances(runtime));
  };
  useEffect(() => {
    void refresh().catch((value: unknown) => {
      setError(errorMessage(value));
    });
  }, [runtime]);
  const notes = runtime.journal.read().notes;
  const owned = notes.filter((note) => note.state === 'OWNED' && BigInt(note.amountWei) > 0n);
  const privateBalance = owned
    .filter((note) => note.asset.toLowerCase() === asset.toLowerCase())
    .reduce((sum, note) => sum + BigInt(note.amountWei), 0n);
  const bankFusd = publicBalances?.bank.find((coin) => coin.denom === fusdDenom)?.amount ?? '0';
  return (
    <section>
      <div className="intro">
        <p className="eyebrow">Wallet (demo)</p>
        <h1>
          Your private balance.
          <br />
          Your keys.
        </h1>
        <p className="hash">{runtime.account.cosmos}</p>
      </div>
      <div className="stats">
        <article className="panel tone-sage">
          <span>Private {asset === zeroAddress ? 'QOR' : 'fUSD'}</span>
          <strong>{formatUnits(privateBalance, asset === zeroAddress ? 18 : 6)}</strong>
        </article>
        <article className="panel">
          <span>Public EVM QOR</span>
          <strong>{publicBalances ? formatEther(BigInt(publicBalances.native)) : '…'}</strong>
        </article>
        <article className="panel">
          <span>Public EVM fUSD</span>
          <strong>{publicBalances ? formatUnits(BigInt(publicBalances.token), 6) : '…'}</strong>
        </article>
      </div>
      <p className="muted">
        Pinned balance block: {publicBalances?.block ?? '…'}. Bank fUSD: {formatUnits(BigInt(bankFusd), 6)} · bank QOR:{' '}
        {formatUnits(BigInt(publicBalances?.bank.find((coin) => coin.denom === 'uqor')?.amount ?? '0'), 6)}.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Prepare {...props} />
      <div className="panel">
        <h2>Deposit into the private pool</h2>
        <label>
          Asset
          <select
            value={asset}
            onChange={(event) => {
              setAsset(event.target.value as Hex);
            }}
          >
            <option value={zeroAddress}>Native QOR</option>
            <option value={fusd}>fUSD</option>
          </select>
        </label>
        <label>
          Deposit amount
          <input
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
          />
        </label>
        <div className="actions">
          <button
            disabled={busy}
            onClick={() => {
              run(async () => {
                await deposit(
                  runtime,
                  asset,
                  asset === zeroAddress ? parseEther(amount) : parseUnits(amount, 6),
                  runtime.journal
                    .read()
                    .operations.find(
                      (operation) =>
                        operation.id.startsWith('deposit-') && ['PLANNED', 'PROVED'].includes(operation.stage),
                    )?.id ?? `deposit-${crypto.randomUUID()}`,
                );
                await refresh();
              });
            }}
          >
            Deposit privately
          </button>
          {BigInt(bankFusd) > 0n && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                run(async () => {
                  await convert(runtime, BigInt(bankFusd));
                  await refresh();
                });
              }}
            >
              Convert bank fUSD to EVM
            </button>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              run(refresh);
            }}
          >
            Refresh balances
          </button>
        </div>
      </div>
      <div className="panel">
        <h2>Private notes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Note</th>
                <th>Amount</th>
                <th>State</th>
                <th>Own-address cash-out</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.commitment}>
                  <td>{note.commitment.slice(0, 14)}…</td>
                  <td>
                    {formatUnits(BigInt(note.amountWei), note.asset === zeroAddress ? 18 : 6)}{' '}
                    {note.asset === zeroAddress ? 'QOR' : 'fUSD'}
                  </td>
                  <td>{note.state}</td>
                  <td>
                    <button
                      disabled={busy || note.state !== 'OWNED' || BigInt(note.amountWei) === 0n}
                      onClick={() => {
                        run(async () => {
                          await cashOut(runtime, note.commitment, `cashout-${crypto.randomUUID()}`);
                          await refresh();
                        });
                      }}
                    >
                      Cash out
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!notes.length && <p>Deposit or receive an anonymous ticket to own a private note.</p>}
        <p className="muted">
          Cash-out destination: your own EVM address {runtime.account.evm}. Deposits and cash-outs are public.
        </p>
      </div>
    </section>
  );
}
