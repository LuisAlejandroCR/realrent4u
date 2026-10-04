// Maps.tsx: native maps (react-native-maps; Apple Maps on iOS, Google on Android, both in Expo Go).
// LocationMap = one approximate area, never a pin on a rooftop. PointsMap = scenario dots, tap to open.
// Web preview uses Maps.web.tsx (same exports).
import { useRef } from "react";
import { Pressable, View } from "react-native";
import { haptic } from "../feel";
import MapView, { Circle, Marker } from "react-native-maps";
import { color, radius } from "../theme";
import { MapLabel } from "./MapLabel";

export { MapLabel };

/** size = dot diameter in px (bubbles); default 14. */
export interface MapPoint { id: string; lat: number; lon: number; fill: string; ring?: string; size?: number }

/** Approximate location: a soft circle (~150 m for street matches, ~2 km for city-area fallbacks). Static. */
export function LocationMap({ lat, lon, area, label, onPress, hint }: { lat: number; lon: number; area: boolean; label: string; onPress?: () => void; hint?: string }) {
  const delta = area ? 0.09 : 0.014;
  return (
    <Pressable onPress={() => { haptic.tap(); onPress?.(); }} disabled={!onPress} accessibilityRole={onPress ? "button" : "image"} accessibilityLabel={label} accessibilityHint={hint}
      style={{ height: 150, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta }}
        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
        toolbarEnabled={false} liteMode pointerEvents="none"
      >
        <Circle center={{ latitude: lat, longitude: lon }} radius={area ? 2000 : 150} fillColor="rgba(41,73,168,0.18)" strokeColor={color.primary} strokeWidth={2} />
      </MapView>
      <MapLabel text={label} />
      {onPress ? <MapLabel text="⤢" corner /> : null}
    </Pressable>
  );
}

/**
 * Dot map: one dot per address. Tapping a dot SELECTS it (bigger, ink ring) and the parent shows a card;
 * tapping the map background clears the selection. Fits all points unless `focus` sets the region.
 */
export function PointsMap({ points, selected, onSelect, height = 240, focus }: {
  points: MapPoint[]; selected?: string | null; onSelect: (id: string | null) => void; height?: number | "100%";
  focus?: { lat: number; lon: number; delta: number };
}) {
  const ref = useRef<MapView>(null);
  if (!points.length) return null;
  const fit = () => !focus && ref.current?.fitToCoordinates(points.map((p) => ({ latitude: p.lat, longitude: p.lon })), { edgePadding: { top: 30, right: 30, bottom: 30, left: 30 }, animated: false });
  const sel = points.find((p) => p.id === selected);
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line }}>
      <MapView ref={ref} style={{ flex: 1 }} onMapReady={fit} toolbarEnabled={false} rotateEnabled={false} pitchEnabled={false}
        onPress={(e) => { if (e.nativeEvent.action !== "marker-press") onSelect(null); }}
        initialRegion={focus ? { latitude: focus.lat, longitude: focus.lon, latitudeDelta: focus.delta, longitudeDelta: focus.delta } : { latitude: points[0].lat, longitude: points[0].lon, latitudeDelta: 1, longitudeDelta: 1 }}>
        {points.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lon }} tracksViewChanges={false} onPress={() => { haptic.select(); onSelect(p.id); }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: p.size ?? 14, height: p.size ?? 14, borderRadius: (p.size ?? 14) / 2, backgroundColor: p.fill, borderWidth: 2, borderColor: p.ring ?? color.surface, opacity: p.size ? 0.85 : 1 }} />
          </Marker>
        ))}
        {/* The selected dot is its own marker (new key) so it re-renders even with tracksViewChanges off. */}
        {sel && (
          <Marker key={`sel-${sel.id}`} coordinate={{ latitude: sel.lat, longitude: sel.lon }} anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
            <View style={{ width: (sel.size ?? 14) + 10, height: (sel.size ?? 14) + 10, borderRadius: ((sel.size ?? 14) + 10) / 2, backgroundColor: sel.fill, borderWidth: 4, borderColor: color.ink }} />
          </Marker>
        )}
      </MapView>
    </View>
  );
}
