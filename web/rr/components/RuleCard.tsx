// RuleCard.tsx: one rule for one address: result badge, reason, requirement, quoted text, citation, source, retrieval date.
import type { LookupItem, Rule, Lang } from "../types";
import type { Dict } from "../i18n";
import { StatusBadge } from "./StatusBadge";

export interface RuleCardProps {
  rule: Rule;
  /** Precomputed result. Omit when no lookup exists for this date → shown as "not evaluated". */
  item?: LookupItem | undefined;
  /** Rules this one displaces (resolved from rule.overrides). */
  displaced?: Rule[] | undefined;
  lang: Lang;
  tr: Dict;
}

export function RuleCard({ rule, item, displaced = [], lang, tr }: RuleCardProps) {
  const kind = item ? item.result : "unevaluated";
  // The engine decides conflicts per address; the rule-level flag only shows when nothing was evaluated.
  const conflict = item ? item.conflict_flag : !!rule.conflict_flag;
  const explanation = item ? (lang === "es" && item.explanation_es ? item.explanation_es : item.explanation) : null;

  return (
    <article className={`rr-rule rr-rule-${kind}`} aria-labelledby={`h-${rule.team_rule_id}`}>
      <header className="rr-rule-head">
        <div className="rr-badges">
          <StatusBadge kind={kind} tr={tr} />
          {conflict && <StatusBadge kind="review" tr={tr} />}
          <span className="rr-meta">{tr.ruleStatus}: {tr.status[rule.status] ?? rule.status}</span>
        </div>
        <h3 id={`h-${rule.team_rule_id}`} className="rr-rule-title">{rule.title}</h3>
        <p className="rr-meta">
          <span className="rr-id">{rule.team_rule_id}</span> · {rule.jurisdiction} · {rule.level}
          {rule.effective_date && <> · {rule.effective_date}</>}
        </p>
      </header>

      {explanation && (
        <div className="rr-why">
          <h4>{tr.why}</h4>
          <p>{explanation}</p>
          {item?.result === "unknown" && item.reason && (
            <p className="rr-missing-line"><strong>{tr.missingField}:</strong> {item.reason} — <em>{tr.notInRecord}</em></p>
          )}
        </div>
      )}
      {conflict && rule.conflict_note && <p className="rr-review-note">{rule.conflict_note}</p>}

      <p className="rr-req">{rule.requirement}</p>

      {rule.quoted_span && (
        <blockquote className="rr-quote">
          <span className="rr-sr">{tr.quoted}: </span>“{rule.quoted_span}”
        </blockquote>
      )}

      <footer className="rr-rule-foot">
        <span><span className="rr-label">{tr.citation}</span> {rule.citation ?? <span className="rr-missing">{tr.notInRecord}</span>}</span>
        {rule.retrieved_at && <span><span className="rr-label">{tr.retrieved}</span> {rule.retrieved_at}</span>}
        {rule.source_url && (
          <a href={rule.source_url} target="_blank" rel="noreferrer" className="rr-link">
            {tr.source} <span aria-hidden>↗</span>
          </a>
        )}
      </footer>

      {displaced.length > 0 && (
        <details className="rr-displaced">
          <summary>{tr.displaces(displaced.length)}</summary>
          <ul>
            {displaced.map((d) => (
              <li key={d.team_rule_id}>
                <StatusBadge kind="superseded" tr={tr} /> <span className="rr-id">{d.team_rule_id}</span> {d.title}
                {d.citation && <span className="rr-muted"> · {d.citation}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
