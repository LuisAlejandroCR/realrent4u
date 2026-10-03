// page.tsx: landing + address lookup — hero with search over the ~500 sample addresses and date pills, then
// the address plate and results grouped by category. The selected address lives in the URL hash (#A0016).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/Providers";
import { AddressPlate } from "@/components/AddressPlate";
import { ResultRow, StatusPill } from "@/components/Result";
import { CATEGORY_ORDER, categoryLabels, dictionaries, formatDate, resultDescriptions } from "@/lib/i18n";
import type { Address, LookupItem, Rule } from "@/lib/types";

const RESULT_ORDER = ["applies", "unknown", "not_yet_effective", "pending", "superseded"];
const MAX_RESULTS = 10;
const FALLBACK_DATES = ["2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02"];

interface Entry {
  id: string;
  rule?: Rule;
  item?: LookupItem;
  nested: Entry[];
}

function groupByCategory(entries: Entry[]): [string, Entry[]][] {
  const groups: Record<string, Entry[]> = {};
  for (const e of entries) (groups[e.rule?.category ?? "other"] ??= []).push(e);
  const order = [...CATEGORY_ORDER, ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c))];
  return order.filter((c) => groups[c]).map((c) => [c, groups[c]]);
}

export default function LookupPage() {
  const { t, data, asOf, setAsOf, lookups, lang } = useApp();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fromHash = () => setSelectedId(decodeURIComponent(window.location.hash.slice(1)).toUpperCase() || null);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const addresses = data?.addresses ?? [];
  const byId = useMemo(() => Object.fromEntries(addresses.map((a) => [a.address_id, a])), [addresses]);
  const selected: Address | undefined = selectedId ? byId[selectedId] : undefined;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return addresses.filter((a) => {
      const hay = `${a.address_id} ${a.street_address} ${a.postal_city} ${a.state} ${a.zip} ${data?.jurisdictions[a.address_id]?.jurisdiction ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query, addresses, data]);

  const choose = (id: string) => {
    setSelectedId(id);
    setQuery("");
    history.replaceState(null, "", `#${id}`);
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ block: "start" }));
  };

  if (!data) return null;
  const dates = data.manifest.demo_dates?.length ? data.manifest.demo_dates : FALLBACK_DATES;
  const lookupFile = lookups(asOf);
  const juris = selected ? data.jurisdictions[selected.address_id] : undefined;
  const items: LookupItem[] | undefined = selected && lookupFile ? lookupFile.lookups[selected.address_id] : undefined;

  // Evaluated entries: superseded rules nest under the rule that displaces them, when it is present.
  let entries: Entry[] = [];
  if (items) {
    const all: Entry[] = [...items]
      .sort((a, b) => RESULT_ORDER.indexOf(a.result) - RESULT_ORDER.indexOf(b.result))
      .map((it) => ({ id: it.team_rule_id, item: it, rule: data.rulesById[it.team_rule_id], nested: [] }));
    for (const e of all) {
      if (e.item?.result !== "superseded") continue;
      const host = all.find((h) => h !== e && h.item?.result !== "superseded" && h.rule?.overrides?.includes(e.id));
      if (host) host.nested.push(e);
    }
    const nestedIds = new Set(all.flatMap((h) => h.nested.map((n) => n.id)));
    entries = all.filter((e) => !nestedIds.has(e.id));
  }
  // Without lookups: list (not evaluate) the rules on file for the address's state and city.
  const candidates: Entry[] = selected
    ? data.rules
        .filter((r) => r.status !== "failed" && (r.jurisdiction === selected.state || (!!juris?.jurisdiction && r.jurisdiction === juris.jurisdiction)))
        .map((r) => ({ id: r.team_rule_id, rule: r, nested: [] }))
    : [];

  const renderGroups = (list: Entry[]) => {
    let i = 0;
    return groupByCategory(list).map(([cat, es]) => (
      <section key={cat} className="cat-group">
        <h3 className="eyebrow">{categoryLabels[lang][cat] ?? cat.replaceAll("_", " ")}</h3>
        {es.map((e) => (
          <ResultRow key={e.id} ruleId={e.id} rule={e.rule} item={e.item} index={i++}>
            {e.nested.length > 0 && (
              <details className="displaced">
                <summary>
                  {t("displacedRules")} ({e.nested.length})
                </summary>
                {e.nested.map((n) => (
                  <ResultRow key={n.id} ruleId={n.id} rule={n.rule} item={n.item} />
                ))}
              </details>
            )}
          </ResultRow>
        ))}
      </section>
    ));
  };

  return (
    <div>
      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1>
            {t("heroBefore")}
            <em className="accent">{t("heroAccent")}</em>
            {t("heroAfter")}
          </h1>
          <p className="lead">{t("heroLead")}</p>
          <label htmlFor="q" className="sr-only">
            {t("searchLabel")}
          </label>
          <div className="search">
            <input
              id="q"
              ref={searchRef}
              type="search"
              value={query}
              autoComplete="off"
              placeholder={t("searchPlaceholder")}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) choose(matches[0].address_id);
              }}
              data-testid="search"
            />
            {query.trim() && (
              <ul className="matches" role="listbox">
                {matches.length === 0 && <li className="muted pad">{t("noMatches")}</li>}
                {matches.slice(0, MAX_RESULTS).map((a) => (
                  <li key={a.address_id}>
                    <button type="button" onClick={() => choose(a.address_id)}>
                      <code>{a.address_id}</code>
                      <span>
                        {a.street_address}, {a.postal_city}, {a.state} {a.zip}
                      </span>
                    </button>
                  </li>
                ))}
                {matches.length > MAX_RESULTS && (
                  <li className="muted small pad">
                    +{matches.length - MAX_RESULTS} {t("moreMatches")}
                  </li>
                )}
              </ul>
            )}
          </div>
          <p className="small muted">{t("searchKeys")}</p>
          <div className="date-pills" role="group" aria-label={t("asOfDate")}>
            <span className="eyebrow">{t("asOfDate")}</span>
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                className={d === asOf ? "pill on" : "pill"}
                aria-pressed={d === asOf}
                onClick={() => setAsOf(d)}
                data-testid="date-pill"
                title={data.manifest.lookup_dates.includes(d) ? undefined : t("noDataShort")}
              >
                {formatDate(d, lang)}
                {!data.manifest.lookup_dates.includes(d) && <span className="pill-note"> · {t("noDataShort")}</span>}
              </button>
            ))}
          </div>
        </div>
        <aside className="card carries">
          <h2>{t("carriesTitle")}</h2>
          <ul>
            {dictionaries[lang].carries.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="legend">
            {["applies", "unknown", "superseded", "not_yet_effective", "pending"].map((r) => (
              <div key={r} title={resultDescriptions[lang][r]}>
                <StatusPill result={r} />
              </div>
            ))}
          </div>
        </aside>
      </section>

      {selected && (
        <section id="results" className="address-view">
          <AddressPlate address={selected} juris={juris} />
          <h2 className="section-title">
            {t("rulesAt")} <span className="muted">· {t("asOf")} {formatDate(asOf, lang)}</span>
          </h2>
          {lookupFile === undefined ? (
            <p className="muted">{t("loading")}</p>
          ) : lookupFile === null ? (
            <>
              <p className="notice notice-warn" data-testid="no-lookups">
                <strong>{t("noLookupData")}</strong> {t("noLookupDataHint")}
              </p>
              {candidates.length === 0 ? <p className="muted">{t("noCandidateRules")}</p> : renderGroups(candidates)}
            </>
          ) : entries.length === 0 ? (
            <p className="notice">{t("noRulesApply")}</p>
          ) : (
            renderGroups(entries)
          )}
        </section>
      )}
    </div>
  );
}
