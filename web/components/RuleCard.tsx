// RuleCard.tsx: one rule for one address — result badge, explanation, citation, quoted span, source,
// retrieval date and as-of date. Without a lookup item it renders the rule's status only (not evaluated).
"use client";

import { useApp } from "./Providers";
import { formatDate, resultLabels, statusLabels } from "@/lib/i18n";
import type { LookupItem, Rule } from "@/lib/types";

export function ResultBadge({ result }: { result: string }) {
  const { lang } = useApp();
  return <span className={`badge result-${result}`}>{resultLabels[lang][result] ?? result}</span>;
}

export function RuleCard({ rule, item, ruleId }: { rule?: Rule; item?: LookupItem; ruleId: string }) {
  const { lang, t, asOf, data } = useApp();
  const doc = rule?.source_doc_id ? data?.corpus[rule.source_doc_id] : undefined;
  const retrieved = rule?.retrieved_at ?? doc?.retrieved_at ?? null;
  const explanation = item ? (lang === "es" && item.explanation_es ? item.explanation_es : item.explanation) : null;
  const coverage = typeof rule?.coverage_conditions === "string" ? rule.coverage_conditions : rule?.coverage_conditions?.text;

  return (
    <article className="card rule" data-testid="rule-card">
      <div className="rule-head">
        <div>
          <h3>{rule?.title ?? ruleId}</h3>
          <p className="muted small">
            {ruleId} · {rule?.jurisdiction ?? "—"} · {rule?.level ?? "—"} · {rule?.category?.replaceAll("_", " ") ?? "—"}
          </p>
        </div>
        <div className="rule-badges">
          {item ? <ResultBadge result={item.result} /> : rule && <span className={`badge status-${rule.status}`}>{t("ruleStatus")}: {statusLabels[lang][rule.status] ?? rule.status}</span>}
          {(item?.conflict_flag || (!item && rule?.conflict_flag)) && <span className="badge badge-conflict">⚑ {t("conflictFlag")}</span>}
        </div>
      </div>

      {!rule && <p className="callout callout-warn">{t("unknownRule")}</p>}

      {explanation && (
        <p className="explanation">
          <span className="label">{t("explanation")}:</span> {explanation}
        </p>
      )}
      {item?.reason && (
        <p className="small">
          <span className="label">{t("reason")}:</span> <code>{item.reason}</code>
        </p>
      )}
      {rule && <p className="requirement">{rule.requirement}</p>}

      {rule && (
        <dl className="facts">
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
          <dt>{t("citation")}</dt>
          <dd>
            <strong>{rule.citation}</strong>
          </dd>
        </dl>
      )}

      {rule && (
        <figure className="quote">
          <figcaption>{t("quotedSpan")}</figcaption>
          <blockquote>“{rule.quoted_span}”</blockquote>
        </figure>
      )}

      {rule && (
        <p className="provenance small">
          <span>
            <span className="label">{t("source")}:</span>{" "}
            <a href={rule.source_url} target="_blank" rel="noopener noreferrer">
              {rule.source_doc_id ? `${rule.source_doc_id} — ` : ""}
              {shortUrl(rule.source_url)}
            </a>
          </span>
          <span>
            <span className="label">{t("retrieved")}:</span> {retrieved ? retrieved.replace("T", " ") : t("notCaptured")}
          </span>
          <span>
            <span className="label">{t("asOf")}:</span> {asOf}
          </span>
        </p>
      )}
    </article>
  );
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    const p = url.pathname.length > 40 ? url.pathname.slice(0, 40) + "…" : url.pathname;
    return url.host + p;
  } catch {
    return u;
  }
}
