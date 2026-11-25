import { Hash } from './Hash.js';
import { useState } from 'react';
import { z } from 'zod';
import { hex32 } from '@quaestor/core';
import { AttackCards } from './AttackCards.js';
import { deriveUnifiedAccount } from '@qorechain/sdk';
import { deriveSealKeys } from '@qorechain/qoreseal';
import { auditFromChain } from '@quaestor/chain/browser';
import { readerConfig, deployment } from './client.js';
import { decryptVault } from './vault.js';
import { demoAuditorBackup, demoAuditorPassphrase } from './demo.js';
import { installAuditPrivacy } from './privacy.js';
import { errorMessage } from './messages.js';
export function AttackLab() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof auditFromChain>> | null>(null);
  const [duplicate, setDuplicate] = useState<Awaited<ReturnType<typeof auditFromChain>> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(demoAuditorBackup);
      if (!response.ok) throw new Error('BACKUP_UNAVAILABLE');
      const payload = await decryptVault((await response.json()) as unknown, demoAuditorPassphrase);
      const account = await deriveUnifiedAccount(payload.mnemonic, 0);
      const keys = deriveSealKeys({ mnemonic: payload.mnemonic, index: 0 });
      installAuditPrivacy(account, keys);
      const metadataResponse = await fetch('/m7-demo.json');
      if (!metadataResponse.ok) throw new Error('DEMO_METADATA_UNAVAILABLE');
      const metadata = z
        .object({ honest: hex32, duplicate: hex32, label: z.literal('Northwind Studio (demo)') })
        .strict()
        .parse((await metadataResponse.json()) as unknown);
      const config = readerConfig(() => undefined),
        identity = { address: account.cosmos, keys };
      const original = await auditFromChain(config, deployment.demo.attack, identity);
      const anchoredDuplicate = await auditFromChain(config, metadata.duplicate, identity);
      setResult(original);
      setDuplicate(anchoredDuplicate);
    } catch (value: unknown) {
      setError(errorMessage(value));
    } finally {
      setBusy(false);
    }
  };
  const period = result?.periods.find((value) => value.kind === 'AUDITED');
  return (
    <div className="dashboard">
      <header className="site-header">
        <a className="brand" href="/">
          Quaestor
        </a>
        <span className="testnet">testnet only</span>
        <a href="/app?view=public">Public check</a>
      </header>
      <main className="shell">
        <div className="notice demo-banner">Testnet (demo) · Public fictional attack cases.</div>
        <p className="eyebrow">Attack lab</p>
        <h1>See what the checks catch.</h1>
        <p>
          Read-only checks of the M4 attack book and the M7 duplicate-payment demo book. The demo auditor account is
          intentionally public and holds no real value. No transactions are sent.
        </p>
        <Hash value={deployment.demo.attack} />
        <button disabled={busy} onClick={() => void run()}>
          {busy ? 'Reading and verifying…' : 'Read attack book from chain'}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
            <button disabled={busy} onClick={() => void run()}>
              Retry check
            </button>
          </p>
        )}
        {busy && (
          <div role="status">
            <progress aria-label="Checking attack cases" />
            <p>Reading attack records and verifying proofs… usually 1–5 minutes on testnet.</p>
          </div>
        )}
        {period && duplicate && <AttackCards original={period} duplicate={duplicate} />}
        {result && (
          <p className="muted">
            Pinned M4 read block {result.readBlock}; duplicate read block {duplicate?.readBlock}. Groth16/BN254 is not
            post-quantum. Not affiliated with Gloam.
          </p>
        )}
      </main>
    </div>
  );
}
