// Maps.web.tsx: web-preview stand-ins for Maps.tsx (react-native-maps has no web build). LocationMap embeds an
// OpenStreetMap view of the approximate area; PointsMap draws the dots on a plain projected plot. Same exports.
import { createElement } from "react";
import { View } from "react-native";
import { color, radius } from "../theme";
import { MapLabel } from "./MapLabel";

export interface MapPoint { id: string; lat: number; lon: number; fill: string; ring?: string }
export { MapLabel };

export function LocationMap({ lat, lon, area, label }: { lat: number; lon: number; area: boolean; label: string }) {
  const d = area ? 0.05 : 0.008;
  const bbox = [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d].join(",");
  return (
    <View style={{ height: 150, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line }} accessibilityRole="image" accessibilityLabel={label}>
      {createElement("iframe", {
        title: label,
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`,
        style: { border: 0, width: "100%", height: "100%", pointerEvents: "none" },
        loading: "lazy",
      })}
      <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", width: area ? 90 : 36, height: area ? 90 : 36, marginLeft: area ? -45 : -18, marginTop: area ? -45 : -18, borderRadius: 999, backgroundColor: "rgba(41,73,168,0.18)", borderWidth: 2, borderColor: color.primary }} />
      <MapLabel text={label} />
    </View>
  );
}

export function PointsMap({ points, onPress, height = 240 }: { points: MapPoint[]; onPress: (id: string) => void; height?: number }) {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const k = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180));
  const [x0, x1, y0, y1] = [Math.min(...lons) * k, Math.max(...lons) * k, Math.min(...lats), Math.max(...lats)];
  const W = 340, H = height, pad = 16;
  const s = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line, backgroundColor: "#EEF1F5" }}>
      {/* Plain DOM svg on web: react-native-svg's onPress leaks responder props into the DOM. */}
      {createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${W} ${H}`, role: "img" },
        points.map((p) => createElement("circle", {
          key: p.id, cx: ox + (p.lon * k - x0) * s, cy: H - (oy + (p.lat - y0) * s), r: 5,
          fill: p.fill, stroke: p.ring ?? color.surface, strokeWidth: 2, style: { cursor: "pointer" },
          onClick: () => onPress(p.id),
        })))}
    </View>
  );
}
