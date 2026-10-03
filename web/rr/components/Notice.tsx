// Notice.tsx: inline state panel for empty, error, fixture and missing-data states.
import type { ReactNode } from "react";

export interface NoticeProps {
  tone?: "info" | "warn" | "danger" | "neutral";
  title: string;
  children?: ReactNode;
}

/** Inline state panel: empty, error, fixtures, missing data, etc. */
export function Notice({ tone = "info", title, children }: NoticeProps) {
  return (
    <section className={`rr-notice rr-notice-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <h2 className="rr-notice-title">{title}</h2>
      {children && <div className="rr-notice-body">{children}</div>}
    </section>
  );
}
