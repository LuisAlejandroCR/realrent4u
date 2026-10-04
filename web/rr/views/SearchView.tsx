"use client";
// SearchView.tsx: dashboard tab "Address lookup": search a sample address (or pick a demo scenario) and see
// its approximate location and result mix across dates, then each rule's result, reason, quoted source and
// retrieval date for the selected as-of date.
import { useEffect, useRef, useState } from "react";
import { AddressSearch } from "../components/AddressSearch";
import { AddressSummary } from "../components/AddressSummary";
import { ResultsByCategory } from "../components/ResultsByCategory";
import { DemoScenarios } from "../components/DemoScenarios";
import { ResultSummary } from "../components/ResultSummary";
import { Notice } from "../components/Notice";
import { rulesInRecord, useLookups, type Dataset } from "../data";
import { hrefWith, setParam, usePrefs } from "../prefs";
import type { Address, Jurisdiction } from "../types";
import type { Dict } from "../i18n";
import { DatesChart, MetroMap } from "../components/Charts";
import { metroOf, useAddressDates, useGeo } from "../visual";

/** Approximate location in its metro and the result mix across the precomputed dates. */
function WhereWhen({ address, j, asOf, onDate, onOpen, data, tr }: { address: Address; j?: Jurisdiction; asOf: string; onDate: (d: string) => void; onOpen: (a: Address) => void; data: Dataset; tr: Dict }) {
  const prefs = usePrefs();
  const geo = useGeo();
  const ad = useAddressDates();
  const metro = geo ? metroOf(geo, j?.jurisdiction) : null;
  const rows = ad?.by[address.address_id];
  if (!metro && !rows) return null;
  const street = new Map(data.addresses.map((a) => [a.address_id, a.street_address]));
  const p = geo?.points[address.address_id];
  const dots = metro
    ? Object.entries(geo!.points)
        .filter(([id, q]) => q.m === metro.id && id !== address.address_id)
        .map(([id, q]) => ({ id, x: q.x, y: q.y, tone: "off" as const, tip: `${id} · ${street.get(id) ?? ""}` }))
    : [];
  const place = metro?.places.find((x) => x.jurisdiction === j?.jurisdiction);
  const sel = p ? { id: address.address_id, x: p.x, y: p.y, tone: "on" as const, tip: `${address.address_id} · ${address.street_address}` }
    : place ? { id: address.address_id, x: place.x, y: place.y, tone: "on" as const, tip: j?.jurisdiction ?? "" } : null;
  return (
    <section className="rr-where" aria-label={tr.whereTitle}>
      {metro && (
        <div className="rr-where-map">
          <MetroMap
            metro={metro}
            dots={dots}
            selected={sel}
            title={metro.name}
            // Every other dot is a neighbour: clicking one opens it here, like the mobile map card's Open.
            link={{
              href: (id) => hrefWith("/dashboard", prefs, { tab: "lookup", a: id }),
              onPick: (id) => {
                const next = data.addresses.find((a) => a.address_id === id);
                if (next) onOpen(next);
              },
            }}
            tr={tr}
          />
          <ul className="rr-map-legend">
            <li><i className="rr-mkey is-sel" aria-hidden /> {tr.lgThis}</li>
            <li><i className="rr-mkey is-off" aria-hidden /> {tr.lgOthers}</li>
          </ul>
          <p className="rr-meta">{p ? tr.whereNote : tr.notPlaced} {dots.length > 0 && tr.mapPickHint}</p>
        </div>
      )}
      {rows && ad && <DatesChart order={ad.order} dates={ad.dates} rows={rows} current={asOf} onPick={onDate} tr={tr} />}
    </section>
  );
}

export function SearchBody({ data }: { data: Dataset }) {
  const prefs = usePrefs();
  const { tr, lang } = prefs;
  const asOf = prefs.asOf ?? data.manifest.default_as_of;
  const [addrId, setAddrId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  useEffect(() => setAddrId(new URLSearchParams(window.location.search).get("a")), []);
  const lookups = useLookups(data.manifest, asOf);
  const resultsRef = useRef<HTMLDivElement>(null);

  const address = data.addresses.find((a) => a.address_id === addrId);
  const j = address ? data.jurisdictions[address.address_id] : undefined;
  const rules = rulesInRecord(data.rules, j);
  const items = address && lookups.state === "ready" ? lookups.data?.[address.address_id] : undefined;
  const ruleSet = items ? data.rules.filter((r) => items.some((i) => i.team_rule_id === r.team_rule_id)) : rules;

  // A filter belongs to one address and one date; drop it when either changes.
  useEffect(() => setFilter(null), [addrId, asOf]);

  const select = (a: Address, date?: string) => {
    setAddrId(a.address_id);
    setParam("a", a.address_id);
    if (date) prefs.setAsOf(date);
    // Single-column layout: the panel sits above the results, so bring them into view.
    if (window.matchMedia("(max-width: 860px)").matches) {
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start" }));
    }
  };

  // No address yet: one big search, centred, with the demo scenarios under it. The side panel only
  // appears once an address is open, where it keeps search and scenarios within reach.
  if (!address) {
    return (
      <section className="rr-find">
        <div className="rr-find-head">
          <p className="rr-kicker">{data.addresses.length} · {tr.addressId}</p>
          <h1 className="rr-h1"><em>{tr.emptyTitle}</em></h1>
          <p className="rr-lead">{tr.emptyBody}</p>
          <div className="rr-find-box">
            <AddressSearch addresses={data.addresses} tr={tr} onSelect={(a) => select(a)} />
            <p className="rr-meta rr-find-key"><kbd>/</kbd> {tr.findShortcut}</p>
          </div>
        </div>
        <DemoScenarios data={data} tr={tr} onPick={select} currentId={addrId} asOf={asOf} />
      </section>
    );
  }

  return (
    <div className="rr-search-layout">
      <aside className="rr-panel">
        <AddressSearch addresses={data.addresses} tr={tr} onSelect={(a) => select(a)} />
        <DemoScenarios data={data} tr={tr} onPick={select} compact currentId={addrId} asOf={asOf} />
      </aside>

      <div className="rr-results" ref={resultsRef}>
        {address && (
          <>
            <AddressSummary address={address} jurisdiction={j} asOf={asOf} tr={tr} />
            <WhereWhen address={address} j={j} asOf={asOf} onDate={prefs.setAsOf} onOpen={(a) => select(a)} data={data} tr={tr} />
            <h2 className="rr-section-title">
              {tr.results} <span className="rr-muted">· {tr.asOf} {asOf}</span>
            </h2>
            {!j?.jurisdiction ? (
              <Notice tone="warn" title={tr.unresolved}>{tr.unresolvedBody}</Notice>
            ) : (
              <>
                {lookups.state === "loading" && <p role="status" className="rr-muted">{tr.loading}</p>}
                {lookups.state === "error" && <Notice tone="danger" title={tr.loadError} />}
                {(lookups.state === "none" || (lookups.state === "ready" && !items)) && (
                  <Notice tone="neutral" title={tr.noLookups}>{tr.noLookupsBody}</Notice>
                )}
                {lookups.state !== "loading" && <ResultSummary rules={ruleSet} items={items} asOf={asOf} tr={tr} filter={filter} onFilter={setFilter} />}
                {ruleSet.length === 0 ? (
                  <Notice tone="neutral" title={tr.noRules} />
                ) : (
                  <ResultsByCategory rules={ruleSet} items={items} allRules={data.rules} asOf={asOf} lang={lang} tr={tr} filter={items ? filter : null} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
