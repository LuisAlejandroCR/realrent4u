// [testId].tsx: 07 one change test: headline counts, "view at date" jumps, a dot map of the scenario's addresses,
// a before→after or by-jurisdiction chart, tappable addresses and matched rules. Earns the "scenario" stamp.
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LegalDateBar } from "../../../src/components/Chrome";
import { BarList, StackedBar, type Segment } from "../../../src/components/Charts";
import { PointsMap, type MapPoint } from "../../../src/components/Maps";
import { CountUp, FadeIn, Tap } from "../../../src/components/motion";
import { Button, Fold, Id, Notice, T } from "../../../src/components/ui";
import { matchedRules } from "../../../src/data";
import { usePrefs } from "../../../src/prefs";
import { badge, chart, chartBar, color, font, radius, space } from "../../../src/theme";
import type { LookupResult } from "../../../src/types";

/**
 * 07 Scenario detail. Counts are only shown when the result exists:
 * missing → "Results not available"; present + [] → "0 affected addresses"; present + items → real count.
 */
export default function ScenarioScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const { tr, ms, data, asOf, setAsOf, earn } = usePrefs();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const t = data.changeTests.find((x) => x.test_id === testId);
  useEffect(() => { if (t) earn("scenario"); }, [t, earn]);
  if (!t) return <View style={{ padding: space.lg }}><Notice tone="warn" title={ms.testNotFound} /></View>;

  const res = data.changeResults?.find((r) => r.test_id === t.test_id);
  const ids = [...t.rule_ids, ...(t.conflict_with ?? [])];
  const known = new Set(data.rules.map((r) => r.team_rule_id));
  const affected = res?.affected_address_ids ?? [];
  const flagged = new Set(res?.conflict_address_ids ?? []);
  const shown = all ? affected : affected.slice(0, 12);
  const dates = [t.as_of_before, t.as_of_after, t.as_of].filter((d): d is string => !!d);
  const open = (id: string) => router.push(`/search/${id}`);
  const matched = matchedRules(res?.notes);
  const ruleTitle = (rid: string | undefined) => (rid ? data.rules.find((r) => r.team_rule_id === rid)?.title : undefined);

  // Every sample address in the scenario's states: the denominator for the map and charts.
  // Tests without a `states` list (T2) take the states their affected addresses are in.
  const states = t.states?.length ? t.states : [...new Set(data.addresses.filter((a) => affected.includes(a.address_id)).map((a) => a.state))];
  const scope = data.addresses.filter((a) => !states.length || states.includes(a.state));
  const affectedSet = new Set(affected);
  const points: MapPoint[] = scope.flatMap((a) => {
    const g = data.geo[a.address_id];
    if (!g) return [];
    const hit = affectedSet.has(a.address_id);
    return [{ id: a.address_id, lat: g[0], lon: g[1], fill: flagged.has(a.address_id) ? color.danger : hit ? chartBar : "#B9BEC8" }];
  });

  // Two dates → how the main rule's result moves across the same addresses. One date → affected by jurisdiction.
  const mainRule = matched[t.rule_ids[0]];
  const flip = t.as_of_before && t.as_of_after && mainRule
    ? [t.as_of_before, t.as_of_after].map((d) => {
        const counts: Record<string, number> = {};
        scope.forEach((a) => {
          const r = data.lookups[d]?.[a.address_id]?.find((x) => x.team_rule_id === mainRule)?.result ?? "none";
          counts[r] = (counts[r] ?? 0) + 1;
        });
        const segs: Segment[] = (["applies", "unknown", "superseded", "not_yet_effective", "pending"] as LookupResult[])
          .map((k) => ({ key: k, label: tr.result[k] ?? k, value: counts[k] ?? 0, color: chart[k], glyph: badge[k].glyph }));
        segs.push({ key: "none", label: ms.mapOther, value: counts.none ?? 0, color: chart.unevaluated });
        return { d, segs };
      })
    : null;
  const byJur = Object.entries(
    scope.reduce<Record<string, { v: number; n: number }>>((acc, a) => {
      const j = data.jurisdictions[a.address_id]?.jurisdiction ?? tr.unresolved;
      acc[j] ??= { v: 0, n: 0 };
      acc[j].n += 1;
      if (affectedSet.has(a.address_id)) acc[j].v += 1;
      return acc;
    }, {}),
  ).map(([j, x]) => ({ key: j, label: j, value: x.v, total: x.n })).sort((x, y) => y.total - x.total).slice(0, 6);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.scenarioDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm + 2, paddingBottom: space.xl }}>
        <FadeIn index={0} style={{ gap: 2 }}>
          <Id tone="accent">{t.test_id}</Id>
          <T variant="title" serif accessibilityRole="header">{t.title}</T>
        </FadeIn>

        {/* Headline numbers: the picture of the scenario. */}
        {res ? (
          <FadeIn index={1} style={{ flexDirection: "row", gap: space.sm }}>
            <Big value={affected.length} label={ms.affectedHere} tone={color.primary} />
            {flagged.size > 0 && <Big value={flagged.size} label={ms.conflictsHere} tone={color.danger} />}
          </FadeIn>
        ) : (
          <View accessible accessibilityRole="text" style={{ borderLeftWidth: 3, borderLeftColor: color.amber, paddingLeft: space.sm, paddingVertical: 2, gap: 2 }}>
            <T variant="small" bold style={{ color: color.amber }}>{tr.resNotAvailable}</T>
            <T variant="small" muted>{ms.resUnavailShort}</T>
          </View>
        )}

        {/* Time travel: set the app's as-of date to a scenario date, then open any address. */}
        {dates.length > 0 && (
          <FadeIn index={2} style={{ gap: space.xs }}>
            <T variant="small" bold style={{ color: color.accent }}>{tr.scenarioDates}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {dates.map((d, i) => {
                const on = d === asOf;
                const selectable = data.manifest.lookup_dates.includes(d);
                return (
                  <View key={d} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    {i > 0 && t.as_of_before && <T bold muted>→</T>}
                    <Tap
                      onPress={() => setAsOf(d)}
                      feel="none"
                      disabled={!selectable}
                      accessibilityRole="button"
                      accessibilityLabel={ms.jumpTo(d)}
                      accessibilityState={{ selected: on, disabled: !selectable }}
                      style={{ paddingHorizontal: space.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.primary, backgroundColor: on ? color.primary : color.surface }}
                    >
                      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.mono, fontWeight: "700", color: on ? color.onPrimary : color.primary }}>{on ? "✓ " : "◷ "}{d}</Text>
                    </Tap>
                  </View>
                );
              })}
            </View>
          </FadeIn>
        )}

        {res && points.length > 0 && (
          <FadeIn index={3} style={{ gap: space.xs }}>
            <PointsMap points={points} onPress={open} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: 2 }}>
              <Legend fill={chartBar} text={`${ms.mapAffected} ${affected.length}`} />
              {flagged.size > 0 && <Legend fill={color.danger} text={`! ${ms.mapFlagged} ${flagged.size}`} />}
              <Legend fill="#B9BEC8" text={`${ms.mapOther} ${scope.length - affected.length}`} />
            </View>
            <T variant="micro" muted>{ms.mapHint}</T>
          </FadeIn>
        )}

        {res && (flip ? (
          <FadeIn index={4} style={{ gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line }}>
            <T variant="small" bold>{ms.beforeAfter(ruleTitle(mainRule) ?? mainRule!)}</T>
            {flip.map(({ d, segs }, i) => <StackedBar key={d} title={d} segments={segs} delay={i * 350} />)}
            <T variant="micro" muted>{ms.tapSegment}</T>
          </FadeIn>
        ) : byJur.length > 0 ? (
          <FadeIn index={4} style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line }}>
            <T variant="small" bold>{ms.byCity}</T>
            <BarList rows={byJur} unit={(r) => ms.ofTotal(r.value, r.total ?? r.value)} />
          </FadeIn>
        ) : null)}

        {res && affected.length > 0 && (
          <FadeIn index={5} style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line }}>
            <T bold>{tr.nAffected(affected.length)}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {shown.map((a) => (
                <Tap key={a} onPress={() => open(a)} accessibilityRole="link" accessibilityLabel={`${a}${flagged.has(a) ? `, ${tr.needsReview}` : ""}`}
                  style={{ borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5, borderColor: flagged.has(a) ? color.danger : color.primary, backgroundColor: flagged.has(a) ? color.dangerTint : color.surface }}>
                  <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.mono, fontWeight: "700", fontSize: 13, color: flagged.has(a) ? color.danger : color.primary }}>{flagged.has(a) ? "! " : ""}{a}</Text>
                </Tap>
              ))}
            </View>
            {affected.length > 12 && <Button variant="ghost" label={all ? tr.showLess : tr.showAll(affected.length)} onPress={() => setAll(!all)} />}
          </FadeIn>
        )}

        <Fold title={tr.expected} preview={t.expected_behavior || null} empty={ms.noInfo} hint={ms.tapToOpen}>{t.expected_behavior ? <T variant="small">{t.expected_behavior}</T> : null}</Fold>
        <Fold title={`${tr.rulesInvolved} (${ids.length})`} preview={ids.join(", ") || null} empty={ms.noInfo} hint={ms.tapToOpen}>
          {ids.length ? ids.map((r) => {
            const rid = known.has(r) ? r : matched[r];
            return (
              <Tap key={r} feel="tap" disabled={!rid} onPress={() => rid && router.push(`/search/rule/${rid}`)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingVertical: 4 }}>
                <Id tone="accent">{r}</Id>
                {rid ? <><T variant="small" muted>→</T><Id>{rid}</Id><T variant="small" style={{ flexBasis: "100%" }}>{ruleTitle(rid)}</T></> : <T variant="small" muted>{tr.ruleNotInRecord}</T>}
              </Tap>
            );
          }) : null}
        </Fold>
      </ScrollView>
    </View>
  );
}

function Big({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <View style={{ flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderTopWidth: 4, borderTopColor: tone }} accessible accessibilityLabel={`${value} ${label}`}>
      <CountUp value={value} style={{ fontFamily: font.serif, fontSize: 40, lineHeight: 44, fontWeight: "700", color: tone }} />
      <T variant="small" muted>{label}</T>
    </View>
  );
}

function Legend({ fill, text }: { fill: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: fill }} />
      <Text maxFontSizeMultiplier={1.4} style={{ fontSize: 12, color: color.ink2 }}>{text}</Text>
    </View>
  );
}
