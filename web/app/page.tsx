// page.tsx: address lookup — search the ~500 sample addresses, show the legal jurisdiction and the
// rules with their result for the selected as-of date. The selected address lives in the URL hash.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Providers";
import { ResultBadge, RuleCard } from "@/components/RuleCard";
import { resultDescriptions, resultLabels } from "@/lib/i18n";
import type { Address, LookupItem } from "@/lib/types";

const RESULT_ORDER = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];
const DEFAULT_ID = "A0016";
const MAX_RESULTS = 12;

export default function LookupPage() {
  const { t, data, asOf, lookups, lang } = useApp();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = () => {
      const h = decodeURIComponent(window.location.hash.slice(1)).toUpperCase();
      if (h) setSelectedId(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const addresses = data?.addresses ?? [];
  const byId = useMemo(() => Object.fromEntries(addresses.map((a) => [a.address_id, a])), [addresses]);
  const selected: Address | undefined = byId[selectedId ?? ""] ?? byId[DEFAULT_ID] ?? addresses[0];

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
  };

  if (!data) return null;
  const lookupFile = lookups(asOf);
  const juris = selected ? data.jurisdictions[selected.address_id] : undefined;
  const items: LookupItem[] | undefined = selected && lookupFile ? lookupFile.lookups[selected.address_id] : undefined;
  const sorted = items ? [...items].sort((a, b) => RESULT_ORDER.indexOf(a.result) - RESULT_ORDER.indexOf(b.result)) : undefined;

  // Without lookups, list (not evaluate) the rules on file for the address's state and city.
  const candidates = selected
    ? data.rules.filter(
        (r) => r.status !== "failed" && (r.jurisdiction === selected.state || (juris?.jurisdiction && r.jurisdiction === juris.jurisdiction)),
      )
    : [];

  return (
    <div className="lookup">
      <section className="card search">
        <label htmlFor="q" className="label">
          {t("searchLabel")}
        </label>
        <input
          id="q"
          type="search"
          value={query}
          autoComplete="off"
          placeholder={t("searchPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="search"
        />
        {query.trim() && (
          <ul className="matches" role="listbox">
            {matches.length === 0 && <li className="muted">{t("noMatches")}</li>}
            {matches.slice(0, MAX_RESULTS).map((a) => (
              <li key={a.address_id}>
                <button type="button" onClick={() => choose(a.address_id)}>
                  <code>{a.address_id}</code> {a.street_address}, {a.postal_city}, {a.state} {a.zip}
                </button>
              </li>
            ))}
            {matches.length > MAX_RESULTS && (
              <li className="muted small">
                +{matches.length - MAX_RESULTS} {t("moreMatches")}
              </li>
            )}
          </ul>
        )}
      </section>

      {!selected ? (
        <p className="muted">{t("pickAddress")}</p>
      ) : (
        <>
          <section className="grid2">
            <div className="card">
              <h2>
                {t("address")} <code>{selected.address_id}</code>
              </h2>
              <p className="street">{selected.street_address}</p>
              <dl className="facts">
                <dt>{t("postalCity")}</dt>
                <dd>
                  {selected.postal_city}, {selected.state}
                </dd>
                <dt>{t("zip")}</dt>
                <dd>{selected.zip || <em className="missing">{t("missing")}</em>}</dd>
                <dt>{t("yearBuilt")}</dt>
                <dd>{selected.year_built || <em className="missing">{t("missing")}</em>}</dd>
                <dt>{t("units")}</dt>
                <dd>{selected.units || <em className="missing">{t("missing")}</em>}</dd>
                <dt>{t("use")}</dt>
                <dd>{selected.use_description || selected.use_code || "—"}</dd>
              </dl>
              <p className="muted small">
                {selected.source_dataset} · {t("retrieved")} {selected.retrieved_at.replace("T", " ")}
              </p>
            </div>
            <div className="card">
              <h2>{t("legalJurisdiction")}</h2>
              {juris ? (
                <>
                  <p className="juris" data-testid="jurisdiction">
                    {juris.jurisdiction ?? juris.state}
                  </p>
                  {!juris.jurisdiction && <p className="muted small">{t("outsideScope")}</p>}
                  <dl className="facts">
                    <dt>{t("place")}</dt>
                    <dd>{juris.place ?? "—"}</dd>
                    <dt>{t("county")}</dt>
                    <dd>{juris.county ?? "—"}</dd>
                    <dt>{t("postalCity")}</dt>
                    <dd>{selected.postal_city}</dd>
                    <dt>{t("match")}</dt>
                    <dd>
                      <span className={`badge match-${juris.match}`}>
                        {juris.match === "exact" ? t("matchExact") : juris.match === "fallback" ? t("matchFallback") : t("matchNone")}
                      </span>
                    </dd>
                    <dt>{t("resolvedBy")}</dt>
                    <dd>
                      {juris.source}
                      {juris.source === "fixture" && <span className="badge badge-fixture inline">{t("fixtureBadge")}</span>}
                    </dd>
                  </dl>
                </>
              ) : (
                <>
                  <p className="juris muted">{selected.state}</p>
                  <p className="callout">{t("notResolved")}</p>
                </>
              )}
            </div>
          </section>

          <section>
            <h2 className="section-title">
              {t("rulesAt")} · {t("asOf")} {asOf}
            </h2>
            {lookupFile === undefined ? (
              <p className="muted">{t("loading")}</p>
            ) : lookupFile === null ? (
              <>
                <p className="callout callout-warn" data-testid="no-lookups">
                  <strong>{t("noLookupData")}</strong> {t("noLookupDataHint")}
                </p>
                <h3 className="subsection">{t("candidateRules")}</h3>
                {candidates.length === 0 ? (
                  <p className="muted">{t("noCandidateRules")}</p>
                ) : (
                  candidates.map((r) => <RuleCard key={r.team_rule_id} ruleId={r.team_rule_id} rule={r} />)
                )}
              </>
            ) : !sorted || sorted.length === 0 ? (
              <p className="callout">{t("noRulesApply")}</p>
            ) : (
              sorted.map((it) => <RuleCard key={it.team_rule_id} ruleId={it.team_rule_id} rule={data.rulesById[it.team_rule_id]} item={it} />)
            )}
          </section>

          <section className="legend card">
            <h3>{t("resultLegend")}</h3>
            <ul>
              {RESULT_ORDER.map((r) => (
                <li key={r}>
                  <ResultBadge result={r} /> <span className="small">{resultDescriptions[lang][r]}</span>
                  <span className="sr-only">{resultLabels[lang][r]}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
