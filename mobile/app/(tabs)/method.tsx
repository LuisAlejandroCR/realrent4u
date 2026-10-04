// method.tsx: 08 Method & audit: how results are produced, data sources, dates, warnings and limits.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LangToggle, LegalDateBar } from "../../src/components/Chrome";
import { Card, Disclosure, Kicker, Notice, T } from "../../src/components/ui";
import { allDates } from "../../src/data";
import { usePrefs } from "../../src/prefs";
import { color, radius, space } from "../../src/theme";

/** 08 Method & audit — three plain sections: How it works · Data used · Limits. */
export default function MethodScreen() {
  const { tr, ms, data } = usePrefs();
  const mf = data.manifest;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: color.surface }}>
      <View style={{ backgroundColor: color.tint, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T variant="display" serif accessibilityRole="header">{tr.aboutTitle}</T>
          <LangToggle />
        </View>
        <T variant="small" muted>{tr.aboutLead}</T>
      </View>
      <LegalDateBar />
      <ScrollView style={{ backgroundColor: color.paper }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
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
