// MapLabel.tsx: the "≈ approximate" caption chip drawn over every map (native and web).
import { Text, View } from "react-native";
import { color, radius, space } from "../theme";

export function MapLabel({ text }: { text: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: space.sm, bottom: space.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.92)" }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, fontWeight: "700", color: color.ink }}>≈ {text}</Text>
    </View>
  );
}
