"use client";
// AboutView.tsx: dashboard tab "Method & audit": how a result is produced, the data files behind the
// demo, available dates and build warnings.
import { Notice } from "../components/Notice";
import type { Dataset } from "../data";
import { usePrefs } from "../prefs";

/** The one-page method note (docs/METHOD.md), read on GitHub so the demo stays a static export. */
const METHOD_NOTE_URL = "https://github.com/LuisAlejandroCR/realrent4u/blob/main/docs/METHOD.md";

export function MethodBody({ data: { manifest } }: { data: Dataset }) {
  const { tr } = usePrefs();
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
      <ol className="rr-steps">
        {[tr.m1, tr.m2, tr.m3, tr.m4].map((m, i) => (
          <li key={i}><span className="rr-step-n">{i + 1}</span><p>{m}</p></li>
        ))}
      </ol>

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
