import { useEffect, useState } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits, zeroAddress, type Hex } from 'viem';
import { balances, deposit, convert, fusdDenom } from '../business/wallet.js';
import { fusd } from '../business/schema.js';
import { errorMessage } from '../messages.js';
import { WalletNotes } from './WalletNotes.js';
import { Hash } from '../Hash.js';
import { depositRequestId } from '../business/requests.js';
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
        <p className="eyebrow">Wallet</p>
        <h1>
          Your private balance.
          <br />
          Your keys.
        </h1>
        <Hash value={runtime.account.cosmos} />
      </div>
      <div className="stats">
        <article className="panel tone-sage">
          <span>Private balance (in the pool)</span>
          <strong>
            {formatUnits(privateBalance, asset === zeroAddress ? 18 : 6)} {asset === zeroAddress ? 'QOR' : 'fUSD'}
          </strong>
          <p>Only your keys reveal these notes. Use them to pay privately.</p>
        </article>
        <article className="panel">
          <span>Public balance</span>
          <strong>{publicBalances ? formatEther(BigInt(publicBalances.native)) : '…'} QOR</strong>
          <p>Visible on chain. Pays gas and funds deposits into the pool.</p>
        </article>
        <article className="panel">
          <span>Public EVM fUSD</span>
          <strong>{publicBalances ? formatUnits(BigInt(publicBalances.token), 6) : '…'} fUSD</strong>
        </article>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
          <button
            onClick={() => {
              setError('');
              void refresh().catch((value: unknown) => {
                setError(errorMessage(value));
              });
            }}
          >
            Retry
          </button>
        </p>
      )}
      <Prepare {...props}>
        <p className="muted">
          Pinned balance block: {publicBalances?.block ?? '…'}. Bank fUSD: {formatUnits(BigInt(bankFusd), 6)} · bank
          QOR: {formatUnits(BigInt(publicBalances?.bank.find((coin) => coin.denom === 'uqor')?.amount ?? '0'), 6)}.
        </p>
      </Prepare>
      <div className="panel">
        <h2>Deposit into the private pool</h2>
        <label>
          Asset
          <select
            aria-label="Asset"
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
              const id = depositRequestId(runtime.journal.read().operations, `deposit-${crypto.randomUUID()}`);
              run(async () => {
                await deposit(runtime, asset, asset === zeroAddress ? parseEther(amount) : parseUnits(amount, 6), id);
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
      <WalletNotes {...props} refresh={refresh} />
    </section>
  );
}
