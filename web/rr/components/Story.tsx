"use client";
// Story.tsx: the dashboard's exploration layer, ported from the mobile app: the "Start here" roadmap (five steps
// that earn stamps), the toast when one is earned, and the jurisdiction bubble map (size = sample addresses).
import { useEffect, useState } from "react";
import { rulesInRecord, useLookups, type Dataset } from "../data";
import { hrefWith, usePrefs } from "../prefs";
import { STAMPS, clearLast, earn, useStamps, type StampId } from "../stamps";
import { useGeo } from "../visual";
import { TileMap } from "./TileMap";

const GLYPH: Record<StampId, string> = { find: "A", mismatch: "≠", source: "§", time: "◷", scenario: "T" };

export function StampMark({ id, earned }: { id: StampId; earned: boolean }) {
  return <span className={`rr-stampmark${earned ? " is-earned" : ""}`} aria-hidden>{GLYPH[id]}</span>;
}

/** The example the mobile tour uses: Dorchester mail, Boston law. */
const EXAMPLE = "A0065";

export function Roadmap({ onFind }: { onFind: () => void }) {
  const prefs = usePrefs();
  const { tr } = prefs;
  const { stamps } = useStamps();
  const done = stamps.length === STAMPS.length;
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(!done), [done]);
  const next = STAMPS.find((id) => !stamps.includes(id));
  const href: Record<StampId, string | null> = {
    find: null,
    mismatch: hrefWith("/dashboard", prefs, { tab: "lookup", a: EXAMPLE }),
    source: hrefWith("/dashboard", prefs, { tab: "lookup", a: EXAMPLE }),
    time: hrefWith("/dashboard", { ...prefs, asOf: "2027-07-02" }, { tab: "lookup", a: EXAMPLE }),
    scenario: hrefWith("/dashboard", prefs, { tab: "tests", t: "T3" }),
  };
  return (
    <section className="rr-road" aria-labelledby="rr-road-h">
      <button type="button" className="rr-road-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <strong id="rr-road-h">{done ? `✓ ${tr.tourDone}` : tr.tourTitle}</strong>
          {!done && <small>{tr.tourSteps(stamps.length, STAMPS.length)}</small>}
        </span>
        <span className="rr-road-pips" aria-hidden>
          {STAMPS.map((id) => <i key={id} className={stamps.includes(id) ? "is-on" : ""} />)}
        </span>
        <span className={`rr-road-chev${open ? " is-open" : ""}`} aria-hidden>›</span>
      </button>
      {open && (
        <ol className="rr-road-steps">
          {STAMPS.map((id, i) => {
            const got = stamps.includes(id);
            const body = (
              <>
                {got ? <StampMark id={id} earned /> : <span className="rr-road-n" aria-hidden>{i + 1}</span>}
                <span className="rr-road-t">
                  <strong>{tr.stamp[id]}</strong>
                  {!got && <small>{tr.stampHow[id]}</small>}
                </span>
                {id === next && <span className="rr-road-next">{tr.tourNext} →</span>}
              </>
            );
            const cls = `rr-road-step${got ? " is-done" : ""}${id === next ? " is-next" : ""}`;
            return (
              <li key={id} style={{ ["--i" as string]: i }}>
                {href[id] ? (
                  <a className={cls} href={href[id]!}>{body}</a>
                ) : (
                  <button type="button" className={cls} onClick={onFind}>{body}</button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Earns "time" once the as-of date differs from the default (header select, dates chart or a link). */
export function StampWatch({ defaultAsOf }: { defaultAsOf: string }) {
  const { asOf } = usePrefs();
  useEffect(() => {
    if (asOf && asOf !== defaultAsOf) earn("time");
  }, [asOf, defaultAsOf]);
  return null;
}

/** Slides in when a stamp is earned, then leaves on its own. Never blocks clicks. */
export function StampToast() {
  const { tr } = usePrefs();
  const { last, stamps } = useStamps();
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(clearLast, 2800);
    return () => clearTimeout(t);
  }, [last]);
  if (!last) return null;
  return (
    <div className="rr-toast" role="status" aria-live="polite">
      <StampMark id={last} earned />
      <span>
        <small>{tr.stampEarned} · {tr.tourSteps(stamps.length, STAMPS.length)}</small>
        <strong>{stamps.length === STAMPS.length ? tr.tourDone : tr.stamp[last]}</strong>
      </span>
    </div>
  );
}

/** One bubble per legal jurisdiction at the centre of its sample addresses; pick one for its numbers. */
export function JurBubbles({ data, asOf }: { data: Dataset; asOf: string }) {
  const prefs = usePrefs();
  const { tr } = prefs;
  const geo = useGeo();
  const lookups = useLookups(data.manifest, asOf);
  if (!geo) return null;
  const groups = new Map<string, string[]>();
  for (const a of data.addresses) {
    const j = data.jurisdictions[a.address_id]?.jurisdiction;
    if (j) groups.set(j, [...(groups.get(j) ?? []), a.address_id]);
  }
  const max = Math.max(1, ...[...groups.values()].map((v) => v.length));
  const points = [...groups].flatMap(([j, ids]) => {
    const placed = ids.map((id) => geo.points[id]).filter((p) => p?.la != null && p.lo != null);
    if (!placed.length) return [];
    const lat = placed.reduce((s, p) => s + p!.la!, 0) / placed.length;
    const lon = placed.reduce((s, p) => s + p!.lo!, 0) / placed.length;
    const rules = rulesInRecord(data.rules, data.jurisdictions[ids[0]!]).length;
    const items = lookups.state === "ready" ? ids.flatMap((id) => lookups.data?.[id] ?? []) : [];
    const unknown = items.length ? Math.round((items.filter((i) => i.result === "unknown").length / items.length) * 100) : null;
    return [{
      id: ids[0]!,
      lat,
      lon,
      tone: "on" as const,
      r: 7 + 17 * Math.sqrt(ids.length / max),
      title: j,
      sub: [tr.jurAddresses(ids.length), tr.jurRules(rules), unknown != null ? tr.jurUnknown(unknown) : null].filter(Boolean).join(" · "),
    }];
  });
  return (
    <section className="rr-bubbles" aria-labelledby="rr-bub-h">
      <h2 id="rr-bub-h" className="rr-h2">{tr.mapJur}</h2>
      <p className="rr-meta">{tr.mapJurHint}</p>
      <TileMap
        points={points}
        label={`${tr.mapJur}: ${points.map((p) => p.title).join(", ")}`}
        href={(id) => hrefWith("/dashboard", prefs, { tab: "lookup", a: id })}
        openLabel={tr.openExample}
        height={340}
        tr={tr}
      />
    </section>
  );
}
