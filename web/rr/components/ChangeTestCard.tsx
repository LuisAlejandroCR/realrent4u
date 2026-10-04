"use client";
// ChangeTestCard.tsx: one change test (T1–T5) in the dashboard: scenario, rules, expected behavior,
// a "Run test" panel that recomputes it in the browser, and the affected addresses from changes.json.
import { useEffect, useId, useState } from "react";
import type { Address, ChangeResult, ChangeTest, Rule } from "../types";
import type { Dataset } from "../data";
import type { Dict } from "../i18n";
import { TestRunPanel } from "./TestRunner";

export interface ChangeTestCardProps {
  test: ChangeTest;
  /** undefined = no result in changes.json (unknown); defined with [] = confirmed empty. */
  result?: ChangeResult | undefined;
  rules: Map<string, Rule>;
  addresses: Map<string, Address>;
  addressHref: (id: string, asOf?: string) => string;
  data: Dataset;
  tr: Dict;
  /** Open by default (e.g. on desktop). Defaults to open at ≥ 900px. */
  defaultOpen?: boolean;
}

const PREVIEW = 6;

/** Expandable summary card for one fixed scenario (T1–T5). */
export function ChangeTestCard({ test, result, rules, addresses, addressHref, data, tr, defaultOpen }: ChangeTestCardProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setOpen(defaultOpen ?? window.matchMedia("(min-width: 900px)").matches);
  }, [defaultOpen]);

  const has = !!result;
  const affected = result?.affected_address_ids ?? [];
  const conflicts = new Set(result?.conflict_address_ids ?? []);
  const shown = showAll ? affected : affected.slice(0, PREVIEW);
  const dates = test.as_of_before ? [test.as_of_before, test.as_of_after!] : test.as_of ? [test.as_of] : [];

  return (
    <article className={`rr-test ${open ? "is-open" : ""}`}>
      <h2 className="rr-test-h">
        <button type="button" className="rr-test-toggle" aria-expanded={open} aria-controls={`${id}-p`} onClick={() => setOpen(!open)}>
          <span className="rr-test-id">{test.test_id}</span>
          <span className="rr-test-main">
            <span className="rr-test-title">{test.title}</span>
            <span className="rr-test-sub">
              <span className="rr-meta">{test.type}{test.states?.length ? ` · ${test.states.join(", ")}` : ""}</span>
              <span className={`rr-avail ${has ? "is-yes" : "is-no"}`}>
                <span aria-hidden>{has ? "●" : "○"}</span> {has ? tr.resAvailable : tr.resNotAvailable}
              </span>
              {has && (
                <span className="rr-test-counts">
                  {tr.nAffected(affected.length)} · {tr.nConflicts(conflicts.size)}
                </span>
              )}
            </span>
            {!open && test.expected_behavior && <span className="rr-test-teaser">{test.expected_behavior}</span>}
          </span>
          <span className="rr-chev" aria-hidden />
        </button>
      </h2>

      <div id={`${id}-p`} className="rr-test-body" hidden={!open}>
        <div className="rr-scenario-dates">
          <span className="rr-scenario-label">{tr.scenarioDates}</span>
          <span className="rr-scenario-values">
            {dates.map((d, i) => (
              <span key={d}>{i > 0 && <span aria-hidden> → </span>}<time dateTime={d}>{d}</time></span>
            ))}
          </span>
        </div>

        <div className="rr-test-section">
          <h3 className="rr-test-sh">{tr.rulesInvolved}</h3>
          <ul className="rr-rule-list">
            {[...test.rule_ids, ...(test.conflict_with ?? [])].map((oid) => {
              const rid = result?.matched?.[oid];
              const rule = rid ? rules.get(rid) : undefined;
              return (
                <li key={oid}>
                  <span className="rr-id">{oid}</span>{rid && <> → <span className="rr-id">{rid}</span></>}{" "}
                  {rule?.title ?? <span className="rr-missing">{tr.ruleNotInRecord}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        {test.expected_behavior && (
          <div className="rr-test-section">
            <h3 className="rr-test-sh">{tr.expected}</h3>
            <p>{test.expected_behavior}</p>
          </div>
        )}

        <TestRunPanel test={test} result={result} data={data} tr={tr} />

        <div className="rr-test-section">
          <h3 className="rr-test-sh">{tr.affected}</h3>
          {!has ? (
            <p className="rr-unavail"><strong>{tr.resNotAvailable}.</strong> {tr.resNotAvailableBody}</p>
          ) : (
            <>
              <p className="rr-counts">
                <strong>{tr.nAffected(affected.length)}</strong> · <strong>{tr.nConflicts(conflicts.size)}</strong>
              </p>
              {affected.length > 0 && (
                <>
                  <ul className="rr-addr-list">
                    {shown.map((aid) => (
                      <li key={aid}>
                        <a className="rr-link" href={addressHref(aid, test.as_of_after ?? test.as_of)}><span className="rr-id">{aid}</span></a>
                        <span>{addresses.get(aid)?.street_address}, {addresses.get(aid)?.postal_city}</span>
                        {conflicts.has(aid) && <span className="rr-badge rr-badge-review"><span className="rr-badge-dot" aria-hidden />{tr.needsReview}</span>}
                      </li>
                    ))}
                  </ul>
                  {affected.length > PREVIEW && (
                    <button type="button" className="rr-more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                      {showAll ? tr.showLess : tr.showAll(affected.length)}
                    </button>
                  )}
                </>
              )}
              {result?.notes && (
                // The pipeline's own notes: how organizer rule ids were matched and anything it could not decide.
                <details className="rr-test-notes">
                  <summary>{tr.pipelineNotes}</summary>
                  <p>{result.notes}</p>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
