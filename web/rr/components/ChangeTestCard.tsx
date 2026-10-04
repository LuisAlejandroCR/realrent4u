"use client";
// ChangeTestCard.tsx: one change test (T1–T5) in the dashboard: scenario, rules, expected behavior,
// KPI tiles and maps of the affected addresses, a "Run test" panel that recomputes it in the browser, and the
// affected addresses from changes.json.
import { useEffect, useId, useState } from "react";
import type { Address, ChangeResult, ChangeTest, Rule } from "../types";
import type { Dataset } from "../data";
import type { Dict } from "../i18n";
import { TestRunPanel } from "./TestRunner";
import { Kpis, MetroGrid } from "./Charts";
import { useGeo } from "../visual";
import { earn } from "../stamps";

/** KPI tiles and the affected addresses on the metro maps of the states the test touches. */
function TestVisuals({ test, result, data, addressHref, tr }: { test: ChangeTest; result: ChangeResult; data: Dataset; addressHref: (id: string, asOf?: string) => string; tr: Dict }) {
  const geo = useGeo();
  const affected = new Set(result.affected_address_ids ?? []);
  const flagged = new Set(result.conflict_address_ids ?? []);
  const jurOf = (id: string) => data.jurisdictions[id]?.jurisdiction ?? "";
  const cities = new Set([...affected].map(jurOf));
  const allCities = new Set(Object.values(data.jurisdictions).map((j) => j?.jurisdiction).filter(Boolean));
  const total = data.addresses.length;
  const states = new Set([...(test.states ?? []), ...[...affected].map((id) => data.jurisdictions[id]?.state ?? "")]);
  const street = new Map(data.addresses.map((a) => [a.address_id, a.street_address]));
  return (
    <div className="rr-test-vis">
      <Kpis
        items={[
          { value: affected.size, label: tr.kpiAffected, note: ` ${tr.ofN(total)}` },
          { value: flagged.size, label: tr.kpiConflicts, tone: flagged.size ? "warn" : undefined },
          { value: cities.size, label: tr.kpiCities, note: ` ${tr.ofN(allCities.size)}` },
          { value: `${Math.round((affected.size / Math.max(1, total)) * 100)}%`, label: tr.kpiShare },
        ]}
      />
      {geo && (
        <MetroGrid
          geo={geo}
          metroIds={geo.metros.filter((m) => states.has(m.state)).map((m) => m.id)}
          tone={(id) => (flagged.has(id) ? "flag" : affected.has(id) ? "on" : "off")}
          tip={(id) => `${id} · ${street.get(id) ?? ""} · ${jurOf(id)}`}
          legend={[["on", tr.lgAffected], ["flag", tr.lgConflict], ["off", tr.lgNotAffected]]}
          link={{ href: (id) => addressHref(id, test.as_of_after ?? test.as_of) }}
          tr={tr}
        />
      )}
    </div>
  );
}

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
  /** Element id the timeline scrolls to. */
  anchor?: string;
}

const PREVIEW = 6;

/** Expandable summary card for one fixed scenario (T1–T5). */
export function ChangeTestCard({ test, result, rules, addresses, addressHref, data, tr, defaultOpen, anchor }: ChangeTestCardProps) {
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
    <article id={anchor} className={`rr-test ${open ? "is-open" : ""}`}>
      <h2 className="rr-test-h">
        <button type="button" className="rr-test-toggle" aria-expanded={open} aria-controls={`${id}-p`} onClick={() => {
          if (!open) earn("scenario");
          setOpen(!open);
        }}>
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
        {open && result && <TestVisuals test={test} result={result} data={data} addressHref={addressHref} tr={tr} />}
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
