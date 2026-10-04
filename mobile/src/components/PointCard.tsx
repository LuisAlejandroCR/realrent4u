// PointCard.tsx: the card under a map when a dot is selected: address, postal → legal jurisdiction, a status tag
// and an Open action. Shared by the scenario map and the full-screen area map.
import { Text, View } from "react-native";
import { usePrefs } from "../prefs";
import { color, radius, shadow, space } from "../theme";
import { Button, Id, T } from "./ui";
import { FadeIn, Tap } from "./motion";

export function PointCard({ id, tag, tagColor, onOpen, onClose }: { id: string; tag?: string; tagColor?: string; onOpen: () => void; onClose: () => void }) {
  const { data, ms } = usePrefs();
  const a = data.addresses.find((x) => x.address_id === id);
  if (!a) return null;
  const j = data.jurisdictions[id];
  const differs = !!(j?.place && j.place !== a.postal_city);
  return (
    // key=id: a new selection re-runs the entrance.
    <FadeIn key={id} style={[{ gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.ink }, shadow]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <Id>{id}</Id>
            {tag ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tagColor ?? color.ink2 }} />
                <Text maxFontSizeMultiplier={1.4} style={{ fontSize: 12, fontWeight: "700", color: color.ink }}>{tag}</Text>
              </View>
            ) : null}
          </View>
          <T bold numberOfLines={1}>{a.street_address}</T>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {differs ? <T variant="small" muted style={{ textDecorationLine: "line-through" }}>{a.postal_city}</T> : null}
            {differs ? <T variant="small" muted>→</T> : null}
            <T variant="small" bold>{j?.jurisdiction ?? a.postal_city}</T>
          </View>
        </View>
        <Tap onPress={onClose} feel="select" accessibilityLabel={ms.close} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: color.ink2, fontSize: 18, fontWeight: "700" }}>✕</Text>
        </Tap>
      </View>
      <Button label={ms.openAddress} onPress={onOpen} />
    </FadeIn>
  );
}
