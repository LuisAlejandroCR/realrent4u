"use client";
// HeroStage.tsx: the landing's live "address × date" stage. Three real sample addresses (hero.json) replayed
// across every precomputed date: the result mix bar, the rules that change and one quoted source. It plays
// on its own (pause button; off with reduced motion) and any click hands control to the visitor.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dict } from "../i18n";
import type { LookupResult } from "../types";
import { reducedMotion, type HeroAddress, type HeroData, type HeroItem } from "../hero";
import { hrefWith, usePrefs } from "../prefs";
import { StatusBadge } from "./StatusBadge";

const ORDER: LookupResult[] = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];
const STEP_MS = 2600;
const ROWS = 3;

/** Rows kept in a fixed order per address so badges flip in place: rules that change first, then flagged,
 *  then anything that is not a plain "applies", local before state. */
function rowOrder(a: HeroAddress, rules: HeroData["rules"]): string[] {
  const dates = Object.keys(a.results);
  const ids = Array.from(new Set(dates.flatMap((d) => a.results[d]!.map((i) => i.id))));
  const at = (id: string, d: string) => a.results[d]!.find((i) => i.id === id);
  const score = (id: string) => {
    const seen = new Set(dates.map((d) => at(id, d)?.r ?? "-"));
    const flagged = dates.some((d) => at(id, d)?.c);
    const odd = dates.some((d) => (at(id, d)?.r ?? "applies") !== "applies");
    return (seen.size > 1 ? 8 : 0) + (flagged ? 4 : 0) + (odd ? 2 : 0) + (rules[id]?.level !== "state" ? 1 : 0);
  };
  return ids.sort((x, y) => score(y) - score(x)).slice(0, ROWS);
}

