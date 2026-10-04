// index.tsx: 06 change tests as a timeline: KPI tiles that filter the list, a date header that sets the app's
// as-of date, and one row per test (track across the dates: dot = one date, bar = before → after) with its count.
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalDateBar } from "../../../src/components/Chrome";
import { KpiRow } from "../../../src/components/Charts";
import { FadeIn, Tap } from "../../../src/components/motion";
import { ProfileButton } from "../../../src/components/Story";
import { Chevron, T } from "../../../src/components/ui";
import { shortDate } from "../../../src/format";
import { usePrefs } from "../../../src/prefs";
import { chartBar, chartTrack, color, font, radius, space } from "../../../src/theme";
import type { ChangeTest } from "../../../src/types";

type Filter = "review" | "none" | null;

export default function ChangesScreen() {
  const { tr, ms, data, asOf, setAsOf, lang } = usePrefs();
  const [filter, setFilter] = useState<Filter>(null);
  const results = data.changeResults;
  const resOf = (id: string) => results?.find((r) => r.test_id === id);
  const n = (id: string) => resOf(id)?.affected_address_ids?.length;
  const c = (id: string) => resOf(id)?.conflict_address_ids?.length ?? 0;
  const tests = data.changeTests;
  // The axis: every date any test uses, in order (ordinal spacing, labelled).
  const dates = [...new Set(tests.flatMap((t) => [t.as_of_before, t.as_of_after, t.as_of]).filter((d): d is string => !!d))].sort();
  const total = tests.reduce((a, t) => a + (n(t.test_id) ?? 0), 0);
  const review = tests.filter((t) => c(t.test_id) > 0);
  const none = tests.filter((t) => n(t.test_id) === 0);
  const shown = filter === "review" ? review : filter === "none" ? none : tests;
  const toggle = (f: Filter) => setFilter(filter === f ? null : f);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: color.surface }}>
      <Stack.Screen options={{ headerShown: false, title: tr.changesTitle }} />
      <View style={{ backgroundColor: color.tint, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T variant="display" serif accessibilityRole="header">{tr.changesTitle}</T>
        <ProfileButton />
      </View>
      <LegalDateBar />
      <ScrollView style={{ backgroundColor: color.paper }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
        {results ? (
          <KpiRow items={[
            { value: tests.length, label: ms.kpiTests, onPress: () => setFilter(null), active: false },
            { value: total, label: ms.kpiChanges },
            { value: review.length, label: ms.kpiReview, tone: color.danger, onPress: () => toggle("review"), active: filter === "review" },
            { value: none.length, label: ms.kpiNoEffect, tone: color.ink2, onPress: () => toggle("none"), active: filter === "none" },
          ]} />
        ) : <T variant="small" muted>{tr.resultsMissingAll}</T>}

        <View style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line }}>
          {/* Date header: tapping a date time-travels the whole app. Indented to line up with the tracks. */}
          <View style={{ flexDirection: "row", marginLeft: 36 }}>
            {dates.map((d) => {
              const on = d === asOf;
              return (
                <Tap key={d} onPress={() => setAsOf(d)} feel="none" accessibilityRole="button" accessibilityLabel={ms.jumpTo(d)} accessibilityState={{ selected: on }}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: radius.sm, backgroundColor: on ? color.primary : "transparent" }}>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, lineHeight: 14, fontWeight: "800", color: on ? color.onPrimary : color.primary }}>{shortDate(d, lang)[0]}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 10, lineHeight: 12, fontWeight: "600", color: on ? color.onPrimary : color.ink2 }}>{shortDate(d, lang)[1]}</Text>
                </Tap>
              );
            })}
          </View>
          {shown.map((t, i) => (
            <FadeIn key={t.test_id} index={i}>
              <TimelineRow t={t} dates={dates} asOf={asOf} n={n(t.test_id)} conflicts={c(t.test_id)} />
            </FadeIn>
          ))}
          <T variant="micro" muted style={{ marginTop: space.xs }}>{ms.timelineHint}</T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One test: ID + title + count, and its track on the shared date axis. */
function TimelineRow({ t, dates, asOf, n, conflicts }: { t: ChangeTest; dates: string[]; asOf: string; n: number | undefined; conflicts: number }) {
  const { tr, ms } = usePrefs();
  const router = useRouter();
  const at = (d: string | undefined) => (d ? dates.indexOf(d) : -1);
  const from = at(t.as_of_before ?? t.as_of);
  const to = at(t.as_of_after ?? t.as_of);
  const pos = (i: number) => `${((i + 0.5) / dates.length) * 100}%` as const;
  const nowCol = dates.indexOf(asOf);
  return (
    <Tap onPress={() => router.push(`/changes/${t.test_id}`)} accessibilityRole="link"
      accessibilityLabel={`${t.test_id}. ${t.title}. ${n != null ? tr.nAffected(n) : tr.resNotAvailable}${conflicts ? `, ${conflicts} ${ms.kpiReview}` : ""}`}
      style={{ paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.line, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text style={{ width: 28, fontFamily: font.mono, fontWeight: "800", color: color.accent, fontSize: 14 }}>{t.test_id}</Text>
        <T variant="small" bold numberOfLines={1} style={{ flex: 1 }}>{t.title}</T>
        {n != null ? (
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.serif, fontSize: 20, fontWeight: "700", color: n ? color.primary : color.ink2 }}>{n}</Text>
        ) : <Text style={{ color: color.amber, fontWeight: "800" }}>○</Text>}
        {conflicts > 0 && <Text maxFontSizeMultiplier={1.4} style={{ color: color.danger, fontWeight: "800", fontSize: 12 }}>! {conflicts}</Text>}
        <Chevron />
      </View>
      {/* Track: grey rail, the as-of column tinted, a bar from before → after or a single dot. */}
      <View style={{ height: 16, marginLeft: 36, justifyContent: "center" }}>
        <View style={{ height: 2, backgroundColor: chartTrack }} />
        {nowCol >= 0 && <View style={{ position: "absolute", left: `${(nowCol / dates.length) * 100}%`, width: `${100 / dates.length}%`, top: 0, bottom: 0, backgroundColor: color.primaryTint, opacity: 0.6 }} />}
        {from >= 0 && to > from && (
          <View style={{ position: "absolute", left: pos(from), width: `${((to - from) / dates.length) * 100}%`, height: 6, borderRadius: 3, backgroundColor: chartBar }} />
        )}
        {from >= 0 && <Dot left={pos(from)} filled={to === from} danger={conflicts > 0 && to === from} />}
        {to > from && <Dot left={pos(to)} filled danger={conflicts > 0} />}
      </View>
    </Tap>
  );
}

function Dot({ left, filled, danger }: { left: `${number}%`; filled: boolean; danger?: boolean }) {
  const c = danger ? color.danger : chartBar;
  return <View style={{ position: "absolute", left, marginLeft: -6, width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: c, backgroundColor: filled ? c : color.surface }} />;
}
