"use client";
// AboutView.tsx: dashboard tab "Method & audit": how a result is produced, the data files behind the
// demo, available dates and build warnings.
import { Notice } from "../components/Notice";
import type { Dataset } from "../data";
import { usePrefs } from "../prefs";

export function MethodBody({ data: { manifest } }: { data: Dataset }) {
  const { tr } = usePrefs();
  return (
        <div className="rr-about">
          <header className="rr-page-head">
            <h1 className="rr-h1"><em>{tr.aboutTitle}</em></h1>
            <p className="rr-lead">{tr.aboutLead}</p>
          </header>
          <ol className="rr-steps">
            {[tr.m1, tr.m2, tr.m3, tr.m4].map((m, i) => (
              <li key={i}><span className="rr-step-n">{i + 1}</span><p>{m}</p></li>
            ))}
          </ol>

          <h2 className="rr-h2">{tr.dataFiles}</h2>
          <div className="rr-table-wrap">
            <table className="rr-table">
              <thead><tr><th scope="col">{tr.file}</th><th scope="col">{tr.kind}</th><th scope="col">{tr.count}</th></tr></thead>
              <tbody>
                {Object.entries(manifest.sources).map(([k, s]) => (
                  <tr key={k}>
                    <th scope="row">{k}<div className="rr-mono rr-muted">{s.path ?? s.files?.join(", ") ?? "—"}</div></th>
                    <td><span className={`rr-kind rr-kind-${s.kind}`}>{s.kind}</span></td>
                    <td>{s.count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="rr-h2">{tr.dates}</h2>
          <p>
            {manifest.demo_dates.map((d) => (
              <span key={d} className="rr-chip">{d}{d === manifest.default_as_of ? " ★" : ""}</span>
            ))}
          </p>
          <p className="rr-muted">lookup_dates: {manifest.lookup_dates.length ? manifest.lookup_dates.join(", ") : tr.none}</p>

          <h2 className="rr-h2">{tr.warnings}</h2>
          {manifest.warnings.length ? (
            <Notice tone="warn" title={`${manifest.warnings.length}`}>
              <ul>{manifest.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </Notice>
          ) : (
            <p className="rr-muted">{tr.none}</p>
          )}
          <Notice tone="info" title={tr.notAdvice}>{tr.notAdviceLong}</Notice>
        </div>
  );
}
