"use client";
// ChangesView.tsx: dashboard tab "Change tests": KPI tiles that filter the five fixed scenarios T1–T5, the tests
// drawn on one date axis, then one card each, runnable in the browser and checked against changes.json.
import { useEffect, useState } from "react";
import { ChangeTestCard } from "../components/ChangeTestCard";
import { LawTimeline } from "../components/LawTimeline";
import { Notice } from "../components/Notice";
import type { Dataset } from "../data";
import { hrefWith, setParam, usePrefs } from "../prefs";
import { earn } from "../stamps";

type TestFilter = "all" | "changes" | "review" | "none";

export function TestsBody({ data, focus: initial }: { data: Dataset; focus?: string | null }) {
  const prefs = usePrefs();
  const [focus, setFocus] = useState<string | null>(initial ?? null);
  const [filter, setFilter] = useState<TestFilter>("all");
  // The dashboard reads ?t= after mount; follow it.
  useEffect(() => {
    if (initial) {
      setFocus(initial);
      earn("scenario");
    }
  }, [initial]);
  // A lane opens its card (and only that one) and brings it into view.
  const pick = (id: string) => {
    setFocus(id);
    earn("scenario");
    setParam("t", id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById(`test-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };
  const { tr } = prefs;
  const rules = new Map(data.rules.map((r) => [r.team_rule_id, r]));
  const addresses = new Map(data.addresses.map((a) => [a.address_id, a]));
  const n = data.changeTests.length;
  const k = data.changeTests.filter((t) => data.changeResults.some((r) => r.test_id === t.test_id)).length;
  // Each tile is a count and a filter, like the mobile Changes header: tap "need review" → T2, T3 only.
  const resultOf = (id: string) => data.changeResults.find((r) => r.test_id === id);
  const is: Record<TestFilter, (id: string) => boolean> = {
    all: () => true,
    changes: (id) => (resultOf(id)?.affected_address_ids?.length ?? 0) > 0,
    review: (id) => (resultOf(id)?.conflict_address_ids?.length ?? 0) > 0,
    none: (id) => !!resultOf(id) && (resultOf(id)?.affected_address_ids?.length ?? 0) === 0,
  };
  const tests = data.changeTests.filter((t) => is[filter](t.test_id));
  const changed = data.changeResults.reduce((s, r) => s + (r.affected_address_ids?.length ?? 0), 0);
  const tiles: { key: TestFilter; value: number; label: string }[] = [
    { key: "all", value: n, label: tr.tFilterAll },
    { key: "changes", value: changed, label: tr.tFilterChanges },
    { key: "review", value: data.changeTests.filter((t) => is.review(t.test_id)).length, label: tr.tFilterReview },
    { key: "none", value: data.changeTests.filter((t) => is.none(t.test_id)).length, label: tr.tFilterNone },
  ];
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
      {k > 0 && (
        <div className="rr-ktiles" role="group" aria-label={tr.changesTitle}>
          {tiles.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`rr-ktile${filter === t.key ? " is-on" : ""}${t.key === "review" && t.value ? " is-warn" : ""}`}
              aria-pressed={filter === t.key}
              onClick={() => setFilter(filter === t.key ? "all" : t.key)}
            >
              <span className="rr-ktile-v">{t.value}</span>
              <span className="rr-ktile-l">{t.label}</span>
            </button>
          ))}
        </div>
      )}
      {filter !== "all" && <p className="rr-meta" role="status">{tr.tFilterShowing(tests.length, n)}</p>}
      {n > 0 && (
        <LawTimeline
          tests={tests}
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
        {tests.map((t) => (
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
