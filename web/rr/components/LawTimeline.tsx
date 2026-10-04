"use client";
// LawTimeline.tsx: the five change tests drawn on one date axis. A dated test is a span from its before date
// to its after date; a single-date test is one marker. Each lane links to the test in the dashboard and shows
// its affected-address count from changes.json ("results not available" when the file has no entry).
import type { Dict } from "../i18n";
import type { ChangeResult, ChangeTest } from "../types";
import { useReveal } from "../hero";

export interface LawTimelineProps {
  tests: ChangeTest[];
  results: ChangeResult[];
  total: number;
  href: (testId: string) => string;
  tr: Dict;
}

export function LawTimeline({ tests, results, total, href, tr }: LawTimelineProps) {
  const ref = useReveal<HTMLDivElement>();
  const dates = Array.from(new Set(tests.flatMap((t) => [t.as_of_before, t.as_of_after, t.as_of]).filter((d): d is string => !!d))).sort();
  const col = (d: string) => dates.indexOf(d) + 1;

  return (
    <div className="rr-tl" ref={ref} style={{ ["--rr-tl-cols" as string]: dates.length }}>
      <div className="rr-tl-axis" aria-hidden>
        <span />
        <div className="rr-tl-track">
          {dates.map((d) => <span key={d} className="rr-mono">{d}</span>)}
        </div>
        <span />
        <span />
      </div>
      <ol className="rr-tl-lanes">
        {tests.map((t, i) => {
          const r = results.find((x) => x.test_id === t.test_id);
          const n = r?.affected_address_ids?.length ?? 0;
          const flags = r?.conflict_address_ids?.length ?? 0;
          const from = t.as_of_before ?? t.as_of ?? "";
          const to = t.as_of_after ?? t.as_of ?? "";
          const span = from !== to;
          const shape = t.type === "pending" ? "is-pending" : !n && r ? "is-empty" : "is-dot";
          return (
            <li key={t.test_id} style={{ ["--i" as string]: i }}>
              <a href={href(t.test_id)} className="rr-tl-lane">
                <span className="rr-tl-label">
                  <span className="rr-test-id">{t.test_id}</span>
                  <span className="rr-tl-title">{t.title}</span>
                </span>
                <span className="rr-tl-track" aria-hidden>
                  {dates.map((d) => <i key={d} className="rr-tl-tick" style={{ gridColumn: col(d) }} />)}
                  {span ? (
                    <span
                      className="rr-tl-span"
                      style={{ gridColumn: `${col(from)} / ${col(to) + 1}`, marginInline: `${50 / (col(to) - col(from) + 1)}%` }}
                    >
                      <b className="rr-tl-from" />
                      <b className="rr-tl-to" />
                    </span>
                  ) : (
                    <span className={`rr-tl-mark ${shape}`} style={{ gridColumn: col(from) }} />
                  )}
                </span>
                <span className="rr-tl-dates rr-mono">{span ? `${from} → ${to}` : from}</span>
                <span className="rr-tl-n">
                  {!r ? (
                    <span className="rr-tl-na">{tr.resNotAvailable}</span>
                  ) : (
                    <>
                      <span className="rr-tl-bar" aria-hidden><span style={{ width: `${(n / Math.max(1, total)) * 100}%` }} /></span>
                      <span>{n ? tr.nAffected(n) : tr.confirmedEmpty}</span>
                      {flags > 0 && <span className="rr-tl-flag">▲ {tr.nConflicts(flags)}</span>}
                    </>
                  )}
                </span>
                <span className="rr-tl-go" aria-hidden>→</span>
              </a>
            </li>
          );
        })}
      </ol>
      <p className="rr-meta rr-tl-note">{tr.tlNote}</p>
    </div>
  );
}
