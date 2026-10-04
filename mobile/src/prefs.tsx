// prefs.tsx: app-wide state above the navigator: language, as-of date, search query, dataset,
// profile settings (haptics, motion) and the session's case-file stamps.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { LoadErrorScreen } from "./components/States";
import { preview } from "./platform";
import { loadDataset, type Dataset } from "./data";
import { haptic, setFeel, useReduceMotion } from "./feel";
import { t, type Dict } from "./i18n";
import { m, type MobileStrings } from "./strings";
import type { Lang } from "./types";

/** Exploration stamps for the case file. Order = display order. Session only; nothing is stored. */
export const STAMPS = ["find", "mismatch", "source", "time", "scenario"] as const;
export type StampId = (typeof STAMPS)[number];

/**
 * App-wide state that must survive navigation: language, as-of date, selected address.
 * Lives above the navigator so pushing/popping screens never resets it.
 */
interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  asOf: string;
  /** Changing the date is "time travel": haptic + stamp. */
  setAsOf: (d: string) => void;
  /** Search text survives opening a result and switching tabs. */
  query: string;
  setQuery: (q: string) => void;
  reduceMotion: boolean;
  haptics: boolean;
  setHaptics: (v: boolean) => void;
  motionOff: boolean;
  setMotionOff: (v: boolean) => void;
  stamps: StampId[];
  /** Idempotent: earning a stamp twice does nothing. */
  earn: (id: StampId) => void;
  /** Most recent new stamp, for the toast. Cleared by the toast. */
  lastStamp: StampId | null;
  clearLastStamp: () => void;
  resetStamps: () => void;
  tr: Dict;
  ms: MobileStrings;
  data: Dataset;
  /** Set when loading bundled JSON throws (corrupt file). Screens show the error state. */
  error: string | null;
  retry: () => void;
}

const Ctx = createContext<Prefs | null>(null);

/** First language from the device settings: Spanish if it is Spanish, otherwise English. */
function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

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
  const [lang, setLangRaw] = useState<Lang>(deviceLang);
  const [asOf, setAsOfRaw] = useState(loaded.data?.manifest.default_as_of ?? "");
  const [query, setQuery] = useState("");
  const [haptics, setHapticsRaw] = useState(true);
  const [motionOff, setMotionOffRaw] = useState(false);
  const [stamps, setStamps] = useState<StampId[]>([]);
  const [lastStamp, setLastStamp] = useState<StampId | null>(null);
  const reduceMotion = useReduceMotion();

  // Refs hold the latest values so side effects (haptics, toast) never run inside a state updater.
  const stampsRef = useRef<StampId[]>([]);
  const asOfRef = useRef(asOf);
  const earn = useCallback((id: StampId) => {
    if (stampsRef.current.includes(id)) return;
    stampsRef.current = [...stampsRef.current, id];
    setStamps(stampsRef.current);
    setLastStamp(id);
    haptic.success();
  }, []);
  const setAsOf = useCallback((d: string) => {
    if (asOfRef.current === d) return;
    asOfRef.current = d;
    setAsOfRaw(d);
    haptic.select();
    earn("time");
  }, [earn]);
  const setLang = useCallback((l: Lang) => { haptic.select(); setLangRaw(l); }, []);
  const setHaptics = useCallback((v: boolean) => { setFeel({ haptics: v }); setHapticsRaw(v); haptic.select(); }, []);
  const setMotionOff = useCallback((v: boolean) => { setFeel({ reduceMotion: v }); setMotionOffRaw(v); haptic.select(); }, []);
  const clearLastStamp = useCallback(() => setLastStamp(null), []);
  const resetStamps = useCallback(() => { stampsRef.current = []; setStamps([]); setLastStamp(null); haptic.warn(); }, []);

  const value = useMemo<Prefs | null>(
    () =>
      loaded.data
        ? {
            lang, setLang, asOf, setAsOf, query, setQuery, reduceMotion, haptics, setHaptics, motionOff, setMotionOff,
            stamps, earn, lastStamp, clearLastStamp, resetStamps,
            tr: t(lang), ms: m(lang), data: loaded.data, error: null, retry: () => setLoaded(safeLoad()),
          }
        : null,
    [lang, setLang, asOf, setAsOf, query, reduceMotion, haptics, setHaptics, motionOff, setMotionOff, stamps, earn, lastStamp, clearLastStamp, resetStamps, loaded],
  );
  if (!value) return <LoadErrorScreen message={loaded.error} onRetry={() => setLoaded(safeLoad())} lang={lang} />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}
