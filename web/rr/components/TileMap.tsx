"use client";
// TileMap.tsx: a real street map (Leaflet + OpenStreetMap tiles, muted), like the mobile app's maps. Points are
// rounded to ~1 km; an address shows as a soft "approximate" circle, never a pin. A dot selects, a card opens it.
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Dict } from "../i18n";

export type TileTone = "on" | "off" | "flag";
/** r: radius in px for a bubble (size = a count); default dot size otherwise. */
export interface TilePoint { id: string; lat: number; lon: number; tone: TileTone; title: string; sub?: string; r?: number }

const FILL: Record<TileTone, string> = { on: "#2949a8", flag: "#b86a0e", off: "#ffffff" };

export function TileMap({ points, area, label, href, onOpen, openLabel, height = 280, tr }: {
  points: TilePoint[];
  /** Approximate location of the address being viewed: a soft circle. */
  area?: { lat: number; lon: number } | null;
  label: string;
  href?: (id: string) => string;
  onOpen?: (id: string) => void;
  /** Text of the card's link; "Open" by default. */
  openLabel?: string;
  height?: number;
  tr: Dict;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const key = points.map((p) => `${p.id}${p.tone}`).join() + (area ? `${area.lat},${area.lon}` : "");

  useEffect(() => {
    let live = true;
    import("leaflet").then((L) => {
      if (!live || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.5 });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 17,
        }).addTo(map.current);
        map.current.on("click", () => setSel(null));
      }
      const m = map.current;
      layer.current?.remove();
      const g = L.layerGroup().addTo(m);
      layer.current = g;
      if (area) {
        L.circle([area.lat, area.lon], { radius: 1200, color: "#2949a8", weight: 2, fillColor: "#2949a8", fillOpacity: 0.18, interactive: false }).addTo(g);
      }
      // Unaffected first, so the dots that matter sit on top.
      const order: TileTone[] = ["off", "on", "flag"];
      for (const t of order) {
        for (const p of points.filter((q) => q.tone === t)) {
          L.circleMarker([p.lat, p.lon], {
            radius: p.r ?? (t === "off" ? 5 : 7),
            color: t === "off" ? "#8b93a6" : "#ffffff",
            weight: 2,
            fillColor: FILL[t],
            fillOpacity: p.r ? 0.6 : 0.95,
          })
            .bindTooltip(p.title, { direction: "top", offset: [0, -6] })
            .on("click", (e) => {
              e.originalEvent?.stopPropagation();
              L.DomEvent.stop(e);
              setSel(p.id);
            })
            .addTo(g);
        }
      }
      const ll = [...points.map((p) => [p.lat, p.lon] as [number, number]), ...(area ? [[area.lat, area.lon] as [number, number]] : [])];
      if (ll.length === 1 || (area && points.length === 0)) m.setView(ll[0]!, 13);
      else if (ll.length) m.fitBounds(L.latLngBounds(ll), { padding: [24, 24], maxZoom: 14 });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  const p = points.find((q) => q.id === sel);
  return (
    <figure className="rr-tmap">
      <div ref={box} className="rr-tmap-box" style={{ height }} role="img" aria-label={label} />
      <span className="rr-tmap-tag" aria-hidden>{tr.mapApprox}</span>
      {p && (
        <div className="rr-tmap-card" role="status">
          <i className={`rr-mkey is-${p.tone}`} aria-hidden />
          <span className="rr-tmap-card-t"><strong>{p.title}</strong>{p.sub && <small>{p.sub}</small>}</span>
          {href && (
            <a
              className="rr-btn-mini"
              href={href(p.id)}
              onClick={(e) => {
                if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                setSel(null);
                onOpen(p.id);
              }}
            >
              {openLabel ?? tr.mapOpen} →
            </a>
          )}
          <button type="button" className="rr-tmap-x" aria-label={tr.mapClose} onClick={() => setSel(null)}>×</button>
        </div>
      )}
    </figure>
  );
}
