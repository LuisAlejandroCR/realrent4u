"use client";
// ResultsByOutcome.tsx: an address's rules grouped by what they mean for it, as on mobile: Applies · Can't tell yet ·
// Displaced · Not yet in force · Pending bills. Category is a tag on each card; long groups show 4 + "Show all".
// An optional result filter (from the "at a glance" chips) keeps only the matching cards.
import { useState } from "react";
import type { LookupItem, LookupResult, Rule, Lang } from "../types";
import type { Dict } from "../i18n";
import { RuleCard } from "./RuleCard";

const ORDER: LookupResult[] = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];
const PREVIEW = 4;

export interface ResultsByOutcomeProps {
  rules: Rule[];
  /** Lookup items for the selected address/date, or undefined when not precomputed. */
  items?: LookupItem[] | undefined;
  asOf: string;
  lang: Lang;
  tr: Dict;
  /** A result value, "review" for conflict flags, or null for every rule. */
  filter?: string | null;
}

function Group({ id, title, rules, items, asOf, lang, tr }: { id: string; title: string; rules: Rule[]; items: Map<string, LookupItem>; asOf: string; lang: Lang; tr: Dict }) {
  const [all, setAll] = useState(false);
  const shown = all ? rules : rules.slice(0, PREVIEW);
  return (
    <section className={`rr-group rr-group-${id}`} aria-labelledby={`grp-h-${id}`}>
      <h2 id={`grp-h-${id}`} className="rr-h2 rr-group-h">
        <i className={`rr-seg-key rr-seg-${id}`} aria-hidden /> {title} <span className="rr-group-n">{rules.length}</span>
      </h2>
      {shown.map((r) => (
        <RuleCard key={r.team_rule_id} rule={r} item={items.get(r.team_rule_id)} asOf={asOf} lang={lang} tr={tr} showCategory />
      ))}
      {rules.length > PREVIEW && (
        <button type="button" className="rr-group-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? tr.showFewer : tr.showAllN(rules.length)}
        </button>
      )}
    </section>
  );
}

export function ResultsByOutcome({ rules, items, asOf, lang, tr, filter = null }: ResultsByOutcomeProps) {
  const byId = new Map((items ?? []).map((i) => [i.team_rule_id, i]));
  if (!items) {
    return <div className="rr-groups"><Group id="unevaluated" title={tr.groupOnRecord} rules={rules} items={byId} asOf={asOf} lang={lang} tr={tr} /></div>;
  }
  const keep = (r: Rule) => {
    const i = byId.get(r.team_rule_id);
    return !!i && (!filter || (filter === "review" ? i.conflict_flag : i.result === filter));
  };
  const groups = ORDER.map((k) => [k, rules.filter((r) => keep(r) && byId.get(r.team_rule_id)!.result === k)] as const).filter(([, l]) => l.length);
  return (
    <div className="rr-groups">
      {groups.map(([k, list]) => (
        // Remount when the filter changes so a group starts collapsed again.
        <Group key={`${k}-${filter ?? ""}`} id={k} title={tr.group[k] ?? k} rules={list} items={byId} asOf={asOf} lang={lang} tr={tr} />
      ))}
    </div>
  );
}
