"use client";
// HomeView.tsx: landing page: dark hero with a phone showing a real lookup, numbered chapters (problem,
// journey, results, change tests) and a closing call to the dashboard. Every number comes from the data.
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { StatusBadge } from "../components/StatusBadge";
import { rulesInRecord, useLookups, type Dataset } from "../data";
import { hrefWith, usePrefs } from "../prefs";
import type { LookupItem } from "../types";

// First address whose postal city differs from its legal jurisdiction and has a quoted, sourced rule.
function pickSample(d: Dataset) {
  const a = d.addresses.find((x) => {
    const j = d.jurisdictions[x.address_id];
    return j?.jurisdiction && j.place && j.place !== x.postal_city && rulesInRecord(d.rules, j).some((r) => r.quoted_span && r.source_url);
  });
  if (!a) return null;
  const j = d.jurisdictions[a.address_id]!;
  const rules = rulesInRecord(d.rules, j);
  return { a, j, rules, rule: rules.find((r) => r.quoted_span && r.source_url)! };
}

function Chapter({ n, label, id, dark, children }: { n: number; label: string; id?: string; dark?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`rr-l-chapter ${dark ? "rr-l-dark" : ""}`} aria-label={label}>
      <div className="rr-wrap">
        <p className="rr-l-n">{String(n).padStart(2, "0")} / {label}</p>
        {children}
      </div>
    </section>
  );
}

function Phone({ data, s, items, asOf }: { data: Dataset; s: NonNullable<ReturnType<typeof pickSample>>; items?: LookupItem[]; asOf: string }) {
  const { tr } = usePrefs();
  const byId = new Map(data.rules.map((r) => [r.team_rule_id, r]));
  const rows = (items ?? []).slice(0, 4);
  return (
    <div className="rr-l-phone" aria-label={tr.phoneLabel} role="img">
      <div className="rr-l-phone-status"><span>9:41</span><span className="rr-l-island" /><span>●●●</span></div>
      <div className="rr-l-phone-body">
        <p className="rr-l-phone-k">{tr.addressId} · <span className="rr-mono">{s.a.address_id}</span></p>
        <p className="rr-l-phone-addr">{s.a.street_address}</p>
        <p className="rr-l-phone-j">{s.a.postal_city} <span aria-hidden>→</span> <strong>{s.j.jurisdiction}</strong></p>
        <ul>
          {rows.length
            ? rows.map((i) => (
                <li key={i.team_rule_id}>
                  <StatusBadge kind={i.result} tr={tr} />
                  <span>{byId.get(i.team_rule_id)?.title ?? i.team_rule_id}</span>
                </li>
              ))
            : s.rules.slice(0, 4).map((r) => (
                <li key={r.team_rule_id}>
                  <StatusBadge kind="unevaluated" tr={tr} />
                  <span>{r.title}</span>
                </li>
              ))}
        </ul>
        <p className="rr-l-phone-foot">{tr.asOf} <span className="rr-mono">{asOf}</span> · {tr.notAdvice}</p>
      </div>
    </div>
  );
}

