import { installPrivacyMonitor } from './privacy.js';
import { useState } from 'react';
import type { UnifiedAccount } from '@qorechain/sdk';
import { AccountView } from './AccountView.js';
import { PublicView } from './PublicView.js';
import { AuditorView } from './AuditorView.js';
import { Landing } from './Landing.js';
import { Dashboard, type BusinessView } from './Dashboard.js';
import { BusinessRuntime } from './business/runtime.js';
import './style.css';
type View = BusinessView | 'account' | 'public' | 'auditor';
const icons = ['Wallet', 'Send', 'Download', 'BookOpen', 'KeyRound', 'ShieldCheck', 'Search'];
const views = ['wallet', 'pay', 'receive', 'books', 'grants', 'auditor', 'public'] as const;
export function App() {
  const query = new URLSearchParams(location.search).get('view');
  const [view, setView] = useState<View>(query && [...views, 'account'].includes(query) ? (query as View) : 'account');
  const [runtime, setRuntime] = useState<BusinessRuntime | null>(null),
    [progress, setProgress] = useState('');
  const select = (item: View) => {
    setView(item);
    const url = new URL(location.href);
    url.pathname = '/app';
    url.searchParams.set('view', item);
    history.replaceState(null, '', url);
  };
  const ready = async (account: UnifiedAccount) => {
    if (runtime?.account.cosmos === account.cosmos) return;
    const opened = await BusinessRuntime.open(account, (value) => {
      setProgress(
        typeof value === 'string'
          ? value
          : `${value.file}: ${value.cached ? 'cached' : `${String(Math.ceil(value.loaded / 1024))} KB downloaded`}`,
      );
    });
    try {
      await opened.resolve();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message === 'OUTCOME_UNKNOWN')) throw error;
    }
    setRuntime(opened);
    installPrivacyMonitor(opened);
  };
  if (location.pathname === '/' && !query) return <Landing />;
  const business = views.slice(0, 5).includes(view as BusinessView);
  return (
    <div className="dashboard">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-icon">Q</span>Quaestor
        </a>
        <span className="testnet">testnet only</span>
        <button
          className="secondary"
          onClick={() => {
            select('account');
          }}
        >
          Account
        </button>
      </header>
      <div className="shell">
        <nav aria-label="Main navigation">
          {views.map((item, index) => (
            <button
              className={item === view ? 'nav-active' : 'nav-item'}
              aria-current={item === view ? 'page' : undefined}
              key={item}
              disabled={!runtime && !['public', 'auditor'].includes(item)}
              onClick={() => {
                select(item);
              }}
            >
              <img className="icon" src={`/icons/${icons[index] ?? 'Wallet'}.svg`} alt="" />
              {item === 'public' ? 'Public check' : item.slice(0, 1).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <main>
          <div hidden={view !== 'account'}>
            <AccountView
              onReady={ready}
              onLock={() => {
                setRuntime(null);
                installPrivacyMonitor(null);
              }}
            />
          </div>
          {view === 'public' && <PublicView />}
          {view === 'auditor' && <AuditorView />}
          {business && runtime && <Dashboard runtime={runtime} view={view as BusinessView} />}
          <p className="status-log" role="status" data-testid="proof-progress">
            {progress}
          </p>
        </main>
        <footer>
          <p>QoreChain Diana · Chain 9800 · Demo accounts and books are labelled (demo).</p>
          <p>
            Not affiliated with Gloam. Our deployment of Gloam’s open-source pool. Groth16/BN254 proofs are not
            post-quantum.
          </p>
          <a href="https://github.com/DrApkFile/Quaestor/blob/master/THREAT_MODEL.md" target="_blank" rel="noreferrer">
            Threat model ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
