"use client";
// ChangesView.tsx: dashboard tab "Change tests": the five fixed scenarios T1–T5 drawn on one date axis, then
// one card each, runnable in the browser over the precomputed lookups and checked against changes.json.
import { useEffect, useState } from "react";
import { ChangeTestCard } from "../components/ChangeTestCard";
import { LawTimeline } from "../components/LawTimeline";
import { Notice } from "../components/Notice";
import type { Dataset } from "../data";
import { hrefWith, setParam, usePrefs } from "../prefs";

export function TestsBody({ data, focus: initial }: { data: Dataset; focus?: string | null }) {
  const prefs = usePrefs();
  const [focus, setFocus] = useState<string | null>(initial ?? null);
  // The dashboard reads ?t= after mount; follow it.
  useEffect(() => {
    if (initial) setFocus(initial);
  }, [initial]);
  // A lane opens its card (and only that one) and brings it into view.
  const pick = (id: string) => {
    setFocus(id);
    setParam("t", id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById(`test-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };
  const { tr } = prefs;
  const rules = new Map(data.rules.map((r) => [r.team_rule_id, r]));
  const addresses = new Map(data.addresses.map((a) => [a.address_id, a]));
  const n = data.changeTests.length;
  const k = data.changeTests.filter((t) => data.changeResults.some((r) => r.test_id === t.test_id)).length;
  return (
    <>
      <header className="rr-page-head rr-page-head-tight">
        <h1 className="rr-h1"><em>{tr.changesTitle}</em></h1>
        <p className="rr-lead">{tr.changesIntro}</p>
        <p className={`rr-summary-line ${k ? "" : "is-missing"}`}>
          <strong>{tr.changesSummary(n)}</strong> {k ? tr.resultsAvailable(k, n) : tr.resultsMissingAll}
        </p>
        <p className="rr-meta">{tr.globalAsOfNote}</p>
      </header>
      {n === 0 && <Notice tone="neutral" title={tr.none} />}
      {n > 0 && (
        <LawTimeline
          tests={data.changeTests}
          results={data.changeResults}
          total={data.addresses.length}
          href={(id) => hrefWith("/dashboard", prefs, { tab: "tests", t: id })}
          onPick={pick}
          current={focus}
          note={tr.tlNoteDash}
          tr={tr}
        />
      )}
      <div className="rr-tests">
        {data.changeTests.map((t) => (
          <ChangeTestCard
            key={t.test_id}
            test={t}
            result={data.changeResults.find((r) => r.test_id === t.test_id)}
            rules={rules}
            addresses={addresses}
            addressHref={(id, asOf) => hrefWith("/dashboard", { ...prefs, asOf: asOf ?? prefs.asOf }, { tab: "lookup", a: id })}
            data={data}
            tr={tr}
            defaultOpen={focus ? focus === t.test_id : undefined}
            anchor={`test-${t.test_id}`}
          />
        ))}
      </div>
    </>
  );
}
