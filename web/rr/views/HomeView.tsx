"use client";
// HomeView.tsx: landing page (Stamp & Marigold, light only): hero, the postal-vs-legal problem, how it
// works with videos and QR, the five results, T1–T5 over time and a closing call to the dashboard.
// Every example and number is read from the data files; missing media and links show as pending.
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { StatusBadge } from "../components/StatusBadge";
import { QrBlock } from "../components/QrBlock";
import { VideoCard } from "../components/VideoCard";
import { blank, rulesInRecord, useLookups, type Dataset } from "../data";
import { useLandingConfig } from "../landing";
import { hrefWith, usePrefs } from "../prefs";

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

function Section({ n, label, id, tone, children }: { n: number; label: string; id?: string; tone?: "white" | "soft"; children: ReactNode }) {
  return (
    <section id={id} className={`rr-l-sec ${tone ? `rr-l-${tone}` : ""}`} aria-labelledby={`sec-${n}`}>
      <div className="rr-l-wrap">
        <p className="rr-l-n" id={`sec-${n}`}><span>{String(n).padStart(2, "0")}</span> {label}</p>
        {children}
      </div>
    </section>
  );
}

function Landing({ data }: { data: Dataset }) {
  const prefs = usePrefs();
  const { tr, lang } = prefs;
  const media = useLandingConfig();
  const asOf = prefs.asOf ?? data.manifest.default_as_of;
  const lookups = useLookups(data.manifest, asOf);
  const s = pickSample(data);
  const items = s && lookups.state === "ready" ? lookups.data?.[s.a.address_id] : undefined;
  const byId = new Map(data.rules.map((r) => [r.team_rule_id, r]));
  const resolved = Object.values(data.jurisdictions).filter((j) => j?.jurisdiction).length;
  const quoted = data.rules.filter((r) => r.quoted_span).length;
  const places = new Set(data.rules.map((r) => r.jurisdiction)).size;
  const dates = data.manifest.lookup_dates.length ? data.manifest.lookup_dates : data.manifest.demo_dates;
  const dash = (extra: Record<string, string> = {}) => hrefWith("/dashboard", prefs, extra);
  const [featured, ...more] = media.videos;
  const fact = (v: string | null | undefined) => (blank(v) ? <span className="rr-missing">{tr.notInRecord}</span> : v);

  return (
    <div className="rr-l">
      {/* 1 · Hero */}
      <section className="rr-l-hero" aria-labelledby="hero-h">
        <div className="rr-l-wrap rr-l-hero-grid">
          <div className="rr-l-hero-copy">
            <p className="rr-l-kicker">{tr.lKicker}</p>
            <h1 id="hero-h" className="rr-l-title">{tr.lTitle} <em>{tr.lTitleEm}</em></h1>
            <p className="rr-l-body">{tr.lBody}</p>
            <div className="rr-l-ctas">
              <a className="rr-l-btn rr-l-btn-primary" href={dash()}>{tr.lCta} <span aria-hidden>→</span></a>
              <a className="rr-l-btn rr-l-btn-ghost" href="#how">{tr.lHow}</a>
            </div>
          </div>
          {s && (
            <aside className="rr-l-sample" aria-label={tr.exampleFromData}>
              <p className="rr-label">{tr.exampleFromData}</p>
              <p className="rr-l-sample-addr">{s.a.street_address}</p>
              <p className="rr-l-sample-j">
                <span className="rr-id">{s.a.address_id}</span> · {tr.postalCity} {s.a.postal_city} <span aria-hidden>→</span>{" "}
                {tr.legalJurisdiction} <strong>{s.j.jurisdiction}</strong>
              </p>
              {items && items.length > 0 ? (
                <>
                  <p className="rr-l-sample-h">{tr.sampleResultsTitle(asOf)}</p>
                  <ul>
                    {items.slice(0, 3).map((i) => (
                      <li key={i.team_rule_id}>
                        <StatusBadge kind={i.result} tr={tr} />
                        <span>{byId.get(i.team_rule_id)?.title ?? i.team_rule_id}</span>
                      </li>
                    ))}
                  </ul>
                  <a className="rr-link" href={dash({ tab: "lookup", a: s.a.address_id })}>{tr.openAddress} →</a>
                </>
              ) : (
                <p className="rr-meta">{tr.sampleNoResults(asOf)}</p>
              )}
            </aside>
          )}
        </div>
      </section>

      {/* 2 · Problem */}
      <Section n={2} label={tr.lCh[0]!} tone="white">
        <div className="rr-l-split">
          <div className="rr-l-read">
            <h2 className="rr-l-h2">{tr.lProblemTitle} <em>{tr.lProblemEm}</em></h2>
            <p>{tr.lProblemP1}</p>
            <p>{tr.lProblemP2}</p>
          </div>
          {s && (
            <figure className="rr-l-example">
              <figcaption className="rr-label">{tr.exampleFromData}</figcaption>
              <dl>
                <div><dt>{tr.addressId}</dt><dd className="rr-mono">{s.a.address_id} · {s.a.street_address}</dd></div>
                <div><dt>{tr.postalCity}</dt><dd>{s.a.postal_city}, {s.a.state} {s.a.zip}</dd></div>
                <div><dt>{tr.legalJurisdiction}</dt><dd><mark>{s.j.jurisdiction}</mark></dd></div>
                <div><dt>{tr.yearBuilt}</dt><dd>{fact(s.a.year_built)}</dd></div>
                <div><dt>{tr.units}</dt><dd>{fact(s.a.units)}</dd></div>
              </dl>
            </figure>
          )}
        </div>
        <ul className="rr-l-factors">
          {tr.lFactors.map(([t, b]) => (
            <li key={t}><h3>{t}</h3><p>{b}</p></li>
          ))}
        </ul>
        <dl className="rr-l-stats" aria-label={tr.statsNote}>
          <div><dt>{resolved}</dt><dd>{tr.statResolved}</dd></div>
          <div><dt>{quoted}</dt><dd>{tr.statQuoted(places)}</dd></div>
          <div><dt>{dates.length}</dt><dd>{tr.statDates}</dd></div>
        </dl>
      </Section>

      {/* 3 · How it works */}
      <Section n={3} label={tr.lCh[1]!} id="how" tone="soft">
        <h2 className="rr-l-h2">{tr.lHowTitle} <em>{tr.lHowEm}</em></h2>
        <ol className="rr-l-steps">
          {tr.lSteps.map(([t, b], i) => (
            <li key={t}>
              <span className="rr-l-step-n">{i + 1}</span>
              <h3>{t}</h3>
              <p>{b}</p>
              {s && (
                <p className="rr-l-proof">
                  {i === 0 && <>{s.a.postal_city} → <strong>{s.j.jurisdiction}</strong></>}
                  {i === 1 && <>{s.j.jurisdiction}: {tr.rulesOnRecord(s.rules.filter((r) => r.level === "state").length, s.rules.filter((r) => r.level !== "state").length)}</>}
                  {i === 2 && <>“{s.rule.quoted_span!.slice(0, 96)}{s.rule.quoted_span!.length > 96 ? "…" : ""}” <span className="rr-muted">— {s.rule.citation}</span></>}
                </p>
              )}
            </li>
          ))}
        </ol>

        <div className="rr-l-media">
          <div className="rr-l-media-head">
            <h3 className="rr-l-h3">{tr.lVideosTitle}</h3>
            <p className="rr-l-read-p">{tr.lVideosBody}</p>
          </div>
          <div className="rr-l-media-grid">
            {featured && <VideoCard video={featured} lang={lang} tr={tr} featured />}
            <div className="rr-l-media-side">
              {more.map((v) => <VideoCard key={v.id} video={v} lang={lang} tr={tr} />)}
              <div className="rr-l-demo">
                <h3 className="rr-video-title">{tr.openDemo}</h3>
                <QrBlock label={tr.openDemo} target={media.demo.url} qr={media.demo.qr} tr={tr} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 4 · Results */}
      <Section n={4} label={tr.lCh[2]!}>
        <div className="rr-l-read">
          <h2 className="rr-l-h2">{tr.lResultsTitle} <em>{tr.lResultsEm}</em></h2>
          <p>{tr.lResultsBody}</p>
        </div>
        <dl className="rr-states rr-l-states">
          {(["applies", "unknown", "superseded", "not_yet_effective", "pending"] as const).map((key) => (
            <div key={key} className={`rr-state rr-rule-${key}`}>
              <dt><StatusBadge kind={key} tr={tr} /> <code className="rr-mono rr-muted">{key}</code></dt>
              <dd>{tr.stateDesc[key]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 5 · Change over time */}
      <Section n={5} label={tr.lCh[3]!} tone="white">
        <div className="rr-l-read">
          <h2 className="rr-l-h2">{tr.lTestsTitle} <em>{tr.lTestsEm}</em></h2>
          <p>{tr.lTestsBody}</p>
          <p className="rr-meta">{tr.globalAsOfNote}</p>
        </div>
        <ol className="rr-l-tests">
          {data.changeTests.map((t) => {
            const r = data.changeResults.find((x) => x.test_id === t.test_id);
            const n = r?.affected_address_ids?.length ?? 0;
            return (
              <li key={t.test_id}>
                <span className="rr-test-id">{t.test_id}</span>
                <span className="rr-l-tests-main">
                  <strong>{t.title}</strong>
                  <span className="rr-meta"><span className="rr-scenario-label">{tr.scenarioDates}:</span> <span className="rr-mono">{t.as_of_before ? `${t.as_of_before} → ${t.as_of_after}` : t.as_of}</span></span>
                </span>
                <span className={`rr-l-avail ${r ? (n ? "is-yes" : "is-zero") : "is-no"}`}>
                  {!r ? tr.resNotAvailable : n ? tr.nAffected(n) : tr.confirmedEmpty}
                </span>
                <a className="rr-l-run" href={dash({ tab: "tests", t: t.test_id })}>{r ? tr.runInDash : tr.openInDash}</a>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* 6 · Closing */}
      <section className="rr-l-sec" aria-labelledby="close-h">
        <div className="rr-l-wrap">
          <div className="rr-l-close">
            <p className="rr-l-kicker">{tr.lCloseKicker}</p>
            <h2 id="close-h" className="rr-l-h2">{tr.lCloseTitle} <em>{tr.lCloseEm}</em></h2>
            <div className="rr-l-ctas">
              <a className="rr-l-btn rr-l-btn-primary" href={dash()}>{tr.lCta} <span aria-hidden>→</span></a>
            </div>
            <p className="rr-l-close-links">
              <a className="rr-link" href={dash({ tab: "tests" })}>{tr.navChanges}</a>
              <a className="rr-link" href={dash({ tab: "method" })}>{tr.navAbout}</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function HomeView() {
  return <AppShell current="home">{(data) => <Landing data={data} />}</AppShell>;
}
