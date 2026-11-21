import { useState } from 'react';
import { AccountView } from './AccountView.js';
import { PublicView } from './PublicView.js';
import { AuditorView } from './AuditorView.js';
import './style.css';
type View = 'account' | 'public' | 'auditor';
export function App() {
  const query = new URLSearchParams(location.search).get('view');
  const [view, setView] = useState<View>(query === 'account' || query === 'auditor' ? query : 'public');
  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-icon">Q</span>
          <span>Quaestor</span>
        </div>
        <span className="testnet">testnet only</span>
      </header>
      <div className="shell">
        <nav aria-label="Main navigation">
          {(['account', 'public', 'auditor'] as const).map((item) => (
            <button
              className={item === view ? 'nav-active' : 'nav-item'}
              aria-current={item === view ? 'page' : undefined}
              key={item}
              onClick={() => {
                setView(item);
                const url = new URL(location.href);
                url.searchParams.set('view', item);
                history.replaceState(null, '', url);
              }}
            >
              {item === 'public' ? 'Public check' : item === 'account' ? 'Account' : 'Auditor'}
            </button>
          ))}
        </nav>
        <main>{view === 'account' ? <AccountView /> : view === 'public' ? <PublicView /> : <AuditorView />}</main>
        <footer>
          <p>QoreChain Diana · Chain 9800 · All demo accounts and books are labelled (demo).</p>
          <p>Our deployment of Gloam’s open-source pool. Groth16/BN254 proofs are not post-quantum.</p>
          <a href="https://github.com/DrApkFile/Quaestor/blob/master/THREAT_MODEL.md" target="_blank" rel="noreferrer">
            Threat model ↗
          </a>
        </footer>
      </div>
    </>
  );
}
