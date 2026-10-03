// Result.tsx: status pill (hue on the dot only), quote block and one result row per rule, per docs/DESIGN.md.
// A row without a lookup item shows the rule's status as "not evaluated"; superseded rows can nest under the displacing rule.
"use client";

import { useApp } from "./Providers";
import { formatDate, resultLabels, statusLabels } from "@/lib/i18n";
import type { LookupItem, Rule } from "@/lib/types";

export function StatusPill({ result }: { result: string }) {
  const { lang } = useApp();
  return (
    <span className={`status-pill s-${result}`}>
      <span className="dot" aria-hidden="true" />
      {resultLabels[lang][result] ?? result}
    </span>
  );
}

export function RuleStatusPill({ status }: { status: string }) {
  const { lang, t } = useApp();
  return (
    <span className={`status-pill st-${status}`}>
      <span className="dot" aria-hidden="true" />
      {t("notEvaluated")} · {statusLabels[lang][status] ?? status}
    </span>
  );
}

export function ConflictPill() {
  const { t } = useApp();
  return (
    <span className="status-pill s-conflict">
      <svg className="flag" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 14V2.5M3.5 3h8l-2 3 2 3h-8" />
      </svg>
      {t("conflictFlag")}
    </span>
  );
}

export function QuoteBlock({ rule }: { rule: Rule }) {
  const { t, asOf, data } = useApp();
  const doc = rule.source_doc_id ? data?.corpus[rule.source_doc_id] : undefined;
  const retrieved = rule.retrieved_at ?? doc?.retrieved_at ?? null;
  return (
    <figure className="quote">
      <blockquote>“{rule.quoted_span}”</blockquote>
      <figcaption>
        <span>
          {t("source")}
          {rule.source_doc_id ? ` ${rule.source_doc_id}` : ""} · {t("retrieved")} {retrieved ? retrieved.slice(0, 10) : t("notCaptured")} ·{" "}
          {t("asOf").toLowerCase()} {asOf}
        </span>
        <a href={rule.source_url} target="_blank" rel="noopener noreferrer">
          {shortUrl(rule.source_url)}
        </a>
      </figcaption>
    </figure>
  );
}

export function ResultRow({
  rule,
  item,
  ruleId,
  index = 0,
  children,
}: {
  rule?: Rule;
  item?: LookupItem;
  ruleId: string;
  index?: number;
  children?: React.ReactNode;
}) {
  const { lang, t, asOf } = useApp();
  const explanation = item ? (lang === "es" && item.explanation_es ? item.explanation_es : item.explanation) : null;
  const coverage = typeof rule?.coverage_conditions === "string" ? rule.coverage_conditions : rule?.coverage_conditions?.text;
  const key = item?.result ?? `st-${rule?.status ?? "none"}`;
  const flagged = item ? item.conflict_flag : rule?.conflict_flag;

  return (
    <article className={`result r-${key}`} style={{ ["--i" as string]: Math.min(index, 8) }} data-testid="rule-card">
      <div className="result-head">
        {item ? <StatusPill result={item.result} /> : rule ? <RuleStatusPill status={rule.status} /> : null}
        {flagged ? <ConflictPill /> : null}
      </div>
      <h4 className="result-title">{rule?.title ?? ruleId}</h4>
      {!rule && <p className="notice notice-warn">{t("unknownRule")}</p>}
      {explanation && <p className="explanation">{explanation}</p>}
      {item?.reason && (
        <p className="small muted">
          {t("reason")}: <code>{item.reason}</code>
        </p>
      )}
      {rule && <p className="requirement">{rule.requirement}</p>}
      {rule && (
        <dl className="kv">
          <dt>{t("citation")}</dt>
          <dd>
            <code className="cite">{rule.citation}</code>
          </dd>
          {rule.key_value && (
            <>
              <dt>{t("keyValue")}</dt>
              <dd>{rule.key_value}</dd>
            </>
          )}
          {coverage && (
            <>
              <dt>{t("coverage")}</dt>
              <dd>{coverage}</dd>
            </>
          )}
          {rule.exemptions && (
            <>
              <dt>{t("exemptions")}</dt>
              <dd>{rule.exemptions}</dd>
            </>
          )}
          {rule.penalty && (
            <>
              <dt>{t("penalty")}</dt>
              <dd>{rule.penalty}</dd>
            </>
          )}
          <dt>{t("effective")}</dt>
          <dd>
            {formatDate(rule.effective_date, lang)} · {statusLabels[lang][rule.status] ?? rule.status}
          </dd>
        </dl>
      )}
      {rule && <QuoteBlock rule={rule} />}
      {children}
      <p className="result-foot">
        {t("notLegalAdvice")} {t("asOf")} {asOf} · <code>{ruleId}</code>
      </p>
    </article>
  );
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    const p = url.pathname.length > 36 ? url.pathname.slice(0, 36) + "…" : url.pathname;
    return url.host + p;
  } catch {
    return u;
  }
}
