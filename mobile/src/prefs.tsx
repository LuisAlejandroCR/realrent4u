// prefs.tsx: app-wide state above the navigator: language, as-of date, search query, dataset.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { LoadErrorScreen } from "./components/States";
import { preview } from "./platform";
import { loadDataset, type Dataset } from "./data";
import { t, type Dict } from "./i18n";
import { m, type MobileStrings } from "./strings";
import type { Lang } from "./types";

/**
 * App-wide state that must survive navigation: language, as-of date, selected address.
 * Lives above the navigator so pushing/popping screens never resets it.
 */
interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  asOf: string;
  setAsOf: (d: string) => void;
  /** Search text survives opening a result and switching tabs. */
  query: string;
  setQuery: (q: string) => void;
  reduceMotion: boolean;
  tr: Dict;
  ms: MobileStrings;
  data: Dataset;
  /** Set when loading bundled JSON throws (corrupt file). Screens show the error state. */
  error: string | null;
  retry: () => void;
}

const Ctx = createContext<Prefs | null>(null);

function safeLoad(): { data: Dataset | null; error: string | null } {
  try {
    if (preview.param("state") === "error") throw new Error("addresses.json: could not be read (preview of the error state)");
    return { data: loadDataset(), error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(safeLoad);
  const [lang, setLang] = useState<Lang>("en");
  const [asOf, setAsOf] = useState(loaded.data?.manifest.default_as_of ?? "");
  const [query, setQuery] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);
  const value = useMemo<Prefs | null>(
    () =>
      loaded.data
        ? { lang, setLang, asOf, setAsOf, query, setQuery, reduceMotion, tr: t(lang), ms: m(lang), data: loaded.data, error: null, retry: () => setLoaded(safeLoad()) }
        : null,
    [lang, asOf, query, reduceMotion, loaded],
  );
  if (!value) return <LoadErrorScreen message={loaded.error} onRetry={() => setLoaded(safeLoad())} lang={lang} />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}
