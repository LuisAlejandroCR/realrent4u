// QrBlock.tsx: QR code, destination link and an accessible full-screen QR viewer. With no destination
// it shows a pending state rather than a placeholder code; phone layouts use the direct link.
"use client";

import { useRef } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
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
        <>
          <figure className="rr-qr-code">
            <img src={qr} alt={tr.qrAlt(label, host)} width={132} height={132} />
          </figure>
          <button className="rr-qr-expand" type="button" aria-label={tr.qrExpand} onClick={() => dialogRef.current?.showModal()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4m0-4 6 6m6 10h4v-4m0 4-6-6M20 8V4h-4m4 0-6 6M4 16v4h4m-4 0 6-6" /></svg>
          </button>
          <dialog
            ref={dialogRef}
            className="rr-qr-dialog"
            aria-label={tr.qrAlt(label, host)}
            onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
          >
            <div className="rr-qr-dialog-content">
              <img className="rr-qr-dialog-image" src={qr} alt={tr.qrAlt(label, host)} />
              <p>{description ?? tr.qrScan}</p>
              <div className="rr-qr-dialog-actions">
                <a className="rr-l-btn rr-l-btn-ghost" href={target} target="_blank" rel="noreferrer">{tr.qrOpen}</a>
                <button className="rr-l-btn rr-l-btn-primary" type="button" onClick={() => dialogRef.current?.close()}>{tr.qrClose}</button>
              </div>
            </div>
          </dialog>
        </>
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
