"use client";
// ChangesView.tsx: dashboard tab "Change tests": the five fixed scenarios T1–T5, each runnable in the
// browser over the precomputed lookups and checked against changes.json.
import { ChangeTestCard } from "../components/ChangeTestCard";
import { Notice } from "../components/Notice";
import type { Dataset } from "../data";
import { hrefWith, usePrefs } from "../prefs";

export function TestsBody({ data, focus }: { data: Dataset; focus?: string | null }) {
  const prefs = usePrefs();
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
          />
        ))}
      </div>
    </>
  );
}
