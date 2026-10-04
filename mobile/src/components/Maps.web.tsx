// Maps.web.tsx: web-preview stand-ins for Maps.tsx (react-native-maps has no web build). LocationMap embeds an
// OpenStreetMap view of the approximate area; PointsMap draws the dots on a plain projected plot. Same exports.
import { createElement } from "react";
import { Pressable, View } from "react-native";
import { color, radius } from "../theme";
import { MapLabel } from "./MapLabel";

/** size = dot diameter in px (bubbles); default 14. */
export interface MapPoint { id: string; lat: number; lon: number; fill: string; ring?: string; size?: number }
export { MapLabel };

export function LocationMap({ lat, lon, area, label, onPress, hint }: { lat: number; lon: number; area: boolean; label: string; onPress?: () => void; hint?: string }) {
  const d = area ? 0.05 : 0.008;
  const bbox = [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d].join(",");
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : "image"} accessibilityLabel={label} accessibilityHint={hint} style={{ height: 150, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line }}>
      {createElement("iframe", {
        title: label,
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`,
        style: { border: 0, width: "100%", height: "100%", pointerEvents: "none" },
        loading: "lazy",
      })}
      <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", width: area ? 90 : 36, height: area ? 90 : 36, marginLeft: area ? -45 : -18, marginTop: area ? -45 : -18, borderRadius: 999, backgroundColor: "rgba(41,73,168,0.18)", borderWidth: 2, borderColor: color.primary }} />
      <MapLabel text={label} />
      {onPress ? <MapLabel text="⤢" corner /> : null}
    </Pressable>
  );
}

export function PointsMap({ points, selected, onSelect, height = 240 }: {
  points: MapPoint[]; selected?: string | null; onSelect: (id: string | null) => void; height?: number | "100%";
  focus?: { lat: number; lon: number; delta: number };
}) {
  if (!points.length) return null;
  // Selected dot drawn last so it sits on top.
  const ordered = [...points.filter((p) => p.id !== selected), ...points.filter((p) => p.id === selected)];
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180));
  const [x0, x1, y0, y1] = [Math.min(...lons) * k, Math.max(...lons) * k, Math.min(...lats), Math.max(...lats)];
  const W = 340, H = typeof height === "number" ? height : 480, pad = 16;
  const s = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line, backgroundColor: "#EEF1F5" }}>
      {/* Plain DOM svg on web: react-native-svg's onPress leaks responder props into the DOM. */}
      {createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${W} ${H}`, role: "img", onClick: () => onSelect(null) },
        ordered.map((p) => createElement("circle", {
          key: p.id, cx: ox + (p.lon * k - x0) * s, cy: H - (oy + (p.lat - y0) * s), r: (p.size ? p.size / 3 : 5) + (p.id === selected ? 4 : 0), fillOpacity: p.size ? 0.85 : 1,
          fill: p.fill, stroke: p.id === selected ? color.ink : p.ring ?? color.surface, strokeWidth: p.id === selected ? 3 : 2,
          style: { cursor: "pointer" }, "data-id": p.id,
          onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(p.id); },
        })))}
    </View>
  );
}
