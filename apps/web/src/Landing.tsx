import './landing.css';
const evidence = 'https://github.com/DrApkFile/Quaestor/blob/master/evidence/';
const steps: readonly (readonly [string, string, string, string])[] = [
  [
    'Private payments',
    'Shield, send and receive through our deployment of Gloam’s open-source pool.',
    'Wallet',
    'sage',
  ],
  ['Sealed books', 'Period-key encryption and the business’s ML-DSA-87 signatures.', 'BookOpen', 'lemon'],
  [
    'One quarter for your auditor',
    'Grant a single period. The populated next demo period stays closed to the auditor.',
    'KeyRound',
    'peach',
  ],
  [
    'Checked against the chain',
    'Receipt verdicts and a holdings lower bound at the period’s close block.',
    'ShieldCheck',
    'rose',
  ],
];
const requirements: readonly (readonly [string, string, string])[] = [
  ['ML-KEM-1024 encryption', 'Anonymous hybrid tickets opened by the intended recipient.', 'm2b-ticket-anonymous.json'],
  ['Registered recipient keys', 'Recipient cards checked against the QoreChain registries.', 'm2-ticket.json'],
  ['ML-DSA key binding', 'Signatures and possession-proven on-chain signing keys.', 'm3-precompiles.json'],
  ['Client-side encryption & decryption', 'The M5 browser auditor opens on-chain ciphertexts locally.', 'm5-web.json'],
];
export function Landing() {
  return (
    <div className="landing">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-icon">Q</span>Quaestor
        </a>
        <span className="testnet">testnet only</span>
        <a className="button outline" href="/app">
          Open app ↗
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Private to the world. Open to your auditor.</p>
            <h1>
              Quaestor<span className="hero-dot">.</span>
            </h1>
            <p className="tagline">
              Keep your books private for decades, and open them to your auditor one quarter at a time.
            </p>
            <div className="actions">
              <a className="button" href="/app">
                Open app ↗
              </a>
              <a className="button outline" href="/app?view=public">
                Public check
              </a>
              <a className="button outline" href="/app?view=auditor">
                Auditor
              </a>
            </div>
            <p className="muted">QoreChain Diana · Private payments, sealed books, scoped access.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit">
              <img src="/icons/LockKeyhole.svg" alt="" />
              <span>SEALED</span>
            </div>
            <div className="art-card tone-sage">
              <img src="/icons/Wallet.svg" alt="" />
              Private payments
            </div>
            <div className="art-card tone-rose">
              <img src="/icons/KeyRound.svg" alt="" />
              One period. One key.
            </div>
          </div>
        </section>
        <section className="landing-section" id="how">
          <p className="eyebrow">How it works</p>
          <h2>
            A clear record.
            <br />A private business.
          </h2>
          <div className="how-grid">
            {steps.map(([title, body, icon, tone], index) => (
              <article className={`panel tone-${tone}`} key={title}>
                <div className="row-title">
                  <span className="eyebrow">0{index + 1}</span>
                  <img className="icon" src={`/icons/${icon}.svg`} alt="" />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <p className="muted">
            The proven testnet books use daily, demo-scale periods. Quarterly is the app’s default period length.
          </p>
        </section>
        <section className="landing-section" id="evidence">
          <p className="eyebrow">Encrypted Apps · evidence, not promises</p>
          <h2>
            Four requirements.
            <br />
            An open record.
          </h2>
          <div className="grid">
            {requirements.map(([title, body, file]) => (
              <a
                className="panel evidence-card"
                href={`${evidence}${file}`}
                key={title}
                target="_blank"
                rel="noreferrer"
              >
                <h3>{title} ↗</h3>
                <p>{body}</p>
                <span className="eyebrow">View testnet evidence</span>
              </a>
            ))}
          </div>
          <aside className="notice">
            Testnet only. Not affiliated with Gloam. The pool’s Groth16/BN254 proofs are not post-quantum. Holdings
            checks do not detect hidden income or payments from unbooked funds.
          </aside>
        </section>
      </main>
      <footer>
        <span>Quaestor · QoreChain Diana</span>
        <a href="https://github.com/DrApkFile/Quaestor/blob/master/THREAT_MODEL.md">Threat model ↗</a>
      </footer>
    </div>
  );
}
