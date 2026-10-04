// Maps.tsx: native maps (react-native-maps; Apple Maps on iOS, Google on Android, both in Expo Go).
// LocationMap = one approximate area, never a pin on a rooftop. PointsMap = scenario dots, tap to open.
// Web preview uses Maps.web.tsx (same exports).
import { useRef } from "react";
import { View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { color, radius } from "../theme";
import { MapLabel } from "./MapLabel";

export { MapLabel };

export interface MapPoint { id: string; lat: number; lon: number; fill: string; ring?: string }

/** Approximate location: a soft circle (~150 m for street matches, ~2 km for city-area fallbacks). Static. */
export function LocationMap({ lat, lon, area, label }: { lat: number; lon: number; area: boolean; label: string }) {
  const delta = area ? 0.09 : 0.014;
  return (
    <View style={{ height: 150, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta }}
        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
        toolbarEnabled={false} liteMode pointerEvents="none"
      >
        <Circle center={{ latitude: lat, longitude: lon }} radius={area ? 2000 : 150} fillColor="rgba(41,73,168,0.18)" strokeColor={color.primary} strokeWidth={2} />
      </MapView>
      <MapLabel text={label} />
    </View>
  );
}

/** Scenario map: one dot per address; fits all points; tapping a dot opens that address. */
export function PointsMap({ points, onPress, height = 240 }: { points: MapPoint[]; onPress: (id: string) => void; height?: number }) {
  const ref = useRef<MapView>(null);
  if (!points.length) return null;
  const fit = () => ref.current?.fitToCoordinates(points.map((p) => ({ latitude: p.lat, longitude: p.lon })), { edgePadding: { top: 30, right: 30, bottom: 30, left: 30 }, animated: false });
  return (
    <View style={{ height, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: color.line }}>
      <MapView ref={ref} style={{ flex: 1 }} onMapReady={fit} toolbarEnabled={false} rotateEnabled={false} pitchEnabled={false}
        initialRegion={{ latitude: points[0].lat, longitude: points[0].lon, latitudeDelta: 1, longitudeDelta: 1 }}>
        {points.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lon }} tracksViewChanges={false} onPress={() => onPress(p.id)} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.fill, borderWidth: 2, borderColor: p.ring ?? color.surface }} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