function Landing({ data }: { data: Dataset }) {
  const prefs = usePrefs();
  const { tr } = prefs;
  const asOf = prefs.asOf ?? data.manifest.default_as_of;
  const lookups = useLookups(data.manifest, asOf);
  const s = pickSample(data);
  const items = s && lookups.state === "ready" ? lookups.data?.[s.a.address_id] : undefined;
  const resolved = Object.values(data.jurisdictions).filter((j) => j?.jurisdiction).length;
  const quoted = data.rules.filter((r) => r.quoted_span).length;
  const places = new Set(data.rules.map((r) => r.jurisdiction)).size;
  const dates = data.manifest.lookup_dates.length ? data.manifest.lookup_dates : data.manifest.demo_dates;
  const dash = (extra: Record<string, string> = {}) => hrefWith("/dashboard", prefs, extra);
  const levels = s ? `${s.rules.filter((r) => r.level === "state").length} ${tr.levelState} · ${s.rules.filter((r) => r.level !== "state").length} ${tr.levelLocal}` : "";

  return (
    <div className="rr-l">
      {/* Hero */}
      <section className="rr-l-hero" aria-labelledby="hero-h">
        <div className="rr-wrap rr-l-hero-in">
          <p className="rr-l-kicker"><span aria-hidden>●</span> {tr.lKicker}</p>
          <h1 id="hero-h" className="rr-l-title">{tr.lTitle}<br /><em>{tr.lTitleEm}</em></h1>
          <p className="rr-l-body">{tr.lBody}</p>
          <div className="rr-l-ctas">
            <a className="rr-l-btn rr-l-btn-primary" href={dash()}>{tr.lCta} <span aria-hidden>→</span></a>
            <a className="rr-l-btn rr-l-btn-ghost" href="#how">{tr.lHow}</a>
          </div>
          <ul className="rr-l-ticks">{tr.lTicks.map((x) => <li key={x}>{x}</li>)}</ul>
          {s && <Phone data={data} s={s} items={items} asOf={asOf} />}
        </div>
      </section>

      <div className="rr-l-marquee" aria-hidden>
        <div>{[...tr.strip, ...tr.strip].map((x, i) => <span key={i}>{x}</span>)}</div>
      </div>

      {/* 01 Problem */}
      <Chapter n={1} label={tr.lCh[0]!}>
        <h2 className="rr-l-h2">{tr.lProblemTitle}<br /><em>{tr.lProblemEm}</em></h2>
        <div className="rr-l-cols">
          <p>{tr.lProblemP1}</p>
          <p>{tr.lProblemP2}</p>
        </div>
        {s && (
          <p className="rr-example">
            <span className="rr-label">{tr.exampleFromData}</span>{" "}
            <span className="rr-id">{s.a.address_id}</span> {s.a.street_address} — {tr.postalCity}: <strong>{s.a.postal_city}</strong> → {tr.legalJurisdiction}: <strong>{s.j.jurisdiction}</strong>
          </p>
        )}
        <dl className="rr-l-stats">
          <div><dt>{resolved}</dt><dd>{tr.statResolved}</dd></div>
          <div><dt>{quoted}</dt><dd>{tr.statQuoted(places)}</dd></div>
          <div><dt>{dates.length}</dt><dd>{tr.statDates}</dd></div>
        </dl>
      </Chapter>

      {/* 02 Journey */}
      <Chapter n={2} label={tr.lCh[1]!} id="how" dark>
        <h2 className="rr-l-h2">{tr.lJourneyTitle}<br /><em>{tr.lJourneyEm}</em></h2>
        <ol className="rr-l-steps">
          {tr.lSteps.map(([t, b], i) => (
            <li key={t}>
              <span className="rr-l-step-n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t}</h3>
              <p>{b}</p>
              <p className="rr-l-proof">
                {i === 0 && s && <>{s.a.postal_city} → <strong>{s.j.jurisdiction}</strong></>}
                {i === 1 && s && <>{s.j.jurisdiction}: {levels}</>}
                {i === 2 && dates.map((d) => <span key={d} className="rr-mono">{d}</span>)}
                {i === 3 && s && <>“{s.rule.quoted_span!.slice(0, 110)}{s.rule.quoted_span!.length > 110 ? "…" : ""}” <span className="rr-muted">— {s.rule.citation}</span></>}
              </p>
            </li>
          ))}
        </ol>
        <p className="rr-l-foot">{tr.lStepsFoot}</p>
      </Chapter>

      {/* 03 Results */}
      <Chapter n={3} label={tr.lCh[2]!}>
        <h2 className="rr-l-h2">{tr.lResultsTitle}<br /><em>{tr.lResultsEm}</em></h2>
        <dl className="rr-states">
          {(["applies", "unknown", "superseded", "not_yet_effective", "pending"] as const).map((key) => (
            <div key={key} className={`rr-state rr-rule-${key}`}>
              <dt><StatusBadge kind={key} tr={tr} /></dt>
              <dd>{tr.stateDesc[key]}</dd>
            </div>
          ))}
        </dl>
      </Chapter>

      {/* 04 Change tests */}
      <Chapter n={4} label={tr.lCh[3]!}>
        <h2 className="rr-l-h2">{tr.lTestsTitle}<br /><em>{tr.lTestsEm}</em></h2>
        <p className="rr-lead">{tr.lTestsBody}</p>
        <ol className="rr-l-tests">
          {data.changeTests.map((t) => {
            const r = data.changeResults.find((x) => x.test_id === t.test_id);
            return (
              <li key={t.test_id}>
                <span className="rr-test-id">{t.test_id}</span>
                <span className="rr-l-tests-main">
                  <strong>{t.title}</strong>
                  <span className="rr-mono rr-muted">{t.as_of_before ? `${t.as_of_before} → ${t.as_of_after}` : t.as_of}</span>
                </span>
                <span className="rr-l-tests-n">{r ? tr.nAffected(r.affected_address_ids?.length ?? 0) : tr.resNotAvailable}</span>
                <a className="rr-l-run" href={dash({ tab: "tests", t: t.test_id })}>▶ {tr.runInDash}</a>
              </li>
            );
          })}
        </ol>
      </Chapter>

      {/* Closing */}
      <section className="rr-l-close rr-l-dark" aria-labelledby="close-h">
        <div className="rr-wrap">
          <p className="rr-l-kicker">{tr.lCloseKicker}</p>
          <h2 id="close-h" className="rr-l-title">{tr.lCloseTitle}<br /><em>{tr.lCloseEm}</em></h2>
          <div className="rr-l-ctas">
            <a className="rr-l-btn rr-l-btn-primary" href={dash()}>{tr.lCta} <span aria-hidden>→</span></a>
            <a className="rr-l-btn rr-l-btn-ghost" href={dash({ tab: "method" })}>{tr.navAbout}</a>
          </div>
        </div>
      </section>
    </div>
  );
}

export function HomeView() {
  return <AppShell current="home">{(data) => <Landing data={data} />}</AppShell>;
}
