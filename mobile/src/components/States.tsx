// States.tsx: loading and data-load error screens.
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { color, radius, space } from "../theme";
import { t } from "../i18n";
import { m as mt } from "../strings";
import type { Lang } from "../types";
import { HouseMark } from "./Icons";
import { Button, StateBlock, T } from "./ui";

/** Skeleton rows shaped like address rows. Static (no shimmer) so it respects reduced motion by default. */
export function LoadingState({ label }: { label: string }) {
  return (
    <View style={{ padding: space.lg, gap: space.md }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <T muted>{label}</T>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ height: 68, borderRadius: radius.lg, backgroundColor: color.surface, padding: space.md, gap: 8, opacity: 1 - i * 0.18 }}>
          <View style={{ width: 54, height: 14, borderRadius: 4, backgroundColor: color.tint }} />
          <View style={{ width: "70%", height: 14, borderRadius: 4, backgroundColor: color.line }} />
        </View>
      ))}
    </View>
  );
}

export function BrokenDocArt() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24">
      <Path d="M6 3.5H14L18.5 8V20.5H6Z" stroke={color.danger} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path d="M9 11L15 17M15 11L9 17" stroke={color.danger} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function LoadErrorScreen({ message, onRetry, lang }: { message: string | null; onRetry: () => void; lang: Lang }) {
  const tr = t(lang);
  // Technical detail stays out of the UI; logged for developers only.
  if (message && typeof console !== "undefined") console.warn("[data]", message);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.paper, padding: space.xl, paddingTop: space.xxxl * 2 }}>
      <View style={{ alignItems: "center", marginBottom: space.md }}><HouseMark size={32} /></View>
      <StateBlock art={<BrokenDocArt />} title={mt(lang).loadFriendly} action={<View style={{ alignSelf: "stretch", marginTop: space.md }}><Button label={tr.retry} onPress={onRetry} /></View>} />
      <T variant="small" muted style={{ textAlign: "center" }}>{tr.notAdvice}</T>
    </SafeAreaView>
  );
}
