"use client";
// Charts.tsx: the small visual vocabulary of the dashboard, all plain SVG/HTML over precomputed data:
// MetroMap (one metro, county outlines, sample addresses at ~1 km), MetroGrid (small multiples with a legend),
// Kpis (stat tiles), DatesChart (one address's result mix on each date) and BarChart (one series, sorted).
import type { Dict } from "../i18n";
import type { LookupResult } from "../types";
import type { Geo, Metro } from "../visual";

export type DotTone = "on" | "off" | "flag";
export interface Dot { id: string; x: number; y: number; tone: DotTone; tip: string }

export function MetroMap({ metro, dots, selected, title, tr }: { metro: Metro; dots: Dot[]; selected?: Dot | null; title?: string; tr: Dict }) {
  const on = dots.filter((d) => d.tone !== "off").length;
  return (
    <figure className="rr-map">
      <svg viewBox={`0 0 ${metro.w} ${metro.h}`} role="img" aria-label={`${title ?? metro.name}: ${tr.mapAria(dots.length, on)}`}>
        <rect width={metro.w} height={metro.h} className="rr-map-water" />
        {metro.counties.map((c, i) => (
          <path key={i} d={c.d} className={c.home ? "rr-map-land" : "rr-map-land is-other"}><title>{c.name}</title></path>
        ))}
        {dots.filter((d) => d.tone === "off").map((d) => (
          <circle key={d.id} cx={d.x} cy={d.y} r={2.6} className="rr-dot is-off"><title>{d.tip}</title></circle>
        ))}
        {dots.filter((d) => d.tone !== "off").map((d) =>
          d.tone === "flag" ? (
            <rect key={d.id} x={d.x - 3} y={d.y - 3} width={6} height={6} transform={`rotate(45 ${d.x} ${d.y})`} className="rr-dot is-flag"><title>{d.tip}</title></rect>
          ) : (
            <circle key={d.id} cx={d.x} cy={d.y} r={3.2} className="rr-dot is-on"><title>{d.tip}</title></circle>
          ),
        )}
        {metro.places.map((p) => (
          <text key={p.name} x={p.x} y={p.y - 10} textAnchor="middle" className="rr-map-place">{p.name}</text>
        ))}
        {selected && (
          <g className="rr-map-sel">
            <circle cx={selected.x} cy={selected.y} r={14} className="rr-map-halo" />
            <circle cx={selected.x} cy={selected.y} r={6} className="rr-map-pin"><title>{selected.tip}</title></circle>
          </g>
        )}
        <g transform={`translate(${metro.w - 14 - metro.scale.px} ${metro.h - 12})`} className="rr-map-scale">
          <line x1={0} x2={metro.scale.px} y1={0} y2={0} />
          <text x={metro.scale.px / 2} y={-5} textAnchor="middle">{metro.scale.km} km</text>
        </g>
      </svg>
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
}

/** Small multiples: one map per metro, a shared legend. `tone` decides each address's mark. */
export function MetroGrid({ geo, metroIds, tone, tip, legend, tr }: {
  geo: Geo;
  metroIds?: string[];
  tone: (id: string) => DotTone;
  tip: (id: string) => string;
  legend: [DotTone, string][];
  tr: Dict;
}) {
  const metros = geo.metros.filter((m) => !metroIds || metroIds.includes(m.id));
  return (
    <div className="rr-mapgrid">
      <ul className="rr-map-legend">
        {legend.map(([t, label]) => <li key={t}><i className={`rr-mkey is-${t}`} aria-hidden /> {label}</li>)}
        <li className="rr-muted">{tr.mapApprox}</li>
      </ul>
      <div className={`rr-mapgrid-maps n${Math.min(metros.length, 3)}`}>
        {metros.map((m) => {
          const dots = Object.entries(geo.points)
            .filter(([, p]) => p.m === m.id)
            .map(([id, p]) => ({ id, x: p.x, y: p.y, tone: tone(id), tip: tip(id) }));
          return <MetroMap key={m.id} metro={m} dots={dots} title={m.name} tr={tr} />;
        })}
      </div>
    </div>
  );
}

export function Kpis({ items }: { items: { value: string | number; label: string; note?: string; tone?: "warn" }[] }) {
  return (
    <dl className="rr-kpis">
      {items.map((k) => (
        <div key={k.label} className={k.tone === "warn" ? "is-warn" : ""}>
          <dt>{k.label}</dt>
          <dd>{k.value}{k.note && <small>{k.note}</small>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One address: the result mix on each precomputed date, the selected date marked. */
export function DatesChart({ order, dates, rows, current, onPick, tr }: {
  order: LookupResult[];
  dates: string[];
  rows: number[][];
  current: string;
  onPick?: (d: string) => void;
  tr: Dict;
}) {
  const max = Math.max(1, ...rows.map((r) => order.reduce((s, _, i) => s + r[i]!, 0)));
  const used = order.filter((_, i) => rows.some((r) => r[i]! > 0));
  return (
    <figure className="rr-dchart">
      <figcaption className="rr-dchart-h">{tr.datesChartTitle}</figcaption>
      <ul className="rr-dchart-legend">
        {used.map((k) => <li key={k}><i className={`rr-seg-key rr-seg-${k}`} aria-hidden /> {tr.result[k]}</li>)}
      </ul>
      <ol className="rr-dchart-rows">
        {dates.map((d, di) => {
          const r = rows[di] ?? [];
          const total = order.reduce((s, _, i) => s + (r[i] ?? 0), 0);
          const tip = order.filter((_, i) => r[i]).map((k) => `${r[order.indexOf(k)]} ${tr.result[k]}`).join(", ");
          return (
            <li key={d} className={d === current ? "is-current" : ""}>
              <button type="button" disabled={!onPick} onClick={() => onPick?.(d)} aria-pressed={d === current} title={tip}>
                <span className="rr-mono rr-dchart-d">{d}</span>
                <span className="rr-dchart-bar" style={{ width: `${(total / max) * 100}%` }}>
                  {order.map((k, i) => (r[i] ? <span key={k} className={`rr-seg rr-seg-${k}`} style={{ flexGrow: r[i] }} /> : null))}
                </span>
                <span className="rr-dchart-n">{total}{r[order.length] ? <small> · ▲{r[order.length]}</small> : null}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="rr-sr"><table>
        <caption>{tr.datesChartTitle}</caption>
        <thead><tr><th>{tr.asOf}</th>{order.map((k) => <th key={k}>{tr.result[k]}</th>)}<th>{tr.needsReview}</th></tr></thead>
        <tbody>{dates.map((d, di) => <tr key={d}><th>{d}</th>{(rows[di] ?? []).map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}

/** One series of magnitudes, sorted, value at the bar tip. */
export function BarChart({ title, rows, note }: { title: string; rows: { label: string; value: number; sub?: string }[]; note?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="rr-bars">
      <figcaption className="rr-dchart-h">{title}</figcaption>
      <ol>
        {rows.map((r) => (
          <li key={r.label} title={`${r.label}: ${r.value}`}>
            <span className="rr-bars-l">{r.label}{r.sub && <small> {r.sub}</small>}</span>
            <span className="rr-bars-track"><span className="rr-bars-bar" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="rr-bars-v">{r.value}</span>
          </li>
        ))}
      </ol>
      {note && <p className="rr-meta">{note}</p>}
    </figure>
  );
}
