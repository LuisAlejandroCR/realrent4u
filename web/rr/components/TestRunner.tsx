"use client";
// TestRunner.tsx: runs one change test (T1–T5) in the browser over the precomputed lookups and checks
// the result against changes.json. Mirrors realrent/changes.py: as_of flips, boundary, pending, negative.
import { useState } from "react";
import { loadLookups, type Dataset } from "../data";
import type { ChangeResult, ChangeTest, LookupItem } from "../types";
import type { Dict } from "../i18n";

const BAR_REASON = "bars_local_rent_control";
const CITY_OF: Record<string, string> = { "HOB-ALG-01": "Hoboken, NJ", "JC-ALG-01": "Jersey City, NJ" };

type Lookups = Record<string, LookupItem[]>;
export interface Dist { date: string; counts: [string, number][] }
export interface RunOutcome {
  affected: string[];
  conflicts: string[];
  dists: Dist[];
  ruleIds: string[];
  unmatched: string[];
  matchesAffected: boolean | null;
  matchesConflicts: boolean | null;
}

const item = (l: Lookups, aid: string, rid: string) => l[aid]?.find((i) => i.team_rule_id === rid);
const res = (l: Lookups, aid: string, rid: string) => item(l, aid, rid)?.result ?? null;
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function dist(l: Lookups, ids: string[], rules: string[], date: string): Dist {
  const c = new Map<string, number>();
  for (const aid of ids) {
    const r = rules.map((rid) => res(l, aid, rid)).find((x) => x) ?? "none";
    c.set(r, (c.get(r) ?? 0) + 1);
  }
  return { date, counts: [...c.entries()].sort((a, b) => b[1] - a[1]) };
}

export async function runTest(test: ChangeTest, result: ChangeResult | undefined, data: Dataset): Promise<RunOutcome> {
  const matched = result?.matched ?? {};
  const pairs = test.rule_ids.map((oid) => [oid, matched[oid] ?? null] as const);
  const ruleIds = pairs.flatMap(([, r]) => (r ? [r] : []));
  const unmatched = pairs.filter(([, r]) => !r).map(([oid]) => oid);
  const j = data.jurisdictions;
  const state = test.states?.[0];
  const inState = (aid: string) => !state || j[aid]?.state === state;
  const affected = new Set<string>();
  const conflicts = new Set<string>();
  const dists: Dist[] = [];

  if (test.type === "as_of" && test.as_of_before && test.as_of_after) {
    const [b, a] = await Promise.all([loadLookups(test.as_of_before), loadLookups(test.as_of_after)]);
    if (!b || !a) throw new Error("lookups");
    const ids = Object.keys(a).filter(inState);
    for (const rid of ruleIds)
      for (const aid of ids) if (res(b, aid, rid) === "not_yet_effective" && res(a, aid, rid) === "applies") affected.add(aid);
    const cw = (test.conflict_with ?? []).map((o) => matched[o] ?? null);
    if (test.conflict_with?.length) {
      for (const crid of cw) if (crid) for (const aid of affected) if (res(b, aid, crid) || res(a, aid, crid)) conflicts.add(aid);
    } else {
      for (const rid of ruleIds) for (const aid of affected) if (item(b, aid, rid)?.conflict_flag || item(a, aid, rid)?.conflict_flag) conflicts.add(aid);
    }
    dists.push(dist(b, ids, ruleIds, test.as_of_before), dist(a, ids, ruleIds, test.as_of_after));
  } else if (test.as_of) {
    const l = await loadLookups(test.as_of);
    if (!l) throw new Error("lookups");
    const all = Object.keys(l);
    for (const [oid, rid] of pairs) {
      if (!rid) continue;
      if (test.type === "boundary") {
        const city = CITY_OF[oid] ?? data.rules.find((r) => r.team_rule_id === rid)?.jurisdiction;
        for (const aid of all) if (res(l, aid, rid) && j[aid]?.jurisdiction === city) {
          affected.add(aid);
          if (item(l, aid, rid)?.conflict_flag) conflicts.add(aid);
        }
      } else if (test.type === "pending") {
        for (const aid of all) if (inState(aid) && res(l, aid, rid) === "pending") affected.add(aid);
      } else {
        for (const aid of all) {
          const it = item(l, aid, rid);
          if (it?.result === "applies" && it.reason !== BAR_REASON) affected.add(aid);
        }
      }
    }
    dists.push(dist(l, all.filter(inState), ruleIds, test.as_of));
  }

  const aff = [...affected].sort();
  const con = [...conflicts].sort();
  return {
    affected: aff,
    conflicts: con,
    dists,
    ruleIds,
    unmatched,
    matchesAffected: result ? sameSet(aff, result.affected_address_ids ?? []) : null,
    matchesConflicts: result ? sameSet(con, result.conflict_address_ids ?? []) : null,
  };
}

