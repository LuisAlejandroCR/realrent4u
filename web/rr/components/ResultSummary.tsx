"use client";
// ResultSummary.tsx: "at a glance" strip above an address's results: a result-mix bar, a count per result and conflict flags,
// each jumping to its first card, with the as-of date and "not legal advice". No counts when nothing was evaluated.
import type { LookupItem, LookupResult, Rule } from "../types";
import type { Dict } from "../i18n";
import { StatusBadge } from "./StatusBadge";
import "../rr-scenarios.css";
import "../rr-cinema.css";

const ORDER: LookupResult[] = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];

export interface ResultSummaryProps {
  /** Rules shown for this address (lookup hits, or the rules on file when not evaluated). */
  rules: Rule[];
  /** undefined = no lookup for this date; [] = evaluated, nothing reaches the address. */
  items?: LookupItem[] | undefined;
  asOf: string;
  tr: Dict;
}

/** Scrolls to a rule's card. A displaced rule has no card of its own, so open it inside the rule that displaces it. */
function jumpTo(id: string, rules: Rule[]) {
  let target: HTMLElement | null = document.getElementById(`h-${id}`)?.closest("article") ?? null;
  if (!target) {
    const host = rules.find((r) => r.overrides?.includes(id));
    const card = host ? document.getElementById(`h-${host.team_rule_id}`)?.closest("article") : null;
    const nested = card?.querySelector("details");
    if (nested) nested.open = true;
    target = (nested as HTMLElement | null | undefined) ?? card ?? null;
  }
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

export function ResultSummary({ rules, items, asOf, tr }: ResultSummaryProps) {
  const first = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const i of items ?? []) {
    counts.set(i.result, (counts.get(i.result) ?? 0) + 1);
    if (!first.has(i.result)) first.set(i.result, i.team_rule_id);
  }
  const flagged = (items ?? []).filter((i) => i.conflict_flag);

  return (
    <section className="rr-sum" aria-labelledby="rr-sum-h">
      <div className="rr-sum-head">
        <h2 id="rr-sum-h" className="rr-sum-title">{tr.sumTitle}</h2>
        <p className="rr-sum-stamp" role="note">
          <span>{tr.notAdvice}</span> · <span>{tr.asOf} <time dateTime={asOf}>{asOf}</time></span>
        </p>
      </div>

      {!items ? (
        <p className="rr-sum-line">
          <StatusBadge kind="unevaluated" tr={tr} /> {tr.sumNotEvaluated(rules.length)}
        </p>
      ) : items.length === 0 ? (
        <p className="rr-sum-line">{tr.sumEmpty}</p>
      ) : (
        <>
          <p className="rr-sum-line rr-muted">{tr.sumOf(items.length)}</p>
          <div className="rr-stage-bar rr-sum-bar" role="img" aria-label={ORDER.filter((k) => counts.has(k)).map((k) => `${counts.get(k)} ${tr.result[k] ?? k}`).join(", ")}>
            {ORDER.map((k) => (
              <span key={k} className={`rr-seg rr-seg-${k}`} style={{ width: `${((counts.get(k) ?? 0) / items.length) * 100}%` }} />
            ))}
          </div>
          <ul className="rr-sum-list">
            {ORDER.filter((k) => counts.has(k)).map((k) => (
              <li key={k}>
                <button type="button" className="rr-sum-btn" aria-label={`${counts.get(k)} · ${tr.sumJump(tr.result[k] ?? k)}`} onClick={() => jumpTo(first.get(k)!, rules)}>
                  <StatusBadge kind={k} tr={tr} />
                  <span className="rr-sum-n">{counts.get(k)}</span>
                </button>
              </li>
            ))}
            {flagged.length > 0 && (
              <li>
                <button type="button" className="rr-sum-btn" aria-label={`${flagged.length} · ${tr.sumJump(tr.needsReview)}`} onClick={() => jumpTo(flagged[0]!.team_rule_id, rules)}>
                  <StatusBadge kind="review" tr={tr} />
                  <span className="rr-sum-n">{flagged.length}</span>
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
