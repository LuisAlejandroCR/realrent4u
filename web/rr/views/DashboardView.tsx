"use client";
// DashboardView.tsx: the working app behind the landing: tabs for address lookup, the T1–T5 change
// tests (run in the browser) and method & audit. The tab lives in ?tab= so links are shareable.
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { setParam, usePrefs } from "../prefs";
import { SearchBody } from "./SearchView";
import { TestsBody } from "./ChangesView";
import { MethodBody } from "./AboutView";
import { StampToast, StampWatch } from "../components/Story";

export type Tab = "lookup" | "tests" | "method";
const TABS: Tab[] = ["lookup", "tests", "method"];

export function DashboardView({ initial = "lookup" }: { initial?: Tab }) {
  const { tr } = usePrefs();
  const [tab, setTab] = useState<Tab>(initial);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab") as Tab | null;
    if (t && TABS.includes(t)) setTab(t);
    setFocus(p.get("t"));
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    setParam("tab", t);
  };
  const label: Record<Tab, string> = { lookup: tr.tabLookup, tests: tr.tabTests, method: tr.tabMethod };

  return (
    <AppShell current="dashboard">
      {(data) => (
        <div className="rr-dash">
          <StampWatch defaultAsOf={data.manifest.default_as_of} />
          <StampToast />
          <div className="rr-dash-head">
            <p className="rr-kicker">{tr.dashKicker}</p>
            <div role="tablist" aria-label={tr.dashKicker} className="rr-tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => choose(t)}
                  onKeyDown={(e) => {
                    // Roving tabindex: move focus with the selection, or the focused tab drops out of the tab order.
                    const i = TABS.indexOf(t);
                    const next =
                      e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length]
                      : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length]
                      : e.key === "Home" ? TABS[0]
                      : e.key === "End" ? TABS[TABS.length - 1]
                      : undefined;
                    if (!next) return;
                    e.preventDefault();
                    choose(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }}
                >
                  {label[t]}
                  {t === "tests" && <span className="rr-tab-n">{data.changeTests.length}</span>}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rr-dash-panel">
            {tab === "lookup" && <SearchBody data={data} />}
            {tab === "tests" && <TestsBody data={data} focus={focus} />}
            {tab === "method" && <MethodBody data={data} />}
          </div>
        </div>
      )}
    </AppShell>
  );
}
