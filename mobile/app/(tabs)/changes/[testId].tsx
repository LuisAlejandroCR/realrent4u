// [testId].tsx: 07 one change test: tappable KPI filters, a dot map with a selection card, a before→after or
// by-jurisdiction chart that filters the map, the affected addresses and one "About" fold. Earns "scenario".
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LegalDateBar } from "../../../src/components/Chrome";
import { BarList, StackedBar, type Segment } from "../../../src/components/Charts";
import { PointsMap, type MapPoint } from "../../../src/components/Maps";
import { CountUp, FadeIn, Tap } from "../../../src/components/motion";
import { PointCard } from "../../../src/components/PointCard";
import { Button, Fold, Id, Notice, T } from "../../../src/components/ui";
import { matchedRules } from "../../../src/data";
import { usePrefs } from "../../../src/prefs";
import { badge, chart, chartBar, color, font, radius, space } from "../../../src/theme";
import type { LookupResult } from "../../../src/types";

const OTHER = "#B9BEC8";
type Only = "affected" | "flagged" | null;

/**
 * 07 Scenario detail. Counts are only shown when the result exists:
 * missing → "Results not available"; present + [] → "0 affected addresses"; present + items → real count.
 */
export default function ScenarioScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const { tr, ms, data, asOf, setAsOf, earn } = usePrefs();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [only, setOnly] = useState<Only>(null);
  const [jur, setJur] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const t = data.changeTests.find((x) => x.test_id === testId);
  useEffect(() => { if (t) earn("scenario"); }, [t, earn]);
  if (!t) return <View style={{ padding: space.lg }}><Notice tone="warn" title={ms.testNotFound} /></View>;

  const res = data.changeResults?.find((r) => r.test_id === t.test_id);
  const ids = [...t.rule_ids, ...(t.conflict_with ?? [])];
  const known = new Set(data.rules.map((r) => r.team_rule_id));
  const affected = res?.affected_address_ids ?? [];
  const affectedSet = new Set(affected);
  const flagged = new Set(res?.conflict_address_ids ?? []);
  const open = (id: string) => router.push(`/search/${id}`);
  const matched = matchedRules(res?.notes);
  const ruleTitle = (rid: string | undefined) => (rid ? data.rules.find((r) => r.team_rule_id === rid)?.title : undefined);
  const jurOf = (id: string) => data.jurisdictions[id]?.jurisdiction ?? tr.unresolved;

  // Every sample address in the scenario's states: the denominator for the map and charts.
  // Tests without a `states` list (T2) take the states their affected addresses are in.
  const states = t.states?.length ? t.states : [...new Set(data.addresses.filter((a) => affectedSet.has(a.address_id)).map((a) => a.state))];
  const scope = data.addresses.filter((a) => !states.length || states.includes(a.state));
  // Filters (KPI tiles + jurisdiction bars) narrow the map and the address list together.
  const passes = (id: string) =>
    (!jur || jurOf(id) === jur) && (only !== "affected" || affectedSet.has(id)) && (only !== "flagged" || flagged.has(id));
  const statusOf = (id: string) => (flagged.has(id) ? { tag: ms.mapFlagged, fill: color.danger } : affectedSet.has(id) ? { tag: ms.mapAffected, fill: chartBar } : { tag: ms.mapOther, fill: OTHER });
  const points: MapPoint[] = scope.filter((a) => passes(a.address_id)).flatMap((a) => {
    const g = data.geo[a.address_id];
    return g ? [{ id: a.address_id, lat: g[0], lon: g[1], fill: statusOf(a.address_id).fill }] : [];
  });
  const list = affected.filter(passes);
  const shown = all ? list : list.slice(0, 12);

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
      const j = jurOf(a.address_id);
      acc[j] ??= { v: 0, n: 0 };
      acc[j].n += 1;
      if (affectedSet.has(a.address_id)) acc[j].v += 1;
      return acc;
    }, {}),
  ).map(([j, x]) => ({ key: j, label: j, value: x.v, total: x.n })).sort((x, y) => y.total - x.total).slice(0, 6);
  const filterLabel = [jur, only === "flagged" ? ms.mapFlagged : only === "affected" ? ms.mapAffected : null].filter(Boolean).join(" · ");
  const card = { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.scenarioDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md, paddingBottom: space.xl }}>
        <FadeIn index={0} style={{ gap: 2 }}>
          <Id tone="accent">{t.test_id}</Id>
          <T variant="title" serif accessibilityRole="header">{t.title}</T>
        </FadeIn>

        {/* KPIs double as filters for the map and the list. */}
        {res ? (
          <FadeIn index={1} style={{ flexDirection: "row", gap: space.sm }}>
            <Big value={affected.length} label={ms.affectedHere} tone={color.primary} active={only === "affected"} onPress={() => setOnly(only === "affected" ? null : "affected")} />
            {flagged.size > 0 && <Big value={flagged.size} label={ms.conflictsHere} tone={color.danger} active={only === "flagged"} onPress={() => setOnly(only === "flagged" ? null : "flagged")} />}
          </FadeIn>
        ) : (
          <View accessible accessibilityRole="text" style={{ borderLeftWidth: 3, borderLeftColor: color.amber, paddingLeft: space.sm, paddingVertical: 2, gap: 2 }}>
            <T variant="small" bold style={{ color: color.amber }}>{tr.resNotAvailable}</T>
            <T variant="small" muted>{ms.resUnavailShort}</T>
          </View>
        )}

        {filterLabel ? (
          <Tap onPress={() => { setOnly(null); setJur(null); }} feel="select" accessibilityLabel={`${ms.showing(filterLabel)}. ${ms.clearFilter}`}
            style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, minHeight: 34, borderRadius: radius.pill, backgroundColor: color.ink }}>
            <Text style={{ color: color.surface, fontWeight: "700", fontSize: 13 }}>{ms.showing(filterLabel)}</Text>
            <Text style={{ color: color.surface, fontWeight: "800" }}>✕</Text>
          </Tap>
        ) : null}

        {res && points.length > 0 && (
          <FadeIn index={2} style={{ gap: space.xs }}>
            <PointsMap points={points} selected={sel} onSelect={setSel} />
            {sel ? (
              <PointCard id={sel} tag={statusOf(sel).tag} tagColor={statusOf(sel).fill} onOpen={() => open(sel)} onClose={() => setSel(null)} />
            ) : (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: 2 }}>
                  <Legend fill={chartBar} text={`${ms.mapAffected} ${affected.length}`} />
                  {flagged.size > 0 && <Legend fill={color.danger} text={`! ${ms.mapFlagged} ${flagged.size}`} />}
                  <Legend fill={OTHER} text={`${ms.mapOther} ${scope.length - affected.length}`} />
                </View>
                <T variant="micro" muted>{ms.mapHint}</T>
              </>
            )}
          </FadeIn>
        )}

        {res && (flip ? (
          <FadeIn index={3} style={[card, { gap: space.md }]}>
            <T variant="small" bold>{ms.beforeAfter(ruleTitle(mainRule) ?? mainRule!)}</T>
            {/* Tapping a date sets the app's as-of date: every address now answers for that day. */}
            {flip.map(({ d, segs }, i) => (
              <StackedBar key={d} title={d === asOf ? `✓ ${d}` : d} onTitle={() => setAsOf(d)} segments={segs} delay={i * 350} />
            ))}
          </FadeIn>
        ) : byJur.length > 0 ? (
          <FadeIn index={3} style={card}>
            <T variant="small" bold>{ms.byCity}</T>
            <BarList rows={byJur} selected={jur} onPress={(r) => { setJur(jur === r.key ? null : r.key); setSel(null); }} unit={(r) => ms.ofTotal(r.value, r.total ?? r.value)} />
          </FadeIn>
        ) : null)}

        {res && list.length > 0 && (
          <FadeIn index={4} style={card}>
            <T bold>{tr.nAffected(list.length)}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {shown.map((a) => (
                <Tap key={a} onPress={() => open(a)} accessibilityRole="link" accessibilityLabel={`${a}${flagged.has(a) ? `, ${tr.needsReview}` : ""}`}
                  style={{ borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5, borderColor: flagged.has(a) ? color.danger : color.primary, backgroundColor: flagged.has(a) ? color.dangerTint : color.surface }}>
                  <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.mono, fontWeight: "700", fontSize: 13, color: flagged.has(a) ? color.danger : color.primary }}>{flagged.has(a) ? "! " : ""}{a}</Text>
                </Tap>
              ))}
            </View>
            {list.length > 12 && <Button variant="ghost" label={all ? tr.showLess : tr.showAll(list.length)} onPress={() => setAll(!all)} />}
          </FadeIn>
        )}

        {/* Everything else, one tap away. */}
        <Fold title={ms.aboutTest} hint={ms.tapToOpen}>
          {t.expected_behavior ? <T variant="small">{t.expected_behavior}</T> : null}
          {!flip && t.as_of ? (
            <Tap onPress={() => setAsOf(t.as_of!)} feel="none" accessibilityRole="button" accessibilityLabel={ms.jumpTo(t.as_of)} style={{ alignSelf: "flex-start" }}>
              <T variant="small" bold style={{ color: color.primary }}>{t.as_of === asOf ? "✓" : "◷"} {t.as_of}</T>
            </Tap>
          ) : null}
          <T variant="small" bold>{tr.rulesInvolved}</T>
          {ids.map((r) => {
            const rid = known.has(r) ? r : matched[r];
            return (
              <Tap key={r} feel="tap" disabled={!rid} onPress={() => rid && router.push(`/search/rule/${rid}`)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingVertical: 4 }}>
                <Id tone="accent">{r}</Id>
                {rid ? <><T variant="small" muted>→</T><Id>{rid}</Id><T variant="small" style={{ flexBasis: "100%", color: color.primary }}>{ruleTitle(rid)} ›</T></> : <T variant="small" muted>{tr.ruleNotInRecord}</T>}
              </Tap>
            );
          })}
        </Fold>
      </ScrollView>
    </View>
  );
}

/** Headline number that is also a filter toggle. */
function Big({ value, label, tone, active, onPress }: { value: number; label: string; tone: string; active: boolean; onPress: () => void }) {
  return (
    <Tap onPress={onPress} feel="select" accessibilityLabel={`${value} ${label}`} accessibilityState={{ selected: active }}
      style={{ flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: active ? tone : color.surface, borderWidth: 1, borderColor: active ? tone : color.line, borderTopWidth: 4, borderTopColor: tone }}>
      <CountUp value={value} style={{ fontFamily: font.serif, fontSize: 40, lineHeight: 44, fontWeight: "700", color: active ? color.onPrimary : tone }} />
      <T variant="small" style={{ color: active ? color.onPrimary : color.ink2 }}>{label} ›</T>
    </Tap>
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
