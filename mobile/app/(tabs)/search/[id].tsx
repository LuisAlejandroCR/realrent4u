// [id].tsx: 03 address details: jurisdiction, building facts and the engine's results by category.
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { LegalDateBar } from "../../../src/components/Chrome";
import { Card, Fact, Id, Kicker, Notice, SectionLabel, StatusBadge, T, Chevron } from "../../../src/components/ui";
import { blank, groupByCategory, rulesInRecord } from "../../../src/data";
import { usePrefs } from "../../../src/prefs";
import { color, minTouch, radius, space } from "../../../src/theme";
import type { LookupItem, Rule } from "../../../src/types";

/** 03 Address result — address + legal jurisdiction are the anchor; facts summary; rule cards by category. */
export default function AddressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tr, ms, data, asOf } = usePrefs();
  const a = data.addresses.find((x) => x.address_id === id);
  if (!a) return <Notice tone="warn" title={tr.noMatches} />;

  const j = data.jurisdictions[a.address_id];
  const lookups = data.lookups[asOf]?.[a.address_id];
  // With precomputed results, show exactly the rules the engine returned (rules that don't apply are
  // omitted from lookups). Without them, fall back to every rule in the record, shown as not evaluated.
  const rules = lookups
    ? lookups.map((li) => data.rules.find((r) => r.team_rule_id === li.team_rule_id)).filter((r): r is Rule => !!r)
    : rulesInRecord(data.rules, j);
  const groups = groupByCategory(rules);
  const missingFacts = blank(a.year_built) || blank(a.units) || blank(a.use_description);
  const differs = j?.place && j.place !== a.postal_city;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.addressDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm + 2, paddingBottom: space.xxxl }}>
        {/* Anchor (ID is the header title) */}
        <View style={{ gap: 0 }}>
          <Id>{a.address_id}</Id>
          <T variant="title" serif accessibilityRole="header" style={{ fontSize: 22, lineHeight: 27 }}>{a.street_address}</T>
          <T variant="small" muted>{a.postal_city}, {a.state} {a.zip}</T>
        </View>
        <View style={{ backgroundColor: color.tint, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 0, borderLeftWidth: 4, borderLeftColor: color.primary }}>
          <Kicker tone="primary">{tr.legalJurisdiction}</Kicker>
          <T bold style={{ fontSize: 17 }}>{j?.jurisdiction ?? tr.unresolved}</T>
          {differs ? <T variant="small" style={{ color: color.accent, fontWeight: "700" }}>≠ {tr.differs} ({a.postal_city})</T> : null}
          {j?.match && j.match !== "exact" ? <T variant="small" muted>{tr.fallback}</T> : null}
        </View>

        {/* Property summary */}
        <Card flat style={{ gap: 2, paddingVertical: space.xs + 2, paddingHorizontal: space.sm }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }} accessibilityLabel={ms.property}>
            <Fact label={tr.yearBuilt} value={a.year_built} missing={tr.notInRecord} />
            <Fact label={tr.units} value={a.units} missing={tr.notInRecord} />
            <Fact label={tr.use} value={a.use_description} missing={tr.notInRecord} />
          </View>
          {missingFacts && <T variant="micro" muted>{ms.notInferred}</T>}
        </Card>

        {!j?.jurisdiction ? (
          <Notice tone="warn" title={tr.unresolved}>{tr.unresolvedBody}</Notice>
        ) : rules.length === 0 ? (
          <Notice tone="info" title={ms.noRulesTitle}>{tr.noRules}</Notice>
        ) : (
          <>
            <SectionLabel right={<T variant="small" muted>{ms.rulesN(rules.length)}</T>}>{ms.rulesFor}</SectionLabel>
            {!lookups && <Notice tone="warn" title={tr.noLookups} />}
            {groups.map(([cat, list]) => (
              <View key={cat} style={{ gap: space.sm }}>
                <Kicker tone="primary">{tr.category[cat] ?? cat} · {list.length}</Kicker>
                {list.map((r) => <RuleCard key={r.team_rule_id} r={r} li={lookups?.find((x) => x.team_rule_id === r.team_rule_id)} addressId={a.address_id} />)}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RuleCard({ r, li, addressId }: { r: Rule; li: LookupItem | undefined; addressId: string }) {
  const { tr, ms, lang } = usePrefs();
  const router = useRouter();
  const explanation = li ? (lang === "es" && li.explanation_es ? li.explanation_es : li.explanation) : null;
  const hasEvidence = !!(r.quoted_span || r.citation || r.source_url);
  return (
    <Pressable
      onPress={() => router.push(`/search/rule/${r.team_rule_id}?address=${addressId}`)}
      accessibilityRole="link"
      accessibilityHint={ms.openRule}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={{ gap: space.xs + 2, paddingVertical: space.sm + 2 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}>
          <StatusBadge kind={li ? li.result : "unevaluated"} tr={tr} />
          {(li?.conflict_flag || r.conflict_flag) && <StatusBadge kind="review" tr={tr} />}
        </View>
        <T bold>{r.title}</T>
        <T variant="small" muted numberOfLines={2}>{explanation ?? r.requirement}</T>
        <View style={{ minHeight: minTouch, flexDirection: "row", alignItems: "center", gap: space.sm, borderTopWidth: 1, borderTopColor: color.line, marginTop: 2 }}>
          <T variant="small" bold style={{ flex: 1, color: color.primary }}>{hasEvidence ? ms.evidence : ms.openRule}</T>
          <Chevron />
        </View>
      </Card>
    </Pressable>
  );
}