function host(u: string) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export function HeroStage({ hero, tr }: { hero: HeroData; tr: Dict }) {
  const prefs = usePrefs();
  const dates = hero.dates;
  const startDate = Math.max(0, dates.indexOf(prefs.asOf ?? ""));
  const [ai, setAi] = useState(0);
  const [di, setDi] = useState(prefs.asOf ? startDate : 0);
  const [playing, setPlaying] = useState(false);
  const [hold, setHold] = useState(false);

  // Autoplay only when motion is welcome; the visitor can pause it at any time.
  useEffect(() => setPlaying(!reducedMotion()), []);
  // The page-wide As of selector moves the stage too, and hands control to the visitor.
  useEffect(() => {
    const i = dates.indexOf(prefs.asOf ?? "");
    if (i >= 0 && i !== di) {
      setDi(i);
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.asOf]);
  useEffect(() => {
    if (!playing || hold) return;
    const t = setTimeout(() => {
      if (di + 1 < dates.length) setDi(di + 1);
      else {
        setDi(0);
        setAi((ai + 1) % hero.addresses.length);
      }
    }, di + 1 < dates.length ? STEP_MS : STEP_MS + 900);
    return () => clearTimeout(t);
  }, [playing, hold, di, ai, dates.length, hero.addresses.length]);

  const a = hero.addresses[ai]!;
  const date = dates[di]!;
  const items = a.results[date] ?? [];
  const rows = useMemo(() => rowOrder(a, hero.rules), [a, hero.rules]);
  const counts = new Map<LookupResult, number>();
  for (const i of items) counts.set(i.r, (counts.get(i.r) ?? 0) + 1);
  const flags = items.filter((i) => i.c).length;

  // Which rows flipped since the previous frame of the same address (drives the flash). Memoised per frame
  // so a hover re-render does not restart or cut the animation.
  const key = a.address_id;
  const last = useRef<{ key: string; items: HeroItem[] } | null>(null);
  const flips = useMemo(() => {
    const b = last.current?.key === key ? last.current.items : null;
    const r = (list: HeroItem[], id: string) => list.find((i) => i.id === id)?.r ?? "-";
    return new Set(b ? rows.filter((id) => r(b, id) !== r(items, id)) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, date]);
  useEffect(() => {
    last.current = { key, items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, date]);
  const flipped = (id: string) => flips.has(id);

  const pickAddress = (i: number) => {
    setAi(i);
    setPlaying(false);
  };
  const pickDate = (i: number) => {
    setDi(i);
    setPlaying(false);
    prefs.setAsOf(dates[i]!);
  };
  const postalDiffers = !!a.place && a.place.toLowerCase() !== a.postal_city.toLowerCase();
  const fact = (v: string | null) => (v ? v : <span className="rr-stage-missing">{tr.notInRecord}</span>);
  const summary = ORDER.filter((k) => counts.get(k)).map((k) => `${counts.get(k)} ${tr.result[k]}`).join(", ");

  return (
    <div
      className="rr-stage"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="rr-stage-tabs" role="group" aria-label={tr.stageAddresses}>
        {hero.addresses.map((x, i) => (
          <button key={x.address_id} type="button" aria-pressed={i === ai} onClick={() => pickAddress(i)}>
            <span className="rr-stage-tab-k">{tr.stageKind[x.kind]}</span>
            <span className="rr-stage-tab-s">{x.jurisdiction}</span>
          </button>
        ))}
      </div>

      <article className="rr-stage-card" aria-label={`${a.street}, ${a.jurisdiction} · ${tr.asOf} ${date}`}>
        <header className="rr-plate" key={key}>
          <p className="rr-plate-id"><span className="rr-mono">{a.address_id}</span> · <span className="rr-stage-live"><span aria-hidden className={playing && !hold ? "is-on" : ""} />{tr.stageLive}</span></p>
          <p className="rr-plate-street">{a.street}</p>
          <p className="rr-plate-city">
            {postalDiffers ? (
              <>
                <s className="rr-plate-postal" aria-label={`${tr.postalCity} ${a.postal_city}`}>{a.postal_city}</s>
                <span aria-hidden className="rr-plate-arrow">→</span>
                <strong className="rr-plate-legal">{a.jurisdiction}</strong>
              </>
            ) : (
              <strong className="rr-plate-legal">{a.jurisdiction}</strong>
            )}
          </p>
          <p className="rr-plate-facts">
            <span>{tr.yearBuilt} {fact(a.year_built)}</span>
            <span>{tr.units} {fact(a.units)}</span>
          </p>
        </header>

        <div className="rr-stage-mix">
          <p className="rr-stage-count">
            <strong>{items.length}</strong> {tr.stageReach(items.length)}
            {flags > 0 && <span className="rr-stage-flag"><span aria-hidden>▲</span> {flags} {tr.needsReview}</span>}
          </p>
          <div className="rr-stage-bar" role="img" aria-label={summary}>
            {ORDER.map((k) => (
              <span key={k} className={`rr-seg rr-seg-${k}`} style={{ width: `${((counts.get(k) ?? 0) / Math.max(1, items.length)) * 100}%` }} />
            ))}
          </div>
          <ul className="rr-stage-legend" aria-hidden>
            {ORDER.filter((k) => counts.get(k)).map((k) => (
              <li key={k}><i className={`rr-seg-key rr-seg-${k}`} /> {tr.result[k]} <b>{counts.get(k)}</b></li>
            ))}
          </ul>
        </div>

        <ul className="rr-stage-rows" aria-live="polite">
          {rows.map((id) => {
            const it = items.find((i) => i.id === id);
            return (
              <li key={`${id}-${flipped(id) ? date : "s"}`} className={flipped(id) ? "is-flip" : ""}>
                {it ? <StatusBadge kind={it.r} tr={tr} /> : <span className="rr-stage-none">{tr.stageNotReached}</span>}
                <span className="rr-stage-title">{hero.rules[id]?.title ?? id}</span>
                {it?.c && <span className="rr-stage-flag" title={tr.needsReview}><span aria-hidden>▲</span><span className="rr-sr">{tr.needsReview}</span></span>}
              </li>
            );
          })}
        </ul>

        {a.evidence && (
          <figure className="rr-stage-ev">
            <blockquote>“{a.evidence.quote}”</blockquote>
            <figcaption>
              {hero.rules[a.evidence.id]?.title ?? a.evidence.citation} · <span className="rr-mono">{host(a.evidence.url)}</span>
              {a.evidence.retrieved_at && <> · {tr.retrieved} {a.evidence.retrieved_at.slice(0, 10)}</>}
            </figcaption>
          </figure>
        )}

        <footer className="rr-stage-foot">
          <span>{tr.notAdvice} · {tr.asOf} <time dateTime={date}>{date}</time></span>
          <a className="rr-link" href={hrefWith("/dashboard", { lang: prefs.lang, asOf: date }, { tab: "lookup", a: a.address_id })}>
            {tr.openAddress} <span aria-hidden>→</span>
          </a>
        </footer>
      </article>

      <div className="rr-scrub-row">
        <button type="button" className="rr-stage-play" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
          <span aria-hidden className={playing ? "is-pause" : "is-play"} />
          {playing ? tr.stagePause : tr.stagePlay}
        </button>
      <div className="rr-scrub" role="group" aria-label={tr.asOf}>
        <span className="rr-scrub-line" aria-hidden><span style={{ width: `${(di / Math.max(1, dates.length - 1)) * 100}%` }} /></span>
        {dates.map((d, i) => (
          <button key={d} type="button" aria-pressed={i === di} className={i < di ? "is-past" : ""} onClick={() => pickDate(i)}>
            <span className="rr-scrub-dot" aria-hidden />
            <span className="rr-mono">{d}</span>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}
