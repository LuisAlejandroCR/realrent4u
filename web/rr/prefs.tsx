"use client";
// prefs.tsx: language and as-of date as app state, kept in the URL (?lang=&asOf=) so links are shareable.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "./types";
import { t, type Dict } from "./i18n";

// Language + as-of date, kept in the URL (?lang=&asOf=) so links are shareable.
// Framework-agnostic: uses history.replaceState, no router dependency.

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  asOf: string | null;
  setAsOf: (d: string) => void;
  tr: Dict;
}

const Ctx = createContext<Prefs | null>(null);

export function setParam(key: string, value: string | null) {
  const u = new URL(window.location.href);
  if (value) u.searchParams.set(key, value);
  else u.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", u.toString());
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>("en");
  const [asOf, setAsOfS] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("rr-lang");
    } catch {}
    const l = p.get("lang") ?? stored;
    if (l === "es" || l === "en") setLangS(l);
    const d = p.get("asOf");
    if (d) setAsOfS(d);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangS(l);
    try {
      localStorage.setItem("rr-lang", l);
    } catch {}
    setParam("lang", l);
  };
  const setAsOf = (d: string) => {
    setAsOfS(d);
    setParam("asOf", d);
  };

  return <Ctx.Provider value={{ lang, setLang, asOf, setAsOf, tr: t(lang) }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return c;
}

/** Build an internal href that keeps lang + asOf. */
export function hrefWith(path: string, prefs: Pick<Prefs, "lang" | "asOf">, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ lang: prefs.lang, ...(prefs.asOf ? { asOf: prefs.asOf } : {}), ...extra });
  return `${path}?${p.toString()}`;
}
