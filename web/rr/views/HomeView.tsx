"use client";
// HomeView.tsx: cinematic landing in five beats: a dark hero with the live "address × date" stage, a three-step
// diagram (legal city, building facts, date) with counted stats, the five results, the T1–T5 timeline and a dark
// closing bookend. Every example and number is read from the data files; videos appear only once configured.
import { useEffect, useRef, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { StatusBadge } from "../components/StatusBadge";
import { QrBlock } from "../components/QrBlock";
import { HeroStage } from "../components/HeroStage";
import { LawTimeline } from "../components/LawTimeline";
import { blank, rulesInRecord, type Dataset } from "../data";
import { useLandingConfig } from "../landing";
import { reducedMotion, useCountUp, useHero, useReveal } from "../hero";
import type { VideoConfig } from "../landing";
import { hrefWith, usePrefs } from "../prefs";

// First address whose postal city differs from its legal jurisdiction and has a quoted, sourced rule.
function pickSample(d: Dataset) {
  const a = d.addresses.find((x) => {
    const j = d.jurisdictions[x.address_id];
    return j?.jurisdiction && j.place && j.place !== x.postal_city && rulesInRecord(d.rules, j).some((r) => r.quoted_span && r.source_url);
  });
  if (!a) return null;
  return { a, j: d.jurisdictions[a.address_id]! };
}

function Section({ n, label, id, tone, children }: { n: number; label: string; id?: string; tone?: "white" | "soft"; children: ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id={id} className={`rr-l-sec ${tone ? `rr-l-${tone}` : ""}`} aria-labelledby={`sec-${n}`}>
      <div className="rr-l-wrap rr-rise" ref={ref}>
        <p className="rr-l-n" id={`sec-${n}`}><span>{String(n).padStart(2, "0")}</span> {label}</p>
        {children}
      </div>
    </section>
  );
}

/** Silent section clip: loops while on screen, paused off screen; reduced motion shows the poster only. */
function SectionClip({ video, title }: { video: VideoConfig; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || reducedMotion() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="rr-clip">
      <video ref={ref} muted loop playsInline preload="metadata" poster={video.poster ?? undefined} aria-label={title}>
        <source src={video.src!} type="video/mp4" />
      </video>
    </figure>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { ref, n } = useCountUp(value);
  return (
    <div>
      <dt><span ref={ref} aria-hidden>{n}</span><span className="rr-sr">{value}</span></dt>
      <dd>{label}</dd>
    </div>
  );
}

function Landing({ data }: { data: Dataset }) {
  const prefs = usePrefs();
  const { tr, lang } = prefs;
  const media = useLandingConfig();
  const hero = useHero();
  const s = pickSample(data);
  const resolved = Object.values(data.jurisdictions).filter((j) => j?.jurisdiction).length;
  const quoted = data.rules.filter((r) => r.quoted_span).length;
  const places = new Set(data.rules.map((r) => r.jurisdiction)).size;
  const dates = data.manifest.lookup_dates.length ? data.manifest.lookup_dates : data.manifest.demo_dates;
  const dash = (extra: Record<string, string> = {}) => hrefWith("/dashboard", prefs, extra);
  const fact = (v: string | null | undefined) => (blank(v) ? <span className="rr-missing">{tr.notInRecord}</span> : v);
  // One silent clip per section (docs/LANDING_CLIPS.md), shown once landing.config.json has its file.
  const clip = (id: string, head: ReactNode) => {
    const v = media.videos.find((x) => x.id === id && x.src);
    if (!v) return head;
    return <div className="rr-l-head">{head}<SectionClip video={v} title={v.title[lang] ?? v.title.en} /></div>;
  };

  return (
    <div className="rr-l">
      {/* 1 · Hero: dark stage */}
      <section className="rr-cine" aria-labelledby="hero-h">
        <div className="rr-cine-grid" aria-hidden />
        <div className="rr-l-wrap rr-cine-row">
          <div className="rr-cine-copy">
            <p className="rr-cine-kicker"><span aria-hidden /> {tr.lKicker}</p>
            <h1 id="hero-h" className="rr-cine-title">
              <span className="rr-cine-line">{tr.lTitle}</span>{" "}
              <em className="rr-cine-line">{tr.lTitleEm}</em>
            </h1>
            <p className="rr-cine-body">{tr.lBody}</p>
            <div className="rr-l-ctas">
              <a className="rr-l-btn rr-cine-btn" href={dash()}>{tr.lCta} <span aria-hidden>→</span></a>
              <a className="rr-l-btn rr-cine-ghost" href="#how">{tr.lHow}</a>
            </div>
            <ul className="rr-cine-ticks">
              {tr.heroTicks.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          {hero !== null && <div className="rr-cine-stage">{hero ? <HeroStage hero={hero} tr={tr} /> : <div className="rr-stage-skel" aria-hidden />}</div>}
        </div>
      </section>

      {/* 2 · How it works: three facts, one picture each */}
      <Section n={1} label={tr.lCh[1]!} id="how" tone="white">
        {clip("how-it-works", <h2 className="rr-l-h2">{tr.lHowTitle2} <em>{tr.lHowEm2}</em></h2>)}
        <ol className="rr-steps3">
          <li>
            <div className="rr-step-vis" aria-hidden>
              {s && (
                <p className="rr-vis-city">
                  <s>{s.a.postal_city}</s>
                  <span className="rr-vis-arrow">→</span>
                  <b>{s.j.jurisdiction}</b>
                </p>
              )}
            </div>
            <h3><span className="rr-step3-n">1</span> {tr.lFactors[0]![0]}</h3>
            <p>{tr.lFactors[0]![1]}</p>
            {s && <p className="rr-meta"><span className="rr-id">{s.a.address_id}</span> · {s.a.street_address}</p>}
          </li>
          <li>
            <div className="rr-step-vis" aria-hidden>
              {s && (
                <p className="rr-vis-facts">
                  <span className="rr-vis-chip">{tr.yearBuilt} <b>{fact(s.a.year_built)}</b></span>
                  <span className={`rr-vis-chip ${blank(s.a.units) ? "is-gap" : ""}`}>{tr.units} <b>{fact(s.a.units)}</b></span>
                  {blank(s.a.units) || blank(s.a.year_built) ? <StatusBadge kind="unknown" tr={tr} /> : null}
                </p>
              )}
            </div>
            <h3><span className="rr-step3-n">2</span> {tr.lFactors[1]![0]}</h3>
            <p>{tr.lFactors[1]![1]}</p>
          </li>
          <li>
            <div className="rr-step-vis" aria-hidden>
              <div className="rr-vis-dates">
                {dates.map((d, i) => (
                  <span key={d} style={{ ["--i" as string]: i }}><i /><small className="rr-mono">{d.slice(0, 7)}</small></span>
                ))}
              </div>
            </div>
            <h3><span className="rr-step3-n">3</span> {tr.lFactors[2]![0]}</h3>
            <p>{tr.lFactors[2]![1]}</p>
          </li>
        </ol>
        <dl className="rr-l-stats" aria-label={tr.statsNote}>
          <Stat value={resolved} label={tr.statResolved} />
          <Stat value={quoted} label={tr.statQuoted(places)} />
          <Stat value={dates.length} label={tr.statDates} />
        </dl>
      </Section>

      {/* 3 · Results */}
      <Section n={2} label={tr.lCh[2]!}>
        {clip("five-results", (
          <div className="rr-l-read">
            <h2 className="rr-l-h2">{tr.lResultsTitle} <em>{tr.lResultsEm}</em></h2>
            <p>{tr.lResultsBody}</p>
          </div>
        ))}
        <dl className="rr-states rr-l-states">
          {(["applies", "unknown", "superseded", "not_yet_effective", "pending"] as const).map((key, i) => (
            <div key={key} className={`rr-state rr-rule-${key}`} style={{ ["--i" as string]: i }}>
              <dt><StatusBadge kind={key} tr={tr} /></dt>
              <dd>{tr.stateDesc[key]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 4 · Change over time */}
      <Section n={3} label={tr.lCh[3]!} tone="white">
        {clip("change-over-time", (
          <div className="rr-l-read">
            <h2 className="rr-l-h2">{tr.lTestsTitle} <em>{tr.lTestsEm}</em></h2>
            <p>{tr.lTestsBody}</p>
          </div>
        ))}
        <LawTimeline
          tests={data.changeTests}
          results={data.changeResults}
          total={data.addresses.length}
          href={(id) => dash({ tab: "tests", t: id })}
          tr={tr}
        />
      </Section>

      {/* 5 · Closing: dark bookend */}
      <section className="rr-cine rr-cine-close" aria-labelledby="close-h">
        <div className="rr-cine-grid" aria-hidden />
        <div className="rr-l-wrap rr-cine-close-row">
          <div>
            <p className="rr-cine-kicker"><span aria-hidden /> {tr.lCloseKicker}</p>
            <h2 id="close-h" className="rr-cine-title rr-cine-title-sm">{tr.lCloseTitle} <em>{tr.lCloseEm}</em></h2>
            <div className="rr-l-ctas">
              <a className="rr-l-btn rr-cine-btn" href={dash()}>{tr.lCta} <span aria-hidden>→</span></a>
              <a className="rr-l-btn rr-cine-ghost" href={dash({ tab: "tests" })}>{tr.navChanges}</a>
              <a className="rr-l-btn rr-cine-ghost" href={dash({ tab: "method" })}>{tr.navAbout}</a>
            </div>
          </div>
          {media.demo.url && (
            <div className="rr-cine-qr rr-cine-qr-list">
              {media.downloads.map((item) => (
                <QrBlock key={item.id} label={item.title[lang] ?? item.id} eyebrow={item.eyebrow[lang] ?? undefined} description={item.description[lang]} target={item.url} qr={item.qr} tr={tr} className="rr-cine-download" />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function HomeView() {
  return <AppShell current="home">{(data) => <Landing data={data} />}</AppShell>;
}
