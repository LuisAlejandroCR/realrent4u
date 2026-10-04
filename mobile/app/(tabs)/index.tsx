// index.tsx: 01 Home tab: brand, headline, primary search action and one real example (A0036).
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LangToggle, LegalDateBar } from "../../src/components/Chrome";
import { HouseMark, SearchIcon } from "../../src/components/Icons";
import { Card, Kicker, Mark, Notice, T } from "../../src/components/ui";
import { usePrefs } from "../../src/prefs";
import { color, minTouch, radius, shadow, space } from "../../src/theme";

/** 01 Home — identity, the question, one dominant action (search), real-data example. */
export default function Home() {
  const { tr, ms, data } = usePrefs();
  const router = useRouter();
  const n = data.addresses.length;
  const a = data.addresses.find((x) => x.address_id === "A0036");
  const j = a ? data.jurisdictions[a.address_id] : undefined;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }} accessible accessibilityRole="header" accessibilityLabel="RealRent4U">
          <HouseMark size={30} />
          <T bold style={{ fontSize: 18 }}>RealRent<T bold style={{ fontSize: 18, color: color.accent }}>4U</T></T>
        </View>
        <LangToggle />
      </View>
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.lg, paddingTop: space.md, gap: space.sm + 2, paddingBottom: space.xxl }}>
        <Kicker>{tr.heroKicker}</Kicker>
        <T variant="display" serif accessibilityRole="header" style={{ fontSize: 26, lineHeight: 31 }}>
          {tr.heroTitle2} <Mark variant="display" style={{ fontSize: 26, lineHeight: 31 }}>{tr.heroTitle2Em}</Mark>
        </T>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel={tr.ctaSearchShort}
          accessibilityHint={tr.searchHelp}
          onPress={() => router.replace("/search?focus=1")}
          style={[{ minHeight: minTouch + 28, marginTop: space.xs, borderRadius: radius.lg, backgroundColor: color.primary, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg }, shadow]}
        >
          <SearchIcon color={color.onPrimary} />
          <View style={{ flex: 1 }}>
            <T bold style={{ color: color.onPrimary, fontSize: 18 }}>{tr.ctaSearchShort}</T>
            <T variant="small" style={{ color: color.onPrimary, opacity: 0.9 }}>{tr.searchPlaceholder}</T>
          </View>
        </Pressable>

        <T variant="small" muted>{ms.appIntro}</T>

        {a && j && (
          <Pressable onPress={() => router.push(`/search/${a.address_id}`)} accessibilityRole="link" accessibilityLabel={`${tr.exampleFromData}: ${a.street_address}, ${tr.legalJurisdiction} ${j.jurisdiction}`}>
          <Card flat style={{ gap: 2, paddingVertical: space.sm, paddingHorizontal: space.md, borderLeftWidth: 3, borderLeftColor: color.accentBrand }}>
            <T variant="micro" muted>{tr.exampleFromData}</T>
            <T variant="small" bold numberOfLines={1}>{a.street_address}, {a.postal_city}</T>
            {j.place !== a.postal_city ? (
              <T variant="small" style={{ color: color.accent, fontWeight: "700" }}>≠ {tr.legalJurisdiction}: {j.jurisdiction}</T>
            ) : (
              <T variant="small" muted>{tr.legalJurisdiction}: {j.jurisdiction}</T>
            )}
          </Card>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />

        <T variant="small" muted style={{ textAlign: "center" }}>{ms.sampleCount(n)}</T>
        {data.manifest.uses_fixtures && <Notice tone="warn" title={tr.fixtures}>{tr.fixturesBody}</Notice>}
      </ScrollView>
    </SafeAreaView>
  );
}
