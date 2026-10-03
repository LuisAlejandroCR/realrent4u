"use client";
// data.ts: loads the precomputed JSON in /public/data (written by scripts/copy-data.mjs) and adapts the
// pipeline's shapes: lookups are {as_of, lookups: {address_id: items}}, changes are {test_id: result}.
import { useCallback, useEffect, useState } from "react";
import type { Address, ChangeResult, ChangeTest, Jurisdiction, LookupItem, Manifest, Rule } from "./types";

// Base path for the static JSON. Next.js static export serves /public as /.
export const DATA_BASE = "/data";

export interface Dataset {
  manifest: Manifest;
  addresses: Address[];
  rules: Rule[];
  jurisdictions: Record<string, Jurisdiction>;
  changeTests: ChangeTest[];
  changeResults: ChangeResult[];
}

async function getJson<T>(name: string, optional = false): Promise<T | null> {
  const res = await fetch(`${DATA_BASE}/${name}`);
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`${name}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface RawChange {
  affected_address_ids?: string[];
  conflict_flag_address_ids?: string[];
  notes?: string;
}

/** changes.json is keyed by test id; a test with no entry stays absent (results not available). */
function adaptChanges(raw: Record<string, RawChange> | null): ChangeResult[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([, v]) => v && Array.isArray(v.affected_address_ids))
    .map(([test_id, v]) => ({
      test_id,
      affected_address_ids: v.affected_address_ids ?? [],
      conflict_address_ids: v.conflict_flag_address_ids ?? [],
      notes: v.notes ?? "",
      matched: matchedRules(v.notes ?? ""),
    }));
}

/** "Matched: NJ-ALG-01 -> r-D069-01 (...)" in the notes written by realrent.changes → {NJ-ALG-01: r-D069-01}. */
export function matchedRules(notes: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const m of notes.matchAll(/\b([A-Z]+(?:-[A-Z0-9]+)+) -> (r-[A-Za-z0-9]+-\d+|no matching rule)/g)) {
    if (!(m[1]! in out)) out[m[1]!] = m[2]!.startsWith("r-") ? m[2]! : null;
  }
  return out;
}

let cache: Promise<Dataset> | null = null;

function loadDataset(): Promise<Dataset> {
  if (!cache) {
    cache = (async () => {
      const [manifest, addresses, rules, jurisdictions, changeTests, changes] = await Promise.all([
        getJson<Manifest>("manifest.json"),
        getJson<Address[]>("addresses.json"),
        getJson<{ rules: Rule[] } | Rule[]>("rules.json"),
        getJson<Record<string, Jurisdiction>>("jurisdictions.json"),
        getJson<ChangeTest[]>("change_tests.json", true),
        getJson<Record<string, RawChange>>("changes.json", true),
      ]);
      const changeResults = adaptChanges(changes);
      return {
        manifest: manifest!,
        addresses: addresses ?? [],
        rules: Array.isArray(rules) ? rules : rules?.rules ?? [],
        jurisdictions: jurisdictions ?? {},
        changeTests: changeTests ?? [],
        changeResults,
      };
    })();
    cache.catch(() => (cache = null));
  }
  return cache;
}

export type Load<T> = { state: "loading" } | { state: "error"; error: string; retry: () => void } | { state: "ready"; data: T };

export function useDataset(): Load<Dataset> {
  const [s, setS] = useState<Load<Dataset>>({ state: "loading" });
  const run = useCallback(() => {
    setS({ state: "loading" });
    loadDataset().then(
      (data) => setS({ state: "ready", data }),
      (e: Error) => setS({ state: "error", error: e.message, retry: run }),
    );
  }, []);
  useEffect(run, [run]);
  return s;
}

type LookupMap = Record<string, LookupItem[]>;
const lookupCache = new Map<string, Promise<LookupMap | null>>();

/** /data/lookups/<as_of>.json as written by realrent.lookups: {as_of, lookups: {address_id: items}}. */
export function loadLookups(asOf: string): Promise<LookupMap | null> {
  if (!lookupCache.has(asOf)) {
    const p = getJson<{ lookups?: LookupMap } | LookupMap>(`lookups/${asOf}.json`, true).then((d) =>
      d && typeof d === "object" && "lookups" in d && d.lookups && typeof d.lookups === "object" ? (d.lookups as LookupMap) : (d as LookupMap | null),
    );
    p.catch(() => lookupCache.delete(asOf));
    lookupCache.set(asOf, p);
  }
  return lookupCache.get(asOf)!;
}

/** Lookup results for one date; only fetched when the manifest lists the date in `lookup_dates`. */
export function useLookups(manifest: Manifest | undefined, asOf: string) {
  const [s, setS] = useState<{ state: "none" | "loading" | "ready" | "error"; data?: Record<string, LookupItem[]> }>({ state: "none" });
  useEffect(() => {
    if (!manifest || !manifest.lookup_dates.includes(asOf)) return setS({ state: "none" });
    setS({ state: "loading" });
    loadLookups(asOf).then(
      (d) => setS(d ? { state: "ready", data: d } : { state: "none" }),
      () => setS({ state: "error" }),
    );
  }, [manifest, asOf]);
  return s;
}

/** Rules in the record for a resolved jurisdiction: exact local match + statewide. Pure filter, no evaluation. */
export function rulesInRecord(rules: Rule[], j: Jurisdiction | undefined): Rule[] {
  if (!j?.jurisdiction) return [];
  const state = j.state ?? j.jurisdiction.split(", ").pop();
  return rules.filter((r) => r.jurisdiction === j.jurisdiction || (r.level === "state" && r.jurisdiction === state));
}

export function searchAddresses(list: Address[], q: string, limit = 12): Address[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return list
    .filter((a) => `${a.address_id} ${a.street_address} ${a.postal_city} ${a.state} ${a.zip}`.toLowerCase().includes(s))
    .slice(0, limit);
}

export function temporal(asOf: string): "past" | "current" | "future" {
  const today = new Date().toISOString().slice(0, 10);
  return asOf < today ? "past" : asOf > today ? "future" : "current";
}

export const blank = (v: string | null | undefined) => v === null || v === undefined || String(v).trim() === "";
