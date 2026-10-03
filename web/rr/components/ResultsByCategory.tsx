// ResultsByCategory.tsx: groups an address's rules by category; displaced rules nest under the rule that displaces them.
import type { LookupItem, Rule, Lang } from "../types";
import type { Dict } from "../i18n";
import { RuleCard } from "./RuleCard";

export interface ResultsByCategoryProps {
  rules: Rule[];
  /** Lookup items for the selected address/date, or undefined when not precomputed. */
  items?: LookupItem[] | undefined;
  allRules: Rule[];
  lang: Lang;
  tr: Dict;
}

/** Groups rules by category. Rules displaced by a shown rule nest under it instead of repeating. */
export function ResultsByCategory({ rules, items, allRules, lang, tr }: ResultsByCategoryProps) {
  const byId = new Map(allRules.map((r) => [r.team_rule_id, r]));
  const itemById = new Map((items ?? []).map((i) => [i.team_rule_id, i]));
  const shownIds = new Set(rules.map((r) => r.team_rule_id));
  const displacedIds = new Set(rules.flatMap((r) => (r.overrides ?? []).filter((id) => shownIds.has(id))));
  const visible = rules.filter((r) => !displacedIds.has(r.team_rule_id));

  const groups = new Map<string, Rule[]>();
  for (const r of visible) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);

  return (
    <div className="rr-groups">
      <nav aria-label="Categories" className="rr-chips">
        {[...groups.keys()].map((c) => (
          <a key={c} href={`#cat-${c}`} className="rr-chip">{tr.category[c] ?? c} <span>{groups.get(c)!.length}</span></a>
        ))}
      </nav>
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} id={`cat-${cat}`} className="rr-group" aria-labelledby={`cat-h-${cat}`}>
          <h2 id={`cat-h-${cat}`} className="rr-h2">{tr.category[cat] ?? cat}</h2>
          {list.map((r) => (
            <RuleCard
              key={r.team_rule_id}
              rule={r}
              item={itemById.get(r.team_rule_id)}
              displaced={(r.overrides ?? []).map((id) => byId.get(id)).filter((x): x is Rule => !!x)}
              lang={lang}
              tr={tr}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
