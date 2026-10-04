// [testId].tsx: 07 one change test: dates, rules involved, expected behavior, affected and flagged addresses.
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { LegalDateBar } from "../../../src/components/Chrome";
import { Button, Fold, Id, T } from "../../../src/components/ui";
import { usePrefs } from "../../../src/prefs";
import { color, space } from "../../../src/theme";

/**
 * 07 Detalle del escenario. Counts are only shown when the result exists:
 * missing → "Results not available"; present + [] → "0 affected addresses"; present + items → real count.
 */
export default function ScenarioScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const { tr, ms, data } = usePrefs();
  const [all, setAll] = useState(false);
  const t = data.changeTests.find((x) => x.test_id === testId);
  if (!t) return null;
  const res = data.changeResults?.find((r) => r.test_id === t.test_id);
  const ids = [...t.rule_ids, ...(t.conflict_with ?? [])];
  const known = new Set(data.rules.map((r) => r.team_rule_id));
  const affected = res?.affected_address_ids ?? [];
  const shown = all ? affected : affected.slice(0, 8);
  const dates = t.as_of ? t.as_of : t.as_of_before && t.as_of_after ? `${t.as_of_before} → ${t.as_of_after}` : null;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.scenarioDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, paddingBottom: space.xl }}>
        <View style={{ gap: 2 }}>
          <Id>{t.test_id}</Id>
          <T variant="title" serif accessibilityRole="header">{t.title}</T>
        </View>
        {dates && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <T variant="small" style={{ color: color.accent, fontWeight: "700" }}>{tr.scenarioDates}:</T>
            <T variant="small" mono bold>{dates}</T>
          </View>
        )}
        <Fold title={`${tr.rulesInvolved} (${ids.length})`} preview={ids.join(", ") || null} empty={ms.noInfo} hint={ms.tapToOpen}>
          {ids.map((r) => (
            <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Id>{r}</Id>{known.has(r) ? null : <T variant="small" muted>{tr.ruleNotInRecord}</T>}</View>
          ))}
        </Fold>
        <Fold title={tr.expected} preview={t.expected_behavior || null} empty={ms.noInfo} hint={ms.tapToOpen}>{t.expected_behavior ? <T variant="small">{t.expected_behavior}</T> : null}</Fold>

        {!res ? (
          <View accessible accessibilityRole="text" style={{ borderLeftWidth: 3, borderLeftColor: color.amber, paddingLeft: space.sm, paddingVertical: 2, gap: 2 }}>
            <T variant="small" bold style={{ color: color.amber }}>{tr.resNotAvailable}</T>
            <T variant="small" muted>{ms.resUnavailShort}</T>
          </View>
        ) : (
          <Fold title={tr.nAffected(affected.length)} initiallyOpen={affected.length > 0}>
            {res.conflict_address_ids && <T style={{ fontWeight: "700" }}>{tr.nConflicts(res.conflict_address_ids.length)}</T>}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{shown.map((a) => <Id key={a}>{a}</Id>)}</View>
            {affected.length > 8 && <Button variant="ghost" label={all ? tr.showLess : tr.showAll(affected.length)} onPress={() => setAll(!all)} />}
          </Fold>
        )}
      </ScrollView>
    </View>
  );
}
