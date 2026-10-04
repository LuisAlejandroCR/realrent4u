// data.ts: loads the bundled JSON from assets/data (incl. approximate geo points), unpacks lookups, adapts
// changes.json and reads the organizer→pipeline rule matches from its notes; no evaluation.
import type { Address, ChangeResult, ChangeTest, Jurisdiction, LookupItem, Manifest, Rule } from "./types";

/**
 * Same static JSON the web dashboard reads from web/public/data, bundled into the app.
 * scripts/build-data.mjs writes assets/data/ (runs before start/web/typecheck; see README).
 * No network calls, no backend, no legal evaluation happens in the app.
 */
import manifestJson from "../assets/data/manifest.json";
import addressesJson from "../assets/data/addresses.json";
import rulesJson from "../assets/data/rules.json";
import jurisdictionsJson from "../assets/data/jurisdictions.json";
import changeTestsJson from "../assets/data/change_tests.json";
import changesJson from "../assets/data/changes.json";
import lookupsJson from "../assets/data/lookups.json";
import geoJson from "../assets/data/geo.json";

export interface Dataset {
  manifest: Manifest;
  addresses: Address[];
  rules: Rule[];
  jurisdictions: Record<string, Jurisdiction>;
  changeTests: ChangeTest[];
  /** null = changes file missing or empty → "results not available". [] is never inferred. */
  changeResults: ChangeResult[] | null;
  /** Precomputed lookups keyed by as_of → address_id. Empty when the pipeline has not produced any. */
  lookups: Record<string, Record<string, LookupItem[]>>;
  /** Approximate map point per address: [lat, lon] rounded to ~100 m; "area" = jurisdiction centroid. */
  geo: Record<string, [number, number, "street" | "area"]>;
}

export function loadDataset(): Dataset {
  const rules = rulesJson as unknown as { rules: Rule[] } | Rule[];
  const changeList = adaptChanges(changesJson as unknown as Record<string, RawChange>);
  return {
    manifest: manifestJson as unknown as Manifest,
    addresses: addressesJson as unknown as Address[],
    rules: Array.isArray(rules) ? rules : rules.rules,
    jurisdictions: jurisdictionsJson as unknown as Record<string, Jurisdiction>,
    changeTests: changeTestsJson as unknown as ChangeTest[],
    changeResults: changeList && changeList.length > 0 ? changeList : null,
    lookups: unpackLookups(lookupsJson as unknown as PackedLookups),
    geo: (geoJson ?? {}) as unknown as Dataset["geo"],
  };
}

interface RawChange {
  affected_address_ids?: string[];
  conflict_flag_address_ids?: string[];
  notes?: string;
}

/** changes.json is keyed by test id (realrent.changes); a test without an affected list stays absent. */
function adaptChanges(raw: Record<string, RawChange> | null): ChangeResult[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([, v]) => v && Array.isArray(v.affected_address_ids))
    .map(([test_id, v]) => ({ test_id, affected_address_ids: v.affected_address_ids ?? [], conflict_address_ids: v.conflict_flag_address_ids ?? [], notes: v.notes ?? "" }));
}

/** lookups.json from build-data.mjs: item = [rule id, result, conflict 0/1, reason, explanation idx, explanation_es idx]. */
type PackedItem = [string, LookupItem["result"], number, string | null, number, number];
interface PackedLookups {
  strings: string[];
  dates: Record<string, Record<string, PackedItem[]>>;
}

function unpackLookups(p: PackedLookups | null): Dataset["lookups"] {
  const out: Dataset["lookups"] = {};
  for (const [asOf, byAddress] of Object.entries(p?.dates ?? {})) {
    out[asOf] = {};
    for (const [id, items] of Object.entries(byAddress)) {
      out[asOf][id] = items.map(([team_rule_id, result, conflict, reason, en, es]) => ({
        team_rule_id,
        result,
        conflict_flag: conflict === 1,
        reason: reason ?? undefined,
        explanation: p!.strings[en] ?? "",
        explanation_es: p!.strings[es] ?? undefined,
      }));
    }
  }
  return out;
}

export const blank = (v: string | null | undefined) => v == null || String(v).trim() === "";

export function searchAddresses(list: Address[], q: string, limit = 30): Address[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return list
    .filter((a) => `${a.address_id} ${a.street_address} ${a.postal_city} ${a.state} ${a.zip}`.toLowerCase().includes(s))
    .slice(0, limit);
}

/** Rules in the record for a resolved jurisdiction: exact local + statewide. Pure filter — same as web. */
export function rulesInRecord(rules: Rule[], j: Jurisdiction | undefined): Rule[] {
  if (!j?.jurisdiction) return [];
  const state = j.state ?? j.jurisdiction.split(", ").pop();
  return rules.filter((r) => r.jurisdiction === j.jurisdiction || (r.level === "state" && r.jurisdiction === state));
}

export function allDates(m: Manifest): string[] {
  return Array.from(new Set([...m.demo_dates, ...m.lookup_dates])).sort();
}

export function groupByCategory(rules: Rule[]): [string, Rule[]][] {
  const map = new Map<string, Rule[]>();
  rules.forEach((r) => map.set(r.category, [...(map.get(r.category) ?? []), r]));
  return [...map.entries()];
}

/**
 * Change tests name rules by organizer id (CA-ALG-01); the pipeline records the match in changes.json notes
 * ("Matched: CA-ALG-01 -> r-D022-01 (...)"). Returns organizer id → team_rule_id. Display only.
 */
export function matchedRules(notes: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of (notes ?? "").matchAll(/([A-Z]+-[A-Z]+-[A-Z0-9]+) -> (r-[A-Za-z0-9-]+)/g)) out[m[1]] ??= m[2];
  return out;
}
