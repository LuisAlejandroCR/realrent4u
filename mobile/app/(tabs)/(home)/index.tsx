// index.tsx: 01 Home tab: brand, headline, one dominant search action, three real "tricky" addresses
// as quick wins, and the case-file strip that tracks exploration stamps.
import { Stack, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalDateBar } from "../../../src/components/Chrome";
import { HouseMark, SearchIcon } from "../../../src/components/Icons";
import { FadeIn, Tap } from "../../../src/components/motion";
import { CaseFileStrip, ProfileButton, QuickWins } from "../../../src/components/Story";
import { Kicker, Mark, Notice, T } from "../../../src/components/ui";
import { usePrefs } from "../../../src/prefs";
import { color, minTouch, radius, shadow, space } from "../../../src/theme";

/** 01 Home — identity, the question, one dominant action (search), stories to try, progress. */
export default function Home() {
  const { tr, ms, data } = usePrefs();
  const router = useRouter();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.paper }}>
      <Stack.Screen options={{ headerShown: false, title: ms.tabHome }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }} accessible accessibilityRole="header" accessibilityLabel="RealRent4U">
          <HouseMark size={30} />
          <T bold style={{ fontSize: 18 }}>RealRent<T bold style={{ fontSize: 18, color: color.accent }}>4U</T></T>
        </View>
        <ProfileButton />
      </View>
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.lg, paddingTop: space.md, gap: space.md, paddingBottom: space.xxl }}>
        <FadeIn index={0} style={{ gap: space.xs }}>
          <Kicker>{tr.heroKicker}</Kicker>
          <T variant="display" serif accessibilityRole="header" style={{ fontSize: 26, lineHeight: 31 }}>
            {tr.heroTitle2} <Mark variant="display" style={{ fontSize: 26, lineHeight: 31 }}>{tr.heroTitle2Em}</Mark>
          </T>
        </FadeIn>

        <FadeIn index={1}>
          <Tap
            accessibilityRole="search"
            accessibilityLabel={tr.ctaSearchShort}
            accessibilityHint={tr.searchHelp}
            // Pushes search in Home's stack (Back returns here). Nonce: every tap re-focuses the field.
            onPress={() => router.push(`/search?focus=${Date.now()}`)}
            style={[{ minHeight: minTouch + 28, borderRadius: radius.lg, backgroundColor: color.primary, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg }, shadow]}
          >
            <SearchIcon color={color.onPrimary} />
            <View style={{ flex: 1 }}>
              <T bold style={{ color: color.onPrimary, fontSize: 18 }}>{tr.ctaSearchShort}</T>
              <T variant="small" style={{ color: color.onPrimary, opacity: 0.9 }}>{tr.searchPlaceholder}</T>
            </View>
          </Tap>
        </FadeIn>

        <FadeIn index={2}><QuickWins /></FadeIn>
        <View style={{ flex: 1 }} />
        <FadeIn index={3}><CaseFileStrip /></FadeIn>

        <T variant="micro" muted style={{ textAlign: "center" }}>{ms.sampleCount(data.addresses.length)}</T>
        {data.manifest.uses_fixtures && <Notice tone="warn" title={tr.fixtures}>{tr.fixturesBody}</Notice>}
      </ScrollView>
    </SafeAreaView>
  );
}
