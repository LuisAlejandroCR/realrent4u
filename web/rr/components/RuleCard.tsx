// RuleCard.tsx: one rule for one address, lean as on mobile: result badge, title, one-line reason, the quoted
// source text and its citation, retrieval date, as-of date and "not legal advice". The engine's full explanation,
// requirement and extracted details sit behind one toggle.
import type { LookupItem, Rule, Lang } from "../types";
import type { Dict } from "../i18n";
import { reasonLabel } from "../reason-labels";
import { blank } from "../data";
import { StatusBadge } from "./StatusBadge";
import { earn } from "../stamps";

export interface DisplacedRule {
  rule: Rule;
  item?: LookupItem | undefined;
}

export interface RuleCardProps {
  rule: Rule;
  /** Precomputed result. Omit when no lookup exists for this date → shown as "not evaluated". */
  item?: LookupItem | undefined;
  /** Rules this one displaces (resolved from rule.overrides). */
  displaced?: DisplacedRule[] | undefined;
  /** The as-of date the result answers for. */
  asOf: string;
  lang: Lang;
  tr: Dict;
}

// Fields rules.json carries beyond the frontend Rule type; read-only here, the contract stays in types.ts.
type RuleExtra = Rule & { exemptions?: unknown; source_doc_id?: unknown; enacted_date?: unknown };
const text = (v: unknown): string | null => (typeof v === "string" && !blank(v) ? v : null);

/** Reason line: missing facts say "not in the record"; other reasons (supersession, conflicting sources) do not. */
function Reason({ reason, lang, tr }: { reason: string; lang: Lang; tr: Dict }) {
  const missing = reason.split(",").some((r) => r.trim().startsWith("missing_"));
  return (
    <p className="rr-missing-line">
      <strong>{missing ? tr.missingField : tr.reason}:</strong> {reasonLabel(reason, lang)}
      {missing && <> — <em>{tr.notInRecord}</em></>}
    </p>
  );
}

export function RuleCard({ rule, item, displaced = [], asOf, lang, tr }: RuleCardProps) {
  const kind = item ? item.result : "unevaluated";
  // The engine decides conflicts per address; the rule-level flag only shows when nothing was evaluated.
  const conflict = item ? item.conflict_flag : !!rule.conflict_flag;
  const explanation = item ? (lang === "es" && item.explanation_es ? item.explanation_es : item.explanation) : null;
  const x = rule as RuleExtra;
  const docId = text(x.source_doc_id);
  const keyValue = text(rule.key_value);
  const details = (
    [
      [tr.covers, text(rule.coverage_conditions?.text)],
      [tr.exemptions, text(x.exemptions)],
      [tr.penalty, text(rule.penalty)],
      [tr.enacted, text(x.enacted_date)],
      [tr.effective, text(rule.effective_date)],
    ] as [string, string | null][]
  ).filter((d): d is [string, string] => !!d[1]);

  return (
    <article className={`rr-rule rr-rule-${kind}`} aria-labelledby={`h-${rule.team_rule_id}`}>
      <header className="rr-rule-head">
        <div className="rr-badges">
          <StatusBadge kind={kind} tr={tr} />
          {conflict && <StatusBadge kind="review" tr={tr} />}
        </div>
        <h3 id={`h-${rule.team_rule_id}`} className="rr-rule-title">{rule.title}</h3>
        {item?.reason && <Reason reason={item.reason} lang={lang} tr={tr} />}
        {keyValue && <p className="rr-key"><span className="rr-label">{tr.keyValue}</span> {keyValue}</p>}
      </header>
      {conflict && rule.conflict_note && <p className="rr-review-note">{rule.conflict_note}</p>}
      {rule.quoted_span && (
        <blockquote className="rr-quote">
          <span className="rr-sr">{tr.quoted}: </span>“{rule.quoted_span}”
        </blockquote>
      )}

      <footer className="rr-rule-foot">
        <span><span className="rr-label">{tr.citation}</span> {rule.citation ?? <span className="rr-missing">{tr.notInRecord}</span>}</span>
        {docId && <span><span className="rr-label">{tr.sourceDoc}</span> <span className="rr-mono">{docId}</span></span>}
        {rule.retrieved_at && <span><span className="rr-label">{tr.retrieved}</span> <span className="rr-mono">{rule.retrieved_at}</span></span>}
        <span><span className="rr-label">{tr.asOf}</span> <time className="rr-mono" dateTime={asOf}>{asOf}</time></span>
        {rule.source_url && (
          <a href={rule.source_url} target="_blank" rel="noreferrer" className="rr-link" onClick={() => earn("source")}>
            {tr.source} <span aria-hidden>↗</span><span className="rr-sr"> ({tr.newTab})</span>
          </a>
        )}
        <span className="rr-rule-advice">{tr.notAdvice}</span>
      </footer>

      <details className="rr-rule-more" open={item?.result === "unknown" || undefined}>
        <summary>{tr.fullExplanation}</summary>
        {explanation && (
          <div className="rr-why">
            <h4>{tr.why}</h4>
            <p>{explanation}</p>
          </div>
        )}
        <p className="rr-req">{rule.requirement}</p>
        <dl>
          <div><dt>{tr.ruleStatus}</dt><dd>{tr.status[rule.status] ?? rule.status}</dd></div>
          <div><dt>{tr.legalJurisdiction}</dt><dd><span className="rr-id">{rule.team_rule_id}</span> · {rule.jurisdiction} · {tr.level[rule.level] ?? rule.level}</dd></div>
          {details.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </details>

      {displaced.length > 0 && (
        <details className="rr-displaced">
          <summary>{tr.displaces(displaced.length)}</summary>
          <ul>
            {displaced.map(({ rule: d, item: displacedItem }) => (
              <li key={d.team_rule_id}>
                <StatusBadge kind={displacedItem?.result ?? "superseded"} tr={tr} /> <span className="rr-id">{d.team_rule_id}</span> {d.title}
                {d.citation && <span className="rr-muted"> · {d.citation}</span>}
                {displacedItem?.explanation && (
                  <p>{lang === "es" && displacedItem.explanation_es ? displacedItem.explanation_es : displacedItem.explanation}</p>
                )}
                {displacedItem?.reason && <Reason reason={displacedItem.reason} lang={lang} tr={tr} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
