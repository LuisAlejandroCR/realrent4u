// Chrome.tsx: EN/ES toggle (profile sheet) and the legal notice + as-of date strip shown on every screen.
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptic } from "../feel";
import { usePrefs } from "../prefs";
import { color, minTouch, radius, space, type } from "../theme";
import { CalendarIcon } from "./Icons";

/** EN/ES segmented toggle. Each segment is a full touch target. */
export function LangToggle() {
  const { lang, setLang, tr } = usePrefs();
  return (
    <View style={st.lang} accessibilityRole="radiogroup" accessibilityLabel={tr.language}>
      {(["en", "es"] as const).map((l) => (
        <Pressable
          key={l}
          accessibilityRole="radio"
          accessibilityLabel={l === "en" ? "English" : "Español"}
          accessibilityState={{ selected: lang === l, checked: lang === l }}
          onPress={() => setLang(l)}
          style={[st.seg, lang === l && { backgroundColor: color.ink }]}
        >
          <Text maxFontSizeMultiplier={1.4} style={{ fontWeight: "800", ...type.small, color: lang === l ? color.surface : color.ink2 }}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The ONLY place the as-of date appears on a screen: compact chip beside the legal notice.
 * In normal flow, so it never covers content.
 */
export function LegalDateBar() {
  const { tr, asOf, ms } = usePrefs();
  const router = useRouter();
  return (
    <View style={st.bar}>
      <View style={st.advice} accessible accessibilityLabel={tr.notAdvice}>
        <Text style={st.adviceGlyph}>§</Text>
        <Text maxFontSizeMultiplier={1.6} style={{ color: color.accent, fontWeight: "700", ...type.micro }}>{tr.notAdvice}</Text>
      </View>
      <Pressable
        onPress={() => { haptic.tap(); router.push("/date"); }}
        accessibilityRole="button"
        accessibilityLabel={`${tr.asOf} ${asOf}, ${ms.selected}`}
        accessibilityHint={ms.openDatePicker}
        hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }} // 26 + 22 = 48 tall (iOS 44 / Android 48)
        style={st.date}
      >
        <CalendarIcon color={color.primary} size={14} />
        <Text maxFontSizeMultiplier={1.6} style={{ color: color.ink, fontWeight: "700", ...type.micro }}>{asOf}</Text>
        <Text style={{ color: color.primary, fontWeight: "800" }}>▾</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  lang: { flexDirection: "row", borderWidth: 1, borderColor: color.line, borderRadius: radius.pill, overflow: "hidden", backgroundColor: color.surface },
  seg: { minWidth: minTouch, minHeight: minTouch - 8, alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 2, backgroundColor: color.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  advice: { flexDirection: "row", alignItems: "center", gap: 6 },
  adviceGlyph: { color: color.accent, fontWeight: "800", fontSize: 14 },
  date: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.sm, marginVertical: 2, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
});
