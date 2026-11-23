import { useState } from 'react';
export function Hash({ value, transaction = false }: { value: string; transaction?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="hash-tools">
      <span className="hash" title={value}>
        {value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value}
      </span>
      <button
        type="button"
        className="secondary"
        aria-label={`Copy ${value.startsWith('qor1') ? 'address' : 'hash'}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => {
              setCopied(true);
              setFailed(false);
            })
            .catch(() => {
              setFailed(true);
            });
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <a href="https://github.com/DrApkFile/Quaestor/tree/master/evidence" target="_blank" rel="noreferrer">
        {transaction ? 'Transaction evidence' : 'Evidence'}
      </a>
      {failed && <span role="status">Copy unavailable. Select the value in Details.</span>}
      <details>
        <summary>Details</summary>
        <span className="hash">{value}</span>
      </details>
    </div>
  );
}
