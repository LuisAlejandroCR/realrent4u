// index.tsx: 06 change tests T1-T5 with result availability per scenario.
import { Stack, useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LangToggle, LegalDateBar } from "../../../src/components/Chrome";
import { Chevron, T } from "../../../src/components/ui";
import { usePrefs } from "../../../src/prefs";
import { color, font, minTouch, radius, space } from "../../../src/theme";
import type { ChangeTest } from "../../../src/types";

/** 06 Change tests — T1–T5 cards: ID, title, scenario dates, availability; tap to expand, then open detail. */
export default function ChangesScreen() {
  const { tr, ms, data } = usePrefs();
  const results = data.changeResults;
  const have = (id: string) => !!results?.some((r) => r.test_id === id);
  const k = data.changeTests.filter((t) => have(t.test_id)).length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: color.surface }}>
      <Stack.Screen options={{ headerShown: false, title: tr.changesTitle }} />
      <View style={{ backgroundColor: color.tint, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T variant="display" serif accessibilityRole="header">{tr.changesTitle}</T>
          <LangToggle />
        </View>
        {/* Availability meter: k of n filled segments + text */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }} accessible accessibilityLabel={tr.resultsAvailable(k, data.changeTests.length)}>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {data.changeTests.map((t) => <View key={t.test_id} style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: have(t.test_id) ? color.primary : color.surface, borderWidth: 1, borderColor: color.primary }} />)}
          </View>
          <T variant="small" bold>{tr.resultsAvailable(k, data.changeTests.length)}</T>
        </View>
      </View>
      <LegalDateBar />
      <FlatList
        style={{ backgroundColor: color.paper }}
        data={data.changeTests}
        keyExtractor={(t) => t.test_id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        ListHeaderComponent={<T variant="small" muted numberOfLines={2} style={{ marginBottom: space.xs }}>{tr.changesIntro}</T>}
        renderItem={({ item }) => <TestCard t={item} available={have(item.test_id)} />}
        ListFooterComponent={!results ? <T variant="small" muted style={{ marginTop: space.sm }}>{tr.resultsMissingAll}</T> : null}
      />
    </SafeAreaView>
  );
}

function TestCard({ t, available }: { t: ChangeTest; available: boolean }) {
  const { tr } = usePrefs();
  const router = useRouter();
  const dates = t.as_of ? t.as_of : t.as_of_before && t.as_of_after ? `${t.as_of_before} → ${t.as_of_after}` : null;
  return (
    <Pressable
      onPress={() => router.push(`/changes/${t.test_id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${t.test_id}. ${t.title}. ${dates ? `${tr.scenarioDates} ${dates}. ` : ""}${available ? tr.resAvailable : tr.resNotAvailable}`}
      style={({ pressed }) => ({ minHeight: minTouch + 20, flexDirection: "row", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md, alignItems: "center", backgroundColor: pressed ? color.tint : color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line })}
    >
      <Text style={{ fontFamily: font.mono, fontWeight: "800", color: color.accent, fontSize: 15, width: 28 }}>{t.test_id}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <T bold numberOfLines={2}>{t.title}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {dates && <T variant="micro" mono muted>{dates}</T>}
          <T variant="micro" bold style={{ color: available ? color.primary : color.amber }}>{available ? "● " + tr.resAvailable : "○ " + tr.resNotAvailable}</T>
        </View>
      </View>
      <Chevron />
    </Pressable>
  );
}
