// [id].tsx: 03 address details: postal city → legal jurisdiction, a tappable approximate map, building facts,
// a result strip that doubles as a filter, and compact rule rows grouped by outcome. Earns "find" and "mismatch".
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, ScrollView, Text, View } from "react-native";
import { LegalDateBar } from "../../../src/components/Chrome";
import { LocationMap } from "../../../src/components/Maps";
import { FadeIn, Tap } from "../../../src/components/motion";
import { Button, Chevron, Fact, Id, Kicker, Notice, SectionLabel, T } from "../../../src/components/ui";
import { blank, rulesInRecord } from "../../../src/data";
import { useReduceMotion } from "../../../src/feel";
import { reasonText } from "../../../src/format";
import { usePrefs } from "../../../src/prefs";
import { badge, chart, chartTrack, color, radius, space, type BadgeKind } from "../../../src/theme";
import type { LookupItem, Rule } from "../../../src/types";

const ORDER: BadgeKind[] = ["applies", "unknown", "superseded", "not_yet_effective", "pending", "unevaluated"];
const OUTCOMES: { key: string; kinds: BadgeKind[]; label: "groupApplies" | "groupUnknown" | "groupSuperseded" | "groupLater" | "groupNone" }[] = [
  { key: "applies", kinds: ["applies"], label: "groupApplies" },
  { key: "unknown", kinds: ["unknown"], label: "groupUnknown" },
  { key: "superseded", kinds: ["superseded"], label: "groupSuperseded" },
  { key: "later", kinds: ["not_yet_effective", "pending"], label: "groupLater" },
  { key: "none", kinds: ["unevaluated"], label: "groupNone" },
];

