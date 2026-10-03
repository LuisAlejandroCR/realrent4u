"use client";
// AppShell.tsx: header (brand, nav, EN/ES), the "not legal advice" + as-of bar shown on every screen,
// data loading states and footer. On the landing (rr-is-landing) main is full-bleed and the header
// aligns to the wider landing grid.
import type { ReactNode } from "react";
import { useDataset, temporal, type Dataset } from "../data";
import { hrefWith, usePrefs } from "../prefs";
import { Notice } from "./Notice";

export type Page = "home" | "dashboard";

export interface AppShellProps {
  current: Page;
  children: (data: Dataset) => ReactNode;
}

export function AppShell({ current, children }: AppShellProps) {
  const load = useDataset();
  const prefs = usePrefs();
  const { tr, lang, setLang } = prefs;
  const manifest = load.state === "ready" ? load.data.manifest : undefined;
  const asOf = prefs.asOf ?? manifest?.default_as_of ?? null;
  const dates = manifest ? Array.from(new Set([...manifest.demo_dates, ...manifest.lookup_dates])).sort() : [];
  const home = current === "home";
  const nav: [string, string][] = [
    [home ? "#how" : hrefWith("/", prefs) + "#how", tr.navHow],
    [hrefWith("/dashboard", prefs, { tab: "tests" }), tr.navChanges],
    [hrefWith("/dashboard", prefs, { tab: "method" }), tr.navAbout],
  ];

  return (
    <div className={`rr ${home ? "rr-is-landing" : ""}`}>
      <a className="rr-skip" href="#main">Skip to content</a>
      <header className="rr-header">
        <div className="rr-wrap rr-header-row">
          <a className="rr-brand" href={hrefWith("/", prefs)}>
            <span className="rr-brand-mark" aria-hidden>§</span>
            <span className="rr-brand-name">{tr.brand}</span>
          </a>
          <nav aria-label="Primary" className="rr-nav">
            {nav.map(([href, label]) => (
              <a key={label} href={href}>{label}</a>
            ))}
          </nav>
          <a className="rr-pill" href={hrefWith("/dashboard", prefs)} aria-current={current === "dashboard" ? "page" : undefined}>
            {tr.navDashboard}
          </a>
          <div className="rr-lang" role="group" aria-label={tr.language}>
            {(["en", "es"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="rr-subbar">
          <div className="rr-wrap rr-subbar-row">
            <span className="rr-advice" role="note">
              <span aria-hidden>!</span> {tr.notAdvice}
            </span>
            {asOf && (
              <div className="rr-asof">
                <label htmlFor="rr-asof">{tr.asOf}</label>
                <select id="rr-asof" value={asOf} onChange={(e) => prefs.setAsOf(e.target.value)} aria-describedby="rr-asof-tag">
                  {dates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span id="rr-asof-tag" className={`rr-tag rr-tag-${temporal(asOf)}`} title={tr.asOfHelp}>
                  {tr[temporal(asOf)]}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" className={home ? "rr-main-bleed" : "rr-wrap rr-main"}>
        {load.state === "loading" && (
          <div className="rr-loading" role="status" aria-live="polite">
            <span className="rr-spinner" aria-hidden /> {tr.loading}
          </div>
        )}
        {load.state === "error" && (
          <Notice tone="danger" title={tr.loadError}>
            <p className="rr-mono">{load.error}</p>
            <button type="button" className="rr-btn" onClick={load.retry}>{tr.retry}</button>
          </Notice>
        )}
        {load.state === "ready" && (
          <>
            {load.data.manifest.uses_fixtures && (
              <Notice tone="warn" title={tr.fixtures}>{tr.fixturesBody}</Notice>
            )}
            {children(load.data)}
          </>
        )}
      </main>

      <footer className="rr-footer">
        <div className="rr-wrap">
          <p>{tr.notAdviceLong}</p>
          {manifest && <p className="rr-muted">{tr.generated}: {manifest.generated_at.slice(0, 16).replace("T", " ")} UTC</p>}
        </div>
      </footer>
    </div>
  );
}
