"use client";
// DemoScenarios.tsx: one-click demo cases on the lookup tab (postal vs legal city, precedence, cutoff year,
// missing facts, city line, dated change tests). Every address is found by a predicate over the data, never hard-coded.
import { useMemo } from "react";
import type { Address, Jurisdiction } from "../types";
import type { Dict } from "../i18n";
import { blank, type Dataset } from "../data";
import "../rr-scenarios.css";

export interface Pick {
  address: Address;
  asOf?: string;
  detail: string;
}

export interface Scenario {
  id: string;
  title: string;
  body: string;
  tag?: string;
  picks: Pick[];
}

// AGENTS.md acceptance case A5 uses San Francisco; it is listed first when it has a fitting address.
const PREFERRED_PRECEDENCE = "San Francisco, CA";
// Older than the 1978–79 year-built cutoffs in the California local ordinances.
const OLD_BUILDING_BEFORE = 1979;

const num = (v: string | null) => (blank(v) ? NaN : Number(v));

/** Builds the scenarios from the dataset; a scenario with no fitting address is dropped. */
export function buildScenarios(d: Dataset, tr: Dict): Scenario[] {
  const jOf = (a: Address): Jurisdiction | undefined => d.jurisdictions[a.address_id];
  const resolved = d.addresses.filter((a) => jOf(a)?.jurisdiction);
  const city = (a: Address) => jOf(a)!.jurisdiction!;
  const facts = (a: Address) =>
    `${city(a)} · ${tr.yearBuilt}: ${blank(a.year_built) ? tr.notInRecord : a.year_built} · ${tr.units}: ${blank(a.units) ? tr.notInRecord : a.units}`;
  const out: Scenario[] = [];

  // Postal city differs from the legal place: one address per legal jurisdiction, up to two.
  const postal: Pick[] = [];
  for (const a of resolved) {
    const j = jOf(a)!;
    if (!j.place || j.place.toLowerCase() === a.postal_city.toLowerCase()) continue;
    if (postal.some((p) => city(p.address) === j.jurisdiction)) continue;
    postal.push({ address: a, detail: `${a.postal_city} → ${j.jurisdiction}` });
    if (postal.length === 2) break;
  }
  out.push({ id: "postal", title: tr.scPostalT, body: tr.scPostalB, picks: postal });

  // A local rule that names a state rule it displaces, and an older multi-unit building in that city.
  const displacing = Array.from(new Set(d.rules.filter((r) => r.level === "city" && r.overrides?.length).map((r) => r.jurisdiction)));
  displacing.sort((x, y) => Number(y === PREFERRED_PRECEDENCE) - Number(x === PREFERRED_PRECEDENCE));
  for (const jur of displacing) {
    const a = resolved.find((x) => city(x) === jur && num(x.year_built) < OLD_BUILDING_BEFORE && num(x.units) >= 2);
    if (!a) continue;
    out.push({ id: "precedence", title: tr.scPrecedenceT, body: tr.scPrecedenceB(jur.split(",")[0]!), picks: [{ address: a, detail: facts(a) }] });
    break;
  }

  // A mid-year year-built cutoff and a building from that same year: year built can't place it.
  for (const r of d.rules) {
    const cut = r.coverage_conditions?.["built_cutoff_date"];
    if (typeof cut !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cut) || cut.endsWith("-01-01") || cut.endsWith("-12-31")) continue;
    const a = resolved.find((x) => city(x) === r.jurisdiction && x.year_built === cut.slice(0, 4));
    if (!a) continue;
    out.push({ id: "cutoff", title: tr.scCutoffT, body: tr.scCutoffB(r.jurisdiction.split(",")[0]!, cut), picks: [{ address: a, detail: facts(a) }] });
    break;
  }

  // Missing facts: one address missing both year and units, one missing only the year, in different cities.
  // Prefer cities with a local rule that depends on year built or units, where the gap changes the answer.
  const dependsOnFacts = new Set(
    d.rules
      .filter((r) => r.level === "city" && (r.coverage_conditions?.["built_cutoff_date"] || Number(r.coverage_conditions?.["min_units"]) > 0))
      .map((r) => r.jurisdiction),
  );
  const missing = [...resolved].sort((x, y) => Number(dependsOnFacts.has(city(y))) - Number(dependsOnFacts.has(city(x))));
  const both = missing.find((a) => blank(a.year_built) && blank(a.units));
  const yearOnly = missing.find((a) => blank(a.year_built) && !blank(a.units) && (!both || city(a) !== city(both)));
  out.push({
    id: "missing",
    title: tr.scMissingT,
    body: tr.scMissingB,
    picks: [both, yearOnly].filter((a): a is Address => !!a).map((a) => ({ address: a, detail: facts(a) })),
  });

  // City line: in one state, a city with its own rules on file next to a city with none.
  const localJur = new Set(d.rules.filter((r) => r.level === "city").map((r) => r.jurisdiction));
  const states = Array.from(new Set(resolved.map((a) => jOf(a)!.state).filter((s): s is string => !!s)));
  states.sort((x, y) => Number(y === "NJ") - Number(x === "NJ"));
  for (const st of states) {
    const inState = resolved.filter((a) => jOf(a)!.state === st);
    const withRules = inState.find((a) => city(a) === "Hoboken, NJ" && localJur.has(city(a)))
      ?? inState.find((a) => city(a) === "Jersey City, NJ" && localJur.has(city(a)))
      ?? inState.find((a) => localJur.has(city(a)));
    const without = inState.find((a) => city(a) === "Newark, NJ" && !localJur.has(city(a)))
      ?? inState.find((a) => !localJur.has(city(a)));
    if (!withRules || !without) continue;
    out.push({
      id: "city-line",
      title: tr.scCityLineT,
      body: tr.scCityLineB(st),
      picks: [withRules, without].map((a) => ({ address: a, detail: city(a) })),
    });
    break;
  }

  const inStates = (jur: string, states: string[]) => states.some((st) => jur === st || jur.endsWith(`, ${st}`));

  // Dated change tests (before/after): the first resolved address in the test's state, at both dates.
  // Shown only if a rule on file for that state takes effect between the two dates, so the switch can change something.
  for (const t of d.changeTests) {
    if (!t.as_of_before || !t.as_of_after || !t.states?.length) continue;
    const before = t.as_of_before, after = t.as_of_after, states = t.states;
    const flips = d.rules.some((r) => inStates(r.jurisdiction, states) && !!r.effective_date && r.effective_date > before && r.effective_date <= after);
    const a = resolved.find((x) => states.includes(jOf(x)!.state ?? ""));
    if (!a || !flips) continue;
    out.push({
      id: `dated-${t.test_id}`,
      title: t.title,
      body: tr.scDatedB,
      tag: t.test_id,
      picks: [
        { address: a, asOf: t.as_of_before, detail: `${tr.scBefore} · ${t.as_of_before}` },
        { address: a, asOf: t.as_of_after, detail: `${tr.scAfter} · ${t.as_of_after}` },
      ],
    });
  }

  // Pending change tests: an address in the test's state, shown only when a pending rule (a bill) is on file there.
  for (const t of d.changeTests) {
    if (t.type !== "pending" || !t.states?.length) continue;
    const states = t.states;
    const pending = d.rules.filter((r) => r.status === "pending" && inStates(r.jurisdiction, states)).length;
    const a = resolved.find((x) => states.includes(jOf(x)!.state ?? ""));
    if (!a || !pending) continue;
    out.push({
      id: `pending-${t.test_id}`,
      title: t.title,
      body: tr.scPendingB(pending),
      tag: t.test_id,
      picks: [{ address: a, asOf: t.as_of, detail: `${city(a)}${t.as_of ? ` · ${t.as_of}` : ""}` }],
    });
  }

  return out.filter((s) => s.picks.length > 0);
}

