// date.tsx: 05 date picker sheet; lists manifest dates and marks those without precomputed results.
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarIcon } from "../src/components/Icons";
import { T } from "../src/components/ui";
import { allDates } from "../src/data";
import { isAndroid, preview } from "../src/platform";
import SearchScreen from "./(tabs)/search/index";
import { usePrefs } from "../src/prefs";
import { color, font, minTouch, radius, space } from "../src/theme";

/**
 * 05 Choose a date — sheet sized to its content. Only manifest dates; each row states whether results
 * were precomputed. iOS: checkmark; Android: Material radio. Dismissing keeps the current date.
 */
export default function DateSheet() {
  const { tr, ms, data, asOf, setAsOf } = usePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lookupDates = new Set(data.manifest.lookup_dates);
  const sheet = (
    <View style={{ backgroundColor: color.surface, paddingTop: space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.xl }}>
        <CalendarIcon color={color.primary} size={22} />
        <T variant="title" serif accessibilityRole="header" style={{ flex: 1 }}>{ms.dateTitle}</T>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: minTouch, minWidth: minTouch, justifyContent: "center", alignItems: "flex-end" }}>
          <Text style={{ color: color.primary, fontWeight: "800" }}>{ms.done}</Text>
        </Pressable>
      </View>
      <T variant="small" muted style={{ paddingHorizontal: space.xl, marginBottom: space.md }}>{ms.dateFooter}</T>
      <View accessibilityRole="radiogroup" style={{ marginHorizontal: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, overflow: "hidden" }}>
        {allDates(data.manifest).map((d, i) => {
          const on = d === asOf;
          const has = lookupDates.has(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on }}
              accessibilityLabel={`${d}${on ? `, ${ms.selected}` : ""}, ${has ? ms.dateHasResults : ms.dateNoResults}`}
              onPress={() => { setAsOf(d); router.back(); }}
              android_ripple={{ color: color.tint }}
              style={{ minHeight: minTouch + 14, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, backgroundColor: on ? color.primaryTint : color.surface, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}
            >
              {isAndroid && (
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? color.primary : color.ink2, alignItems: "center", justifyContent: "center" }}>
                  {on && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color.primary }} />}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.mono, fontSize: 16, fontWeight: on ? "800" : "500", color: on ? color.primary : color.ink }}>{d}</Text>
                <T variant="small" muted>{has ? ms.dateHasResults : `○ ${ms.dateNoResults}`}</T>
              </View>
              {on && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: color.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  {!isAndroid && <Text style={{ color: color.onPrimary, fontWeight: "800" }}>✓</Text>}
                  <Text style={{ color: color.onPrimary, fontWeight: "800", fontSize: 12 }}>{ms.selected}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <T variant="small" muted style={{ paddingHorizontal: space.xl, marginTop: space.md }}>{tr.asOfHelp}</T>
    </View>
  );
  if (!preview.frame) return sheet; // devices: the native formSheet supplies backdrop, grabber and corners
  // Web screenshot only: draw the real Search screen beneath a light scrim, as the native sheet would.
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none"><SearchScreen /></View>
      <View style={{ flex: 1, backgroundColor: "rgba(22,35,58,0.28)" }} />
      <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", backgroundColor: color.surface }}>
        <View style={{ alignItems: "center", paddingTop: 8 }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: color.line }} /></View>
        {sheet}
      </View>
    </View>
  );
}
