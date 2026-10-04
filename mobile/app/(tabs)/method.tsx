// method.tsx: 08 Method & audit: tappable KPIs, a results chart that drills into categories and reasons, rules by
// category that open their rules, then how results are produced, data sources, dates, warnings and limits.
import { useRouter } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalDateBar } from "../../src/components/Chrome";
import { ProfileButton } from "../../src/components/Story";
import { BarList, KpiRow, StackedBar } from "../../src/components/Charts";
import { FadeIn, Tap } from "../../src/components/motion";
import { Card, Chevron, Disclosure, Kicker, Notice, T } from "../../src/components/ui";
import { allDates } from "../../src/data";
import { reasonText } from "../../src/format";
import { readableDate } from "../../src/format";
import { usePrefs } from "../../src/prefs";
import { badge, chart, color, radius, space } from "../../src/theme";
import type { LookupResult } from "../../src/types";

/** 08 Method & audit — three plain sections: How it works · Data used · Limits. */
export default function MethodScreen() {
  const { tr, ms, data, asOf, lang } = usePrefs();
  const mf = data.manifest;
  const byCat = Object.entries(data.rules.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + 1 }), {}))
    .map(([k, v]) => ({ key: k, label: tr.category[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const counts: Record<string, number> = {};
  Object.values(data.lookups[asOf] ?? {}).forEach((items) => items.forEach((i) => { counts[i.result] = (counts[i.result] ?? 0) + 1; }));
  const results = (["applies", "unknown", "superseded", "not_yet_effective", "pending"] as LookupResult[])
    .map((k) => ({ key: k, label: tr.result[k] ?? k, value: counts[k] ?? 0, color: chart[k], glyph: badge[k].glyph }));
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [catY, setCatY] = useState(0);
  const [dataY, setDataY] = useState(0);
  const [selResult, setSelResult] = useState<string | null>(null);
  const [selCat, setSelCat] = useState<string | null>(null);

  // Drill-down 1: one result → where it comes from (by category) and, when the engine gave reasons, why.
  const ruleCat = new Map(data.rules.map((r) => [r.team_rule_id, r.category]));
  const drill = selResult ? (() => {
    const cat: Record<string, number> = {};
    const why: Record<string, number> = {};
    Object.values(data.lookups[asOf] ?? {}).forEach((items) => items.forEach((i) => {
      if (i.result !== selResult) return;
      const c = ruleCat.get(i.team_rule_id) ?? "?";
      cat[c] = (cat[c] ?? 0) + 1;
      if (i.reason) i.reason.split(",").forEach((code) => {
        const k = code.startsWith("superseded_by:") ? "superseded_by" : code;
        why[k] = (why[k] ?? 0) + 1;
      });
    }));
    const rows = (o: Record<string, number>, label: (k: string) => string) =>
      Object.entries(o).map(([k, v]) => ({ key: k, label: label(k), value: v })).sort((a, b) => b.value - a.value).slice(0, 6);
    return {
      cats: rows(cat, (k) => tr.category[k] ?? k),
      reasons: rows(why, (k) => (k === "superseded_by" ? ms.groupSuperseded : reasonText(k, ms.reasons, ms.displacedBy, () => undefined) ?? k)),
    };
  })() : null;
  // Drill-down 2: one category → its rules, each opening the rule.
  const catRules = selCat ? data.rules.filter((r) => r.category === selCat) : [];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: color.surface }}>
      <View style={{ backgroundColor: color.tint, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T variant="display" serif accessibilityRole="header">{tr.aboutTitle}</T>
          <ProfileButton />
        </View>
        <T variant="small" muted>{tr.aboutLead}</T>
      </View>
      <LegalDateBar />
      <ScrollView ref={scroll} style={{ backgroundColor: color.paper }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
        {/* Numbers and pictures first; prose only where a picture can't say it. */}
        <Kicker tone="muted">{ms.glance}</Kicker>
        {/* Every tile goes somewhere: the chart it summarises, the search, the date picker, the sources. */}
        <KpiRow items={[
          { value: data.rules.length, label: ms.kpiRules, onPress: () => scroll.current?.scrollTo({ y: catY - space.md, animated: true }) },
          { value: mf.sources.corpus?.count ?? "—", label: ms.kpiDocs, onPress: () => scroll.current?.scrollTo({ y: dataY - space.md, animated: true }) },
          { value: data.addresses.length, label: ms.kpiAddresses, onPress: () => router.push(`/search?focus=${Date.now()}`) },
          { value: mf.lookup_dates.length, label: ms.kpiDates, onPress: () => router.push("/date") },
        ]} />
        {Object.keys(counts).length > 0 && (
          <Card flat style={{ gap: space.md, padding: space.md }}>
            <StackedBar key={asOf} title={ms.resultsAt(readableDate(asOf, lang))} segments={results} onSelect={setSelResult} />
            {drill ? (
              <FadeIn key={selResult} style={{ gap: space.md }}>
                <View style={{ gap: space.sm }}>
                  <T variant="small" bold>{ms.byCategoryFor(tr.result[selResult!] ?? selResult!)}</T>
                  <BarList rows={drill.cats} onPress={(r) => setSelCat(r.key === "?" ? null : r.key)} />
                </View>
                {drill.reasons.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    <T variant="small" bold>{ms.why}</T>
                    <BarList rows={drill.reasons} />
                  </View>
                )}
              </FadeIn>
            ) : <T variant="micro" muted>{ms.tapToDrill}</T>}
          </Card>
        )}
        <View onLayout={(e) => setCatY(e.nativeEvent.layout.y)}>
          <Card flat style={{ gap: space.sm, padding: space.md }}>
            <T variant="small" bold>{ms.rulesByCategory}</T>
            <BarList rows={byCat} selected={selCat} onPress={(r) => setSelCat(selCat === r.key ? null : r.key)} />
            {selCat ? (
              <FadeIn key={selCat} style={{ gap: space.xs, marginTop: space.xs }}>
                <T variant="small" bold>{ms.rulesIn(tr.category[selCat] ?? selCat)} · {catRules.length}</T>
                {catRules.map((r) => (
                  <Tap key={r.team_rule_id} onPress={() => router.push(`/search/rule/${r.team_rule_id}`)} accessibilityRole="link"
                    style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.line }}>
                    <View style={{ flex: 1 }}>
                      <T variant="small" bold numberOfLines={2}>{r.title}</T>
                      <T variant="micro" muted>{r.jurisdiction} · {tr.status[r.status] ?? r.status}</T>
                    </View>
                    <Chevron />
                  </Tap>
                ))}
              </FadeIn>
            ) : null}
          </Card>
        </View>

        <Section n="1" title={ms.howTitle}>
          <T>{ms.howSummary}</T>
          <Disclosure label={ms.moreSteps}>
            <View style={{ gap: space.sm }}>
              {[tr.m1, tr.m2, tr.m3].map((s, i) => (
                <View key={i} style={{ flexDirection: "row", gap: space.md }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.primary, marginTop: 8 }} />
                  <T variant="small" style={{ flex: 1 }}>{s}</T>
                </View>
              ))}
            </View>
          </Disclosure>
        </Section>

        <View onLayout={(e) => setDataY(e.nativeEvent.layout.y)} />
        <Section n="2" title={ms.dataTitle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.sm, backgroundColor: mf.uses_fixtures ? color.amberTint : color.primaryTint }}>
            <T bold style={{ color: mf.uses_fixtures ? color.amber : color.primary }}>{mf.uses_fixtures ? "!" : "✓"}</T>
            <T variant="small" bold>{mf.uses_fixtures ? ms.usesFixturesYes : ms.usesFixturesNo}</T>
          </View>
          <Disclosure label={ms.auditDetails}>
          {Object.entries(mf.sources).map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.line }}>
              <T variant="small" bold>{k}</T>
              <T variant="small" muted style={{ color: v.kind === "missing" ? color.amber : color.ink2, fontWeight: v.kind === "missing" ? "700" : "400" }}>{v.kind}{v.count != null ? ` · ${v.count}` : ""}</T>
            </View>
          ))}
          <Kicker tone="muted">{tr.dates}</Kicker>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {allDates(mf).map((d) => <View key={d} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line }}><T variant="small" mono>{d}</T></View>)}
          </View>
          <T variant="micro" muted>{tr.generated}: {mf.generated_at}</T>
          </Disclosure>
        </Section>

        <Section n="3" title={ms.limitsTitle}>
          <T>{tr.m4}</T>
          <Disclosure label={`${tr.warnings} (${mf.warnings.length})`}>
          {mf.warnings.length ? mf.warnings.map((w) => <Notice key={w} tone="warn" title={w} />) : <T muted>{tr.none}</T>}
          </Disclosure>
          <T variant="small" style={{ color: color.accent }}>§ {tr.evidenceNote}</T>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <Card flat style={{ gap: space.sm, padding: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <T serif style={{ color: color.accentBrand, fontSize: 22, fontStyle: "italic" }}>{n}</T>
        <T variant="title" serif accessibilityRole="header">{title}</T>
      </View>
      {children}
    </Card>
  );
}
