import { lazy, Suspense } from 'react';
import { Guidance } from './Guidance.js';
import { useEffect, useRef, useState } from 'react';
import type { UnifiedAccount } from '@qorechain/sdk';
const AccountView = lazy(() => import('./AccountView.js').then((module) => ({ default: module.AccountView })));
const PublicView = lazy(() => import('./PublicView.js').then((module) => ({ default: module.PublicView })));
const AuditorView = lazy(() => import('./AuditorView.js').then((module) => ({ default: module.AuditorView })));
const Landing = lazy(() => import('./Landing.js').then((module) => ({ default: module.Landing })));
import type { BusinessView } from './Dashboard.js';
const Dashboard = lazy(() => import('./Dashboard.js').then((module) => ({ default: module.Dashboard })));
const AttackLab = lazy(() => import('./AttackLab.js').then((module) => ({ default: module.AttackLab })));
export function App() {
  return (
    <Suspense
      fallback={
        <main className="shell" role="status">
          <progress aria-label="Loading page" />
          Opening Quaestor…
        </main>
      }
    >
      <AppContent />
    </Suspense>
  );
}
import type { BusinessRuntime } from './business/runtime.js';
import './style.css';
type View = BusinessView | 'account' | 'public' | 'auditor';
const icons = ['Wallet', 'Send', 'Download', 'BookOpen', 'KeyRound', 'ShieldCheck', 'Search'];
const views = ['wallet', 'pay', 'receive', 'books', 'grants', 'auditor', 'public'] as const;
function AppContent() {
  const navigation = useRef<HTMLElement>(null);
  const query = new URLSearchParams(location.search).get('view');
  const [view, setView] = useState<View>(query && [...views, 'account'].includes(query) ? (query as View) : 'account');
  const [runtime, setRuntime] = useState<BusinessRuntime | null>(null),
    [progress, setProgress] = useState('');
  useEffect(() => {
    const active = navigation.current?.querySelector<HTMLElement>('[aria-current=page]');
    if (active && navigation.current)
      navigation.current.scrollLeft =
        active.offsetLeft - navigation.current.offsetLeft - navigation.current.clientWidth / 2 + active.clientWidth / 2;
  }, [view]);
  const select = (item: View) => {
    setView(item);
    const url = new URL(location.href);
    url.pathname = '/app';
    url.searchParams.set('view', item);
    history.replaceState(null, '', url);
  };
  const ready = async (account: UnifiedAccount) => {
    if (runtime?.account.cosmos === account.cosmos) return;
    const { BusinessRuntime } = await import('./business/runtime.js');
    const opened = await BusinessRuntime.open(account, (value) => {
      setProgress(
        typeof value === 'string'
          ? value
          : `${value.file}: ${value.cached ? 'cached' : `${(value.loaded / 1048576).toFixed(1)} MB${value.total ? ` of ${(value.total / 1048576).toFixed(1)} MB` : ''} downloaded`}`,
      );
    });
    try {
      await opened.resolve();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message === 'OUTCOME_UNKNOWN')) throw error;
    }
    setRuntime(opened);
    const { installPrivacyMonitor } = await import('./privacy.js');
    installPrivacyMonitor(opened);
  };
  if (location.pathname === '/attack-lab') return <AttackLab />;
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
          className={view === 'account' ? 'nav-active' : 'secondary'}
          aria-current={view === 'account' ? 'page' : undefined}
          onClick={() => {
            select('account');
          }}
        >
          Account
        </button>
      </header>
      <div className="shell">
        <nav ref={navigation} aria-label="Main navigation">
          <span className="nav-group">Business</span>
          {views.map((item, index) => (
            <span className="nav-entry" key={item}>
              {item === 'auditor' && <span className="nav-group">Auditor</span>}
              {item === 'public' && <span className="nav-group">Verify</span>}
              <button
                className={item === view ? 'nav-active' : 'nav-item'}
                aria-current={item === view ? 'page' : undefined}
                key={item}
                onClick={() => {
                  select(!runtime && !['public', 'auditor'].includes(item) ? 'account' : item);
                }}
              >
                <img className="icon" src={`/icons/${icons[index] ?? 'Wallet'}.svg`} alt="" />
                {item === 'public' ? 'Public check' : item.slice(0, 1).toUpperCase() + item.slice(1)}
              </button>
            </span>
          ))}
          <a className="nav-item" href="/attack-lab">
            Attack lab
          </a>
        </nav>
        <p className="nav-hint">Swipe navigation to see all areas →</p>
        <main>
          <aside className="notice demo-banner">
            Testnet (demo) · Faucet tokens have no real value. Demo books use daily periods.
          </aside>
          {view === 'account' && <Guidance />}
          {(view === 'account' || runtime) && (
            <div hidden={view !== 'account'}>
              <AccountView
                onReady={ready}
                onLock={() => {
                  setRuntime(null);
                  void import('./privacy.js').then(({ installPrivacyMonitor }) => {
                    installPrivacyMonitor(null);
                  });
                }}
              />
            </div>
          )}
          {view === 'public' && <PublicView />}
          {view === 'auditor' && <AuditorView />}
          {business && runtime && <Dashboard runtime={runtime} view={view as BusinessView} />}
          <p className="status-log" role="status" data-testid="proof-progress">
            {progress}
          </p>
        </main>
        <footer>
          <p>QoreChain Diana · Chain 9800 · Test tokens only.</p>
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