export interface TestRunPanelProps {
  test: ChangeTest;
  result?: ChangeResult | undefined;
  data: Dataset;
  tr: Dict;
  onOutcome?: (o: RunOutcome | null) => void;
}

/** "Run test" button + step log + per-date result distribution + verdict against changes.json. */
export function TestRunPanel({ test, result, data, tr, onOutcome }: TestRunPanelProps) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [out, setOut] = useState<RunOutcome | null>(null);
  const run = () => {
    setState("running");
    runTest(test, result, data).then(
      (o) => { setOut(o); setState("done"); onOutcome?.(o); },
      () => { setOut(null); setState("error"); onOutcome?.(null); },
    );
  };
  const max = Math.max(1, ...(out?.dists.flatMap((d) => d.counts.map(([, n]) => n)) ?? [1]));

  return (
    <div className="rr-run">
      <div className="rr-run-head">
        <button type="button" className="rr-run-btn" onClick={run} disabled={state === "running"} aria-describedby={`run-${test.test_id}`}>
          <span aria-hidden>{state === "running" ? "…" : "▶"}</span> {state === "done" ? tr.runAgain : tr.runTest}
        </button>
        <p id={`run-${test.test_id}`} className="rr-meta">{tr.runHelp}</p>
      </div>
      {state === "error" && <p className="rr-unavail"><strong>{tr.runError}</strong></p>}
      {out && state !== "error" && (
        <div className="rr-run-out" aria-live="polite">
          <ol className="rr-run-steps">
            <li><b>1</b> {tr.runStepRules}{" "}
              {out.ruleIds.length ? out.ruleIds.map((r) => <span key={r} className="rr-id">{r} </span>) : <span className="rr-missing">{tr.runNoRule}</span>}
              {out.unmatched.length > 0 && <span className="rr-muted"> · {tr.runUnmatched}: {out.unmatched.join(", ")}</span>}
            </li>
            <li><b>2</b> {tr.runStepLoad(out.dists.map((d) => d.date))}</li>
            <li><b>3</b> {tr.runStepCount(out.affected.length, out.conflicts.length)}</li>
            <li><b>4</b> {out.matchesAffected === null ? tr.runNoRecord : out.matchesAffected && out.matchesConflicts
              ? <span className="rr-ok">✓ {tr.runMatch}</span>
              : <span className="rr-bad">✗ {tr.runMismatch}</span>}
            </li>
          </ol>
          {out.dists.length > 0 && out.ruleIds.length > 0 && (
            <div className="rr-dists">
              {out.dists.map((d) => (
                <figure key={d.date} className="rr-dist">
                  <figcaption><span className="rr-label">{tr.asOf}</span> <time className="rr-mono">{d.date}</time></figcaption>
                  {d.counts.map(([k, n]) => (
                    <div key={k} className={`rr-dist-row rr-dist-${k}`}>
                      <span className="rr-dist-k">{tr.result[k] ?? tr.notApplicable}</span>
                      <span className="rr-dist-bar"><span style={{ width: `${(n / max) * 100}%` }} /></span>
                      <span className="rr-dist-n">{n}</span>
                    </div>
                  ))}
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
