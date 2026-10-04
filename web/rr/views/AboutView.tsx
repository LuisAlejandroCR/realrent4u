"use client";
// AboutView.tsx: dashboard tab "Method & audit": the pipeline diagram (how a result is produced), every result
// at the as-of date with its top reasons on demand, the data files behind the demo, dates and build warnings.
import { useState } from "react";
import { Notice } from "../components/Notice";
import { StatusBadge } from "../components/StatusBadge";
import { Pipeline } from "../components/Pipeline";
import { BarChart, Kpis, MetroGrid } from "../components/Charts";
import { useGeo } from "../visual";
import { useLookups, type Dataset } from "../data";
import { usePrefs } from "../prefs";
import { reasonLabel } from "../reason-labels";
import type { Lang, LookupResult } from "../types";
import type { Dict } from "../i18n";

const ORDER: LookupResult[] = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];

/** Every lookup result at the as-of date as one bar; picking a result lists the reasons behind it (mobile H4). */
function ResultMix({ data, asOf, lang, tr }: { data: Dataset; asOf: string; lang: Lang; tr: Dict }) {
  const lookups = useLookups(data.manifest, asOf);
  const [pick, setPick] = useState<LookupResult | null>("unknown");
  if (lookups.state !== "ready" || !lookups.data) return null;
  const counts = new Map<LookupResult, number>();
  const reasons = new Map<LookupResult, Map<string, number>>();
  let total = 0;
  for (const items of Object.values(lookups.data)) {
    for (const i of items) {
      total++;
      counts.set(i.result, (counts.get(i.result) ?? 0) + 1);
      const m = reasons.get(i.result) ?? new Map<string, number>();
      for (const r of (i.reason ?? "").split(",").map((x) => x.trim()).filter(Boolean)) m.set(r, (m.get(r) ?? 0) + 1);
      reasons.set(i.result, m);
    }
  }
  if (!total) return null;
  const shown = ORDER.filter((k) => counts.has(k));
  const sel = pick && counts.has(pick) ? pick : null;
  const top = sel ? [...(reasons.get(sel) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  return (
    <section className="rr-mix" aria-labelledby="rr-mix-h">
      <h2 id="rr-mix-h" className="rr-h2">{tr.mixTitle} <span className="rr-muted">· {tr.asOf} {asOf}</span></h2>
      <p className="rr-meta">{tr.mixTotal(total, Object.keys(lookups.data).length)} · {tr.mixPick}</p>
      <div className="rr-stage-bar rr-sum-bar rr-mix-bar">
        {shown.map((k) => (
          <button
            key={k}
            type="button"
            className={`rr-seg rr-seg-${k}${sel === k ? " is-on" : ""}`}
            style={{ width: `${((counts.get(k) ?? 0) / total) * 100}%` }}
            aria-pressed={sel === k}
            aria-label={`${counts.get(k)} ${tr.result[k] ?? k}`}
            onClick={() => setPick(sel === k ? null : k)}
          />
        ))}
      </div>
      <ul className="rr-sum-list">
        {shown.map((k) => (
          <li key={k}>
            <button type="button" className={`rr-sum-btn${sel === k ? " is-on" : ""}`} aria-pressed={sel === k} onClick={() => setPick(sel === k ? null : k)}>
              <StatusBadge kind={k} tr={tr} />
              <span className="rr-sum-n">{counts.get(k)}</span>
            </button>
          </li>
        ))}
      </ul>
      {sel && (
        top.length ? (
          <BarChart
            title={tr.mixReasons(tr.result[sel] ?? sel)}
            rows={top.map(([r, n]) => ({ label: reasonLabel(r, lang), value: n }))}
          />
        ) : (
          <p className="rr-meta" role="status">{tr.mixReasons(tr.result[sel] ?? sel)}: {tr.mixNoReason}</p>
        )
      )}
    </section>
  );
}

/** The one-page method note (docs/METHOD.md), read on GitHub so the demo stays a static export. */
const METHOD_NOTE_URL = "https://github.com/LuisAlejandroCR/realrent4u/blob/main/docs/METHOD.md";

export function MethodBody({ data }: { data: Dataset }) {
  const { manifest } = data;
  const prefs = usePrefs();
  const { tr, lang } = prefs;
  const asOf = prefs.asOf ?? manifest.default_as_of;
  const geo = useGeo();
  const byJur = new Map<string, { n: number; level: string }>();
  for (const r of data.rules) byJur.set(r.jurisdiction, { n: (byJur.get(r.jurisdiction)?.n ?? 0) + 1, level: r.level });
  const street = new Map(data.addresses.map((a) => [a.address_id, `${a.address_id} · ${a.street_address}`]));
  const dates = manifest.lookup_dates.length || manifest.demo_dates.length;
  return (
    <div className="rr-about">
      <header className="rr-page-head">
        <h1 className="rr-h1"><em>{tr.aboutTitle}</em></h1>
        <p className="rr-lead">{tr.aboutLead}</p>
        <p>
          <a className="rr-link" href={METHOD_NOTE_URL} target="_blank" rel="noopener noreferrer">
            {tr.methodNote} <span aria-hidden>↗</span><span className="rr-sr"> ({tr.newTab})</span>
          </a>
        </p>
      </header>
      <Kpis
        items={[
          { value: manifest.sources.corpus?.count ?? "—", label: tr.kpiDocs },
          { value: data.rules.length, label: tr.kpiRules },
          { value: byJur.size, label: tr.kpiPlaces },
          { value: data.addresses.length, label: tr.kpiAddresses },
          { value: geo ? Object.keys(geo.points).length : "—", label: tr.kpiPlaced, note: ` ${tr.ofN(data.addresses.length)}` },
          { value: dates, label: tr.kpiDates },
        ]}
      />
      <Pipeline data={data} tr={tr} />
      <ResultMix data={data} asOf={asOf} lang={lang} tr={tr} />
      <div className="rr-method-vis">
        {geo && (
          <section aria-labelledby="rr-cov-h">
            <h2 id="rr-cov-h" className="rr-h2">{tr.coverageTitle}</h2>
            <MetroGrid
              geo={geo}
              tone={(id) => (geo.points[id]?.e ? "on" : "off")}
              tip={(id) => street.get(id) ?? id}
              legend={[["on", tr.lgExact], ["off", tr.lgNonExact]]}
              tr={tr}
            />
          </section>
        )}
        <BarChart
          title={tr.rulesByJur}
          rows={[...byJur].sort((a, b) => b[1].n - a[1].n).map(([label, v]) => ({ label, value: v.n, sub: tr.level[v.level] ?? v.level }))}
          note={tr.rulesByJurNote}
        />
      </div>

      <div className="rr-audit-grid">
        <section aria-labelledby="rr-data-files-title">
          <h2 id="rr-data-files-title" className="rr-h2">{tr.dataFiles}</h2>
          <div className="rr-table-wrap">
            <table className="rr-table">
              <thead><tr><th scope="col">{tr.file}</th><th scope="col">{tr.kind}</th><th scope="col">{tr.count}</th></tr></thead>
              <tbody>
                {Object.entries(manifest.sources).map(([k, s]) => (
                  <tr key={k}>
                    <th scope="row">{k}<div className="rr-mono rr-muted">{s.path ?? s.files?.map((f) => (typeof f === "string" ? f : f.path)).join(", ") ?? "—"}</div></th>
                    <td><span className={`rr-kind rr-kind-${s.kind}`}>{s.kind}</span></td>
                    <td>{s.count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="rr-audit-side">
          <section aria-labelledby="rr-available-dates-title">
            <h2 id="rr-available-dates-title" className="rr-h2">{tr.dates}</h2>
            <p>
              {manifest.demo_dates.map((d) => (
                <span key={d} className="rr-chip">
                  {d}
                  {d === manifest.default_as_of && <> <span aria-hidden>★</span><span className="rr-sr">{tr.defaultDate}</span></>}
                </span>
              ))}
            </p>
            <p className="rr-muted rr-lookup-dates">{tr.lookupDates}: {manifest.lookup_dates.length ? manifest.lookup_dates.join(", ") : tr.none}</p>
          </section>
          <section aria-labelledby="rr-build-warnings-title">
            <h2 id="rr-build-warnings-title" className="rr-h2">{tr.warnings}</h2>
            {manifest.warnings.length ? (
              <Notice tone="warn" title={`${manifest.warnings.length}`}>
                <ul>{manifest.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </Notice>
            ) : (
              <p className="rr-muted">{tr.none}</p>
            )}
          </section>
          <Notice tone="info" title={tr.notAdvice}>{tr.notAdviceLong}</Notice>
        </div>
      </div>
    </div>
  );
}
