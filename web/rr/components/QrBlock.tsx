// QrBlock.tsx: QR code + visible label + equivalent text link for one configured destination. With no
// destination it shows a "pending" state, never a placeholder code. On phones the button comes first.
import type { Dict } from "../i18n";

export interface QrBlockProps {
  label: string;
  /** Real https destination from landing.config.json, or null while pending. */
  target: string | null;
  /** Generated QR image for that destination, or null. */
  qr: string | null;
  tr: Dict;
  eyebrow?: string;
  description?: string | null;
  className?: string;
}

export function QrBlock({ label, target, qr, tr, eyebrow, description, className }: QrBlockProps) {
  if (!target) {
    return (
      <div className="rr-qr is-pending" role="note">
        <div className="rr-qr-code" aria-hidden><span>QR</span></div>
        <div className="rr-qr-copy">
          <p className="rr-qr-label">{label}</p>
          <p className="rr-meta">{tr.qrPending}</p>
        </div>
      </div>
    );
  }
  const host = (() => {
    try {
      return new URL(target).host;
    } catch {
      return target;
    }
  })();
  return (
    <div className={`rr-qr${className ? ` ${className}` : ""}`}>
      <a className="rr-qr-btn" href={target} target="_blank" rel="noreferrer">
        {label} <span aria-hidden>↗</span>
      </a>
      {qr && (
        <figure className="rr-qr-code">
          <img src={qr} alt={tr.qrAlt(label, host)} width={132} height={132} />
        </figure>
      )}
      <div className="rr-qr-copy">
        {eyebrow && <p className="rr-qr-eyebrow">{eyebrow}</p>}
        <p className="rr-qr-label">{label}</p>
        <p className="rr-meta">{description ?? tr.qrScan}</p>
        <a className="rr-link rr-qr-text" href={target} target="_blank" rel="noreferrer">{host}</a>
      </div>
    </div>
  );
}