export interface DemoScenariosProps {
  data: Dataset;
  tr: Dict;
  onPick: (a: Address, asOf?: string) => void;
  /** Collapsed list for the search panel instead of the full card grid. */
  compact?: boolean;
  currentId?: string | null;
  asOf?: string;
}

export function DemoScenarios({ data, tr, onPick, compact = false, currentId, asOf }: DemoScenariosProps) {
  const scenarios = useMemo(() => buildScenarios(data, tr), [data, tr]);
  const pressed = (p: Pick) => p.address.address_id === currentId && (!p.asOf || p.asOf === asOf);
  const button = (s: Scenario, p: Pick) => (
    <button
      key={`${s.id}-${p.address.address_id}-${p.asOf ?? ""}`}
      type="button"
      className="rr-sc-pick"
      aria-pressed={pressed(p)}
      onClick={() => onPick(p.address, p.asOf)}
    >
      <span className="rr-id">{p.address.address_id}</span>
      <span className="rr-sc-street">{p.address.street_address}</span>
      <span className="rr-sc-detail">{p.detail}</span>
    </button>
  );

  if (compact) {
    if (!scenarios.length) return null;
    return (
      <details className="rr-sc-compact">
        <summary>{tr.scShort}</summary>
        {scenarios.map((s) => (
          <div key={s.id} className="rr-sc-compact-group">
            <p className="rr-sc-compact-title">{s.tag && <span className="rr-test-id">{s.tag}</span>} {s.title}</p>
            {s.picks.map((p) => button(s, p))}
          </div>
        ))}
      </details>
    );
  }

  return (
    <section className="rr-sc" aria-labelledby="rr-sc-h">
      <p className="rr-kicker">{tr.scKicker}</p>
      <h2 id="rr-sc-h" className="rr-section-title">{tr.scTitle} <em>{tr.scTitleEm}</em></h2>
      <p className="rr-muted rr-sc-intro">{tr.scBody}</p>
      {scenarios.length === 0 ? (
        <p className="rr-muted">{tr.scNone}</p>
      ) : (
        <ul className="rr-sc-grid">
          {scenarios.map((s) => (
            <li key={s.id} className="rr-sc-card">
              <h3 className="rr-sc-title">{s.tag && <span className="rr-test-id">{s.tag}</span>} {s.title}</h3>
              <p className="rr-sc-body">{s.body}</p>
              <div className="rr-sc-picks">{s.picks.map((p) => button(s, p))}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
