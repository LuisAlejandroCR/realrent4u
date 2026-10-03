// AddressView.tsx: body of the address page /a/<id>/ — plate, building facts, as-of date pills, then results grouped
// by category. Superseded rules nest (collapsed) under the local rule that displaces them; without lookups, rules are listed only.
"use client";

import Link from "next/link";
import { useApp } from "./Providers";
import { AddressPlate } from "./AddressPlate";
import { DatePills } from "./DatePills";
import { ResultRow } from "./Result";
import { CATEGORY_ORDER, categoryLabels, formatDate } from "@/lib/i18n";
import type { LookupItem, Rule } from "@/lib/types";

const RESULT_ORDER = ["applies", "unknown", "not_yet_effective", "pending", "superseded"];

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

export function AddressView({ id }: { id: string }) {
  const { t, data, asOf, lookups, lang, linkTo } = useApp();
  if (!data) return null;

  const back = (
    <p className="back">
      <Link href={linkTo("/")} className="back-link" data-testid="back-to-search">
        <span aria-hidden="true">←</span> {t("backToSearch")}
      </Link>
    </p>
  );
  const selected = data.addresses.find((a) => a.address_id === id);
  if (!selected) {
    return (
      <div className="column">
        {back}
        <p className="notice notice-warn" data-testid="address-not-found">
          {t("addressNotFound")} <code>{id}</code>
        </p>
      </div>
    );
  }

  const lookupFile = lookups(asOf);
  const juris = data.jurisdictions[selected.address_id];
  const items: LookupItem[] | undefined = lookupFile ? lookupFile.lookups[selected.address_id] : undefined;

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
  const candidates: Entry[] = data.rules
    .filter((r) => r.status !== "failed" && (r.jurisdiction === selected.state || (!!juris?.jurisdiction && r.jurisdiction === juris.jurisdiction)))
    .map((r) => ({ id: r.team_rule_id, rule: r, nested: [] }));

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
    <div id="results" className="address-view" data-testid="address-view">
      {back}
      <h1 className="sr-only">
        {selected.address_id} · {selected.street_address}, {selected.postal_city}, {selected.state}
      </h1>
      <AddressPlate address={selected} juris={juris} />
      <DatePills />
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
    </div>
  );
}
