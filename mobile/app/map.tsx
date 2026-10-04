// map.tsx: full-screen area map opened from an address's mini-map: every sample address in the same legal
// jurisdiction as a dot (the opened one in marigold). Tap a dot → card with its rule count → open it.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PointsMap, type MapPoint } from "../src/components/Maps";
import { PointCard } from "../src/components/PointCard";
import { T } from "../src/components/ui";
import { usePrefs } from "../src/prefs";
import { chartBar, color, minTouch, space } from "../src/theme";

export default function AreaMap() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const { ms, data, asOf } = usePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<string | null>(address ?? null);
  const j = address ? data.jurisdictions[address]?.jurisdiction : undefined;
  const g = address ? data.geo[address] : undefined;
  const points: MapPoint[] = data.addresses
    .filter((a) => data.jurisdictions[a.address_id]?.jurisdiction === j)
    .flatMap((a) => {
      const p = data.geo[a.address_id];
      return p ? [{ id: a.address_id, lat: p[0], lon: p[1], fill: a.address_id === address ? color.accentBrand : chartBar }] : [];
    });
  const tagOf = (id: string) => {
    const items = data.lookups[asOf]?.[id] ?? [];
    return ms.rulesHere(items.length, items.filter((i) => i.result === "unknown").length);
  };
  const openAddress = (id: string) => {
    router.back();
    // Same address: going back is enough. Another one: open it on top of the current stack.
    if (id !== address) setTimeout(() => router.push(`/search/${id}`), 50);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.paper, paddingBottom: Math.max(insets.bottom, space.md) }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <T variant="title" serif accessibilityRole="header">{j ?? ms.where}</T>
          {j ? <T variant="micro" muted>≈ {ms.areaTitle(j)} · {points.length}</T> : null}
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={ms.done} style={{ minHeight: minTouch, minWidth: minTouch, justifyContent: "center", alignItems: "flex-end" }}>
          <Text style={{ color: color.primary, fontWeight: "800" }}>{ms.done}</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, paddingHorizontal: space.md, gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <PointsMap points={points} selected={sel} onSelect={setSel} height="100%"
            focus={g ? { lat: g[0], lon: g[1], delta: 0.12 } : undefined} />
        </View>
        {sel ? <PointCard id={sel} tag={tagOf(sel)} tagColor={sel === address ? color.accentBrand : chartBar} onOpen={() => openAddress(sel)} onClose={() => setSel(null)} /> : <T variant="micro" muted>{ms.mapHint}</T>}
      </View>
    </View>
  );
}
