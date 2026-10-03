// Providers.tsx: client context with language, as-of date and the static data loaded from /data/.
// URL params (?lang=es&date=2027-07-02) win over the per-browser saved preference.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, type Key, type Lang } from "@/lib/i18n";
import type { Address, ChangeResult, ChangeTest, CorpusDoc, Jurisdiction, LookupFile, Manifest, Rule } from "@/lib/types";

export interface Data {
  manifest: Manifest;
  rules: Rule[];
  rulesById: Record<string, Rule>;
  jurisdictions: Record<string, Jurisdiction>;
  addresses: Address[];
  corpus: Record<string, CorpusDoc>;
  changes: Record<string, ChangeResult>;
  changeTests: ChangeTest[];
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  asOf: string;
  setAsOf: (d: string) => void;
  t: (k: Key) => string;
  data: Data | null;
  error: string | null;
  lookups: (asOf: string) => LookupFile | null | undefined;
}

const AppContext = createContext<Ctx | null>(null);

const DEFAULT_AS_OF = "2026-10-01";

async function getJson<T>(name: string): Promise<T> {
  const r = await fetch(`/data/${name}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

function load(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preference just isn't remembered */
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [asOf, setAsOfState] = useState<string>(DEFAULT_AS_OF);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined = not fetched yet, null = no file for that date
  const [lookupCache, setLookupCache] = useState<Record<string, LookupFile | null>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("lang") ?? load("rr-lang");
    if (l === "en" || l === "es") setLangState(l);
    const d = params.get("date") ?? load("rr-asof");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setAsOfState(d);

    (async () => {
      try {
        const [manifest, rulesFile, jurisdictions, addresses, corpus, changes, changeTests] = await Promise.all([
          getJson<Manifest>("manifest.json"),
          getJson<{ rules: Rule[] }>("rules.json"),
          getJson<Record<string, Jurisdiction>>("jurisdictions.json"),
          getJson<Address[]>("addresses.json"),
          getJson<Record<string, CorpusDoc>>("corpus.json"),
          getJson<Record<string, ChangeResult>>("changes.json"),
          getJson<ChangeTest[]>("change_tests.json"),
        ]);
        const rules = rulesFile.rules ?? [];
        setData({
          manifest,
          rules,
          rulesById: Object.fromEntries(rules.map((r) => [r.team_rule_id, r])),
          jurisdictions,
          addresses,
          corpus,
          changes,
          changeTests,
        });
        if (!(d && manifest.demo_dates.includes(d))) setAsOfState(manifest.default_as_of || DEFAULT_AS_OF);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Fetch the lookup file for the selected date when the manifest says it exists.
  useEffect(() => {
    if (!data || asOf in lookupCache) return;
    if (!data.manifest.lookup_dates.includes(asOf)) {
      setLookupCache((c) => ({ ...c, [asOf]: null }));
      return;
    }
    getJson<LookupFile>(`lookups/${asOf}.json`)
      .then((f) => setLookupCache((c) => ({ ...c, [asOf]: f })))
      .catch(() => setLookupCache((c) => ({ ...c, [asOf]: null })));
  }, [data, asOf, lookupCache]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    save("rr-lang", l);
  }, []);
  const setAsOf = useCallback((d: string) => {
    setAsOfState(d);
    save("rr-asof", d);
  }, []);
  const t = useCallback((k: Key) => {
    const v = dictionaries[lang][k] ?? dictionaries.en[k];
    return Array.isArray(v) ? v.join(" ") : v;
  }, [lang]);
  const lookups = useCallback((d: string) => lookupCache[d], [lookupCache]);

  const value = useMemo(
    () => ({ lang, setLang, asOf, setAsOf, t, data, error, lookups }),
    [lang, setLang, asOf, setAsOf, t, data, error, lookups],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside Providers");
  return c;
}