/** 03 Address result — anchor, jurisdiction, facts, one picture of all results, then the rules. */
export default function AddressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tr, ms, data, asOf, earn } = usePrefs();
  const [filter, setFilter] = useState<BadgeKind | "review" | null>(null);
  const a = data.addresses.find((x) => x.address_id === id);
  const j = a ? data.jurisdictions[a.address_id] : undefined;
  const differs = !!(a && j?.place && j.place !== a.postal_city);

  useEffect(() => {
    if (!a) return;
    earn("find");
    if (differs) earn("mismatch");
  }, [a, differs, earn]);

  const lookups = a ? data.lookups[asOf]?.[a.address_id] : undefined;
  // With precomputed results, show exactly the rules the engine returned (rules that don't apply are
  // omitted from lookups). Without them, fall back to every rule in the record, shown as not evaluated.
  const rules = useMemo(
    () => (lookups
      ? lookups.map((li) => data.rules.find((r) => r.team_rule_id === li.team_rule_id)).filter((r): r is Rule => !!r)
      : rulesInRecord(data.rules, j)),
    [lookups, data.rules, j],
  );
  const kindOf = (r: Rule): BadgeKind => lookups?.find((x) => x.team_rule_id === r.team_rule_id)?.result ?? "unevaluated";
  const conflictOf = (r: Rule) => !!(lookups?.find((x) => x.team_rule_id === r.team_rule_id)?.conflict_flag || r.conflict_flag);
  const counts = ORDER.map((k) => [k, rules.filter((r) => kindOf(r) === k).length] as const).filter(([, n]) => n > 0);
  const nConflict = rules.filter(conflictOf).length;
  const visible = filter == null ? rules : rules.filter((r) => (filter === "review" ? conflictOf(r) : kindOf(r) === filter));
  // Grouped by outcome (what the reader needs first), not by legal category (shown as a tag on each row).
  const groups = OUTCOMES.map((g) => ({ ...g, list: visible.filter((r) => g.kinds.includes(kindOf(r))) })).filter((g) => g.list.length > 0);
  const router = useRouter();

  if (!a) return <View style={{ padding: space.lg }}><Notice tone="warn" title={tr.noMatches} /></View>;
  const geo = data.geo[a.address_id];
  const missingFacts = blank(a.year_built) || blank(a.units) || blank(a.use_description);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.addressDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm + 2, paddingBottom: space.xxxl }}>
        <FadeIn index={0} style={{ gap: 0 }}>
          <Id>{a.address_id}</Id>
          <T variant="title" serif accessibilityRole="header" style={{ fontSize: 22, lineHeight: 27 }}>{a.street_address}</T>
          <T variant="small" muted>{a.postal_city}, {a.state} {a.zip}</T>
        </FadeIn>

        {/* Postal city → legal jurisdiction: the picture, not the sentence. */}
        <FadeIn index={1} style={{ backgroundColor: color.tint, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderLeftWidth: 4, borderLeftColor: differs ? color.accentBrand : color.primary }}>
          <View accessible accessibilityLabel={`${tr.legalJurisdiction}: ${j?.jurisdiction ?? tr.unresolved}${differs ? `. ${tr.differs} (${a.postal_city})` : ""}`}>
            <Kicker tone={differs ? "accent" : "primary"}>{tr.legalJurisdiction}{differs ? ` ≠ ${tr.postalCity.toLowerCase()}` : ""}</Kicker>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
              {differs && <T muted style={{ textDecorationLine: "line-through" }}>{a.postal_city}</T>}
              {differs && <T bold style={{ color: color.accent }}>→</T>}
              <T bold style={{ fontSize: 17 }}>{j?.jurisdiction ?? tr.unresolved}</T>
            </View>
            {j?.match && j.match !== "exact" ? <T variant="small" muted>{tr.fallback}</T> : null}
          </View>
        </FadeIn>

        {geo && (
          <FadeIn index={2}>
            <LocationMap lat={geo[0]} lon={geo[1]} area={geo[2] === "area"} label={geo[2] === "area" ? ms.approxArea : ms.approxStreet} hint={ms.mapExplore} onPress={() => router.push(`/map?address=${a.address_id}`)} />
          </FadeIn>
        )}

        <FadeIn index={3}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }} accessibilityLabel={ms.property}>
            <Fact label={tr.yearBuilt} value={a.year_built} missing={tr.notInRecord} />
            <Fact label={tr.units} value={a.units} missing={tr.notInRecord} />
            <Fact label={tr.use} value={a.use_description} missing={tr.notInRecord} />
          </View>
          {missingFacts && <T variant="micro" muted style={{ marginTop: 2 }}>{ms.notInferred}</T>}
        </FadeIn>

        {!j?.jurisdiction ? (
          <Notice tone="warn" title={tr.unresolved}>{tr.unresolvedBody}</Notice>
        ) : rules.length === 0 ? (
          <Notice tone="info" title={ms.noRulesTitle}>{tr.noRules}</Notice>
        ) : (
          <>
            <SectionLabel right={<T variant="small" muted>{ms.rulesN(rules.length)}</T>}>{ms.rulesFor}</SectionLabel>
            {!lookups && <Notice tone="warn" title={tr.noLookups} />}
            {/* key=asOf: the strip re-draws (and re-animates) when the date changes. */}
            <ResultStrip key={asOf} counts={counts} total={rules.length} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
              {counts.map(([k, n]) => (
                <FilterChip key={k} kind={k} n={n} on={filter === k} onPress={() => setFilter(filter === k ? null : k)} />
              ))}
              {nConflict > 0 && <FilterChip kind="review" n={nConflict} on={filter === "review"} onPress={() => setFilter(filter === "review" ? null : "review")} />}
            </View>
            {groups.map((g) => (
              <OutcomeGroup key={`${g.key}-${filter}`} title={ms[g.label]} kind={g.kinds[0]} rules={g.list} collapse={g.key === "applies" && filter == null}
                render={(r, i) => (
                  <FadeIn key={r.team_rule_id} index={i}>
                    <RuleRow r={r} li={lookups?.find((x) => x.team_rule_id === r.team_rule_id)} addressId={a.address_id} />
                  </FadeIn>
                )} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One proportional bar of every result for this address and date. Grows in from the left. */
function ResultStrip({ counts, total }: { counts: (readonly [BadgeKind, number])[]; total: number }) {
  const reduce = useReduceMotion();
  const grow = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(grow, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow, reduce]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={counts.map(([k, n]) => `${n} ${k}`).join(", ")} style={{ height: 14, borderRadius: 4, backgroundColor: chartTrack, overflow: "hidden" }}>
      <Animated.View style={{ flexDirection: "row", height: "100%", width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}>
        {counts.map(([k, n], i) => (
          <View key={k} style={{ flex: n / total, backgroundColor: k === "review" ? color.danger : chart[k], marginLeft: i ? 2 : 0 }} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Legend chip that filters the list. Glyph + count + label; selected = filled. */
function FilterChip({ kind, n, on, onPress }: { kind: BadgeKind; n: number; on: boolean; onPress: () => void }) {
  const { tr, ms } = usePrefs();
  const b = badge[kind];
  const label = kind === "unevaluated" ? tr.notEvaluated : kind === "review" ? tr.needsReview : tr.result[kind] ?? kind;
  return (
    <Tap
      onPress={onPress}
      feel="select"
      accessibilityRole="button"
      accessibilityLabel={`${n} ${label}`}
      accessibilityHint={ms.filterHint}
      accessibilityState={{ selected: on }}
      style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 34, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: b.fg, backgroundColor: on ? b.fg : b.bg }}
    >
      {/* Swatch ties the chip to its strip segment (chart fill); glyph + text carry meaning without colour. */}
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: kind === "review" ? color.danger : chart[kind], borderWidth: on ? 1 : 0, borderColor: color.surface }} />
      <Text style={{ color: on ? color.surface : b.fg, fontWeight: "800" }}>{b.glyph}</Text>
      <Text maxFontSizeMultiplier={1.4} style={{ color: on ? color.surface : b.fg, fontWeight: "800", fontSize: 14 }}>{n}</Text>
      <Text maxFontSizeMultiplier={1.4} style={{ color: on ? color.surface : b.fg, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Tap>
  );
}

/** Outcome section: glyph + title + count; long "Applies" lists show 4 rows until expanded. */
function OutcomeGroup({ title, kind, rules, collapse, render }: { title: string; kind: BadgeKind; rules: Rule[]; collapse: boolean; render: (r: Rule, i: number) => ReactNode }) {
  const { tr } = usePrefs();
  const [all, setAll] = useState(false);
  const b = badge[kind];
  const cut = collapse && !all ? rules.slice(0, 4) : rules;
  return (
    <View style={{ gap: space.xs + 2, marginTop: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }} accessibilityRole="header">
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: chart[kind as keyof typeof chart] ?? b.fg }} />
        <Text maxFontSizeMultiplier={1.4} style={{ color: b.fg, fontWeight: "800", fontSize: 15 }}>{b.glyph} {title}</Text>
        <Text maxFontSizeMultiplier={1.4} style={{ color: color.ink2, fontWeight: "700", fontSize: 13 }}>{rules.length}</Text>
      </View>
      {cut.map(render)}
      {cut.length < rules.length && <Button variant="ghost" label={tr.showAll(rules.length)} onPress={() => setAll(true)} />}
    </View>
  );
}

/** Compact rule row: colour rail + title + one muted line (category · plain reason). Status lives in the group header. */
function RuleRow({ r, li, addressId }: { r: Rule; li: LookupItem | undefined; addressId: string }) {
  const { tr, ms, data } = usePrefs();
  const router = useRouter();
  const kind: BadgeKind = li ? li.result : "unevaluated";
  const conflict = !!(li?.conflict_flag || r.conflict_flag);
  const label = kind === "unevaluated" ? tr.notEvaluated : tr.result[kind] ?? kind;
  const why = reasonText(li?.reason, ms.reasons, ms.displacedBy, (rid) => data.rules.find((x) => x.team_rule_id === rid)?.title);
  const cat = tr.category[r.category] ?? r.category;
  return (
    <Tap
      onPress={() => router.push(`/search/rule/${r.team_rule_id}?address=${addressId}`)}
      accessibilityRole="link"
      accessibilityLabel={`${label}${conflict ? `, ${tr.needsReview}` : ""}. ${r.title}. ${cat}${why ? `. ${why}` : ""}`}
      accessibilityHint={ms.openRule}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.md, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: conflict ? color.danger : color.line, borderLeftWidth: 5, borderLeftColor: chart[kind as keyof typeof chart] ?? badge[kind].fg }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T bold numberOfLines={2}>{r.title}</T>
        <T variant="micro" muted numberOfLines={2}>
          {conflict ? <T variant="micro" bold style={{ color: color.danger }}>! {tr.needsReview} · </T> : null}
          {cat}{why ? ` · ${why}` : ""}
        </T>
      </View>
      <Chevron />
    </Tap>
  );
}
