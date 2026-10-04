"use client";
// Pipeline.tsx: the method as one picture: two input lanes (public documents → extraction → quote-checked
// rules; sample addresses → Census geocoder → building facts) meeting in the deterministic engine, which writes
// the dated results. Every number is counted from this build's data files.
import type { Dict } from "../i18n";
import type { Dataset } from "../data";
import { useReveal } from "../hero";

function Node({ t, b, i, tone }: { t: string; b: string; i: number; tone?: "model" | "engine" | "out" }) {
  return (
    <li className={`rr-pipe-node ${tone ? `is-${tone}` : ""}`} style={{ ["--i" as string]: i }}>
      <strong>{t}</strong>
      <span>{b}</span>
    </li>
  );
}

export function Pipeline({ data, tr }: { data: Dataset; tr: Dict }) {
  const ref = useReveal<HTMLElement>();
  const m = data.manifest;
  const docs = m.sources.corpus?.count ?? 0;
  const resolved = Object.values(data.jurisdictions).filter((j) => j?.jurisdiction).length;
  const dates = m.lookup_dates.length || m.demo_dates.length;
  return (
    <figure className="rr-pipe" ref={ref} aria-labelledby="rr-pipe-h">
      <figcaption id="rr-pipe-h" className="rr-h2">{tr.pipeTitle}</figcaption>
      <div className="rr-pipe-grid">
        <ol className="rr-pipe-lane">
          <Node i={0} t={tr.pipeDocs(docs)} b={tr.pipeDocsB} />
          <Node i={1} t={tr.pipeExtract} b={tr.pipeExtractB} tone="model" />
          <Node i={2} t={tr.pipeCheck(data.rules.length)} b={tr.pipeCheckB} />
        </ol>
        <ol className="rr-pipe-lane">
          <Node i={0} t={tr.pipeAddr(data.addresses.length)} b={tr.pipeAddrB} />
          <Node i={1} t={tr.pipeGeo(resolved)} b={tr.pipeGeoB} />
          <Node i={2} t={tr.pipeFacts} b={tr.pipeFactsB} />
        </ol>
        <ol className="rr-pipe-end">
          <Node i={3} t={tr.pipeEngine} b={tr.pipeEngineB} tone="engine" />
          <Node i={4} t={tr.pipeOut(dates)} b={tr.pipeOutB} tone="out" />
        </ol>
      </div>
      <p className="rr-pipe-rules">
        <span>{tr.m3}</span>
        <span>{tr.m4}</span>
      </p>
    </figure>
  );
}
