import { statuses, reasons, type StatusCode } from './presentation.js';
export function Status({ code, reason, testId }: { code: string; reason?: string | undefined; testId?: string }) {
  const [label, colour, explanation] = Object.hasOwn(statuses, code) ? statuses[code as StatusCode] : statuses.UNKNOWN;
  return (
    <div className="status-description">
      <span
        className={`badge ${colour}`}
        title={`${code}${reason ? `: ${reason}` : ''}`}
        data-code={code}
        data-testid={testId}
      >
        {label}
      </span>
      <p>{reason && reasons[reason] ? reasons[reason] : explanation}</p>
    </div>
  );
}
