"use client";
// SearchView.tsx: dashboard tab "Address lookup": search a sample address (or pick a demo scenario) and see
// each rule's result, reason, quoted source and retrieval date for the selected as-of date.
import { useEffect, useRef, useState } from "react";
import { AddressSearch } from "../components/AddressSearch";
import { AddressSummary } from "../components/AddressSummary";
import { ResultsByCategory } from "../components/ResultsByCategory";
import { DemoScenarios } from "../components/DemoScenarios";
import { ResultSummary } from "../components/ResultSummary";
import { Notice } from "../components/Notice";
import { rulesInRecord, useLookups, type Dataset } from "../data";
import { setParam, usePrefs } from "../prefs";
import type { Address } from "../types";

export function SearchBody({ data }: { data: Dataset }) {
  const prefs = usePrefs();
  const { tr, lang } = prefs;
  const asOf = prefs.asOf ?? data.manifest.default_as_of;
  const [addrId, setAddrId] = useState<string | null>(null);
  useEffect(() => setAddrId(new URLSearchParams(window.location.search).get("a")), []);
  const lookups = useLookups(data.manifest, asOf);
  const resultsRef = useRef<HTMLDivElement>(null);

  const address = data.addresses.find((a) => a.address_id === addrId);
  const j = address ? data.jurisdictions[address.address_id] : undefined;
  const rules = rulesInRecord(data.rules, j);
  const items = address && lookups.state === "ready" ? lookups.data?.[address.address_id] : undefined;
  const ruleSet = items ? data.rules.filter((r) => items.some((i) => i.team_rule_id === r.team_rule_id)) : rules;

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
                {lookups.state !== "loading" && <ResultSummary rules={ruleSet} items={items} asOf={asOf} tr={tr} />}
                {ruleSet.length === 0 ? (
                  <Notice tone="neutral" title={tr.noRules} />
                ) : (
                  <ResultsByCategory rules={ruleSet} items={items} allRules={data.rules} asOf={asOf} lang={lang} tr={tr} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
