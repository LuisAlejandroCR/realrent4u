"use client";
// SearchView.tsx: dashboard tab "Address lookup": search a sample address and see each rule's result,
// reason, quoted source and retrieval date for the selected as-of date.
import { useEffect, useState } from "react";
import { AddressSearch } from "../components/AddressSearch";
import { AddressSummary } from "../components/AddressSummary";
import { ResultsByCategory } from "../components/ResultsByCategory";
import { Notice } from "../components/Notice";
import { rulesInRecord, useLookups, type Dataset } from "../data";
import { setParam, usePrefs } from "../prefs";

export function SearchBody({ data }: { data: Dataset }) {
  const prefs = usePrefs();
  const { tr, lang } = prefs;
  const asOf = prefs.asOf ?? data.manifest.default_as_of;
  const [addrId, setAddrId] = useState<string | null>(null);
  useEffect(() => setAddrId(new URLSearchParams(window.location.search).get("a")), []);
  const lookups = useLookups(data.manifest, asOf);

  const address = data.addresses.find((a) => a.address_id === addrId);
  const j = address ? data.jurisdictions[address.address_id] : undefined;
  const rules = rulesInRecord(data.rules, j);
  const items = address && lookups.state === "ready" ? lookups.data?.[address.address_id] : undefined;
  const ruleSet = items ? data.rules.filter((r) => items.some((i) => i.team_rule_id === r.team_rule_id)) : rules;

  return (
    <div className="rr-search-layout">
      <aside className="rr-panel">
        <AddressSearch
          addresses={data.addresses}
          tr={tr}
          onSelect={(a) => {
            setAddrId(a.address_id);
            setParam("a", a.address_id);
          }}
        />
      </aside>

      <div className="rr-results">
        {!address && (
          <section className="rr-empty">
            <p className="rr-kicker">{data.addresses.length} · {tr.addressId}</p>
            <h1 className="rr-h1"><em>{tr.emptyTitle}</em></h1>
            <p className="rr-lead">{tr.emptyBody}</p>
          </section>
        )}

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
                {ruleSet.length === 0 ? (
                  <Notice tone="neutral" title={tr.noRules} />
                ) : (
                  <ResultsByCategory rules={ruleSet} items={items} allRules={data.rules} lang={lang} tr={tr} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
