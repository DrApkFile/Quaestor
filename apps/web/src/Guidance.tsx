import { useState } from 'react';
export function Guidance() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('quaestor:guidance') !== 'dismissed';
    } catch {
      return true;
    }
  });
  if (!visible) return null;
  return (
    <aside className="panel guidance">
      <h2>How Quaestor works</h2>
      <ol>
        <li>Back up your account, fund it with test QOR, then activate it.</li>
        <li>Deposit into the pool. Pay privately and save sealed book entries.</li>
        <li>Share one quarter with your auditor. Every other quarter stays sealed.</li>
      </ol>
      <button
        className="secondary"
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem('quaestor:guidance', 'dismissed');
          } catch {
            return;
          }
        }}
      >
        Got it
      </button>
    </aside>
  );
}
