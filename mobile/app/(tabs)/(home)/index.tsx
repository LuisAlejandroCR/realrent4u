// index.tsx: 01 Home as an executive summary: search, tappable KPIs, the "Start here" roadmap, a jurisdiction bubble
// map (tap → card → its addresses) and every result at the as-of date (tap a segment → top reasons).
import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalDateBar } from "../../../src/components/Chrome";
import { BarList, KpiRow, StackedBar } from "../../../src/components/Charts";
import { HouseMark, SearchIcon } from "../../../src/components/Icons";
import { PointsMap, type MapPoint } from "../../../src/components/Maps";
import { FadeIn, Tap } from "../../../src/components/motion";
import { ProfileButton, Roadmap } from "../../../src/components/Story";
import { Button, Card, Kicker, Mark, Notice, T } from "../../../src/components/ui";
import { rulesInRecord } from "../../../src/data";
import { readableDate, reasonText } from "../../../src/format";
import { usePrefs } from "../../../src/prefs";
import { badge, chart, chartBar, color, minTouch, radius, shadow, space } from "../../../src/theme";
import type { LookupResult } from "../../../src/types";

export default function Home() {
  const { tr, ms, data, asOf, lang, setQuery } = usePrefs();
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [mapY, setMapY] = useState(0);
  const [selJur, setSelJur] = useState<string | null>(null);
  const [selResult, setSelResult] = useState<string | null>(null);
  const day = data.lookups[asOf] ?? {};

  // One bubble per legal jurisdiction: centroid of its sample addresses, sized by how many there are.
  const jurs = Object.values(
    data.addresses.reduce<Record<string, { j: string; ids: string[]; lat: number; lon: number; n: number }>>((acc, a) => {
      const j = data.jurisdictions[a.address_id]?.jurisdiction;
      const g = data.geo[a.address_id];
      if (!j) return acc;
      acc[j] ??= { j, ids: [], lat: 0, lon: 0, n: 0 };
      acc[j].ids.push(a.address_id);
      if (g) { acc[j].lat += g[0]; acc[j].lon += g[1]; acc[j].n += 1; }
      return acc;
    }, {}),
  );
  const bubbles: MapPoint[] = jurs.filter((x) => x.n > 0).map((x) => ({
    id: x.j, lat: x.lat / x.n, lon: x.lon / x.n, fill: chartBar, size: Math.round(12 + Math.sqrt(x.ids.length) * 2.5),
  }));
  const jurInfo = (j: string) => {
    const x = jurs.find((y) => y.j === j)!;
    const items = x.ids.flatMap((id) => day[id] ?? []);
    const unknown = items.filter((i) => i.result === "unknown").length;
    return { n: x.ids.length, rules: rulesInRecord(data.rules, data.jurisdictions[x.ids[0]]).length, unknownPct: items.length ? Math.round((unknown / items.length) * 100) : 0 };
  };

  // Every result on the as-of date; a tapped segment lists the engine's top reasons for it.
  const counts: Record<string, number> = {};
  const why: Record<string, Record<string, number>> = {};
  Object.values(day).forEach((items) => items.forEach((i) => {
    counts[i.result] = (counts[i.result] ?? 0) + 1;
    i.reason?.split(",").forEach((c) => {
      const k = c.startsWith("superseded_by:") ? "superseded_by" : c;
      (why[i.result] ??= {})[k] = (why[i.result][k] ?? 0) + 1;
    });
  }));
  const results = (["applies", "unknown", "superseded", "not_yet_effective", "pending"] as LookupResult[])
    .map((k) => ({ key: k, label: tr.result[k] ?? k, value: counts[k] ?? 0, color: chart[k], glyph: badge[k].glyph }));
  const reasons = selResult ? Object.entries(why[selResult] ?? {})
    .map(([k, v]) => ({ key: k, label: k === "superseded_by" ? ms.groupSuperseded : reasonText(k, ms.reasons, ms.displacedBy, () => undefined) ?? k, value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 3) : [];

  const card = { gap: space.sm, padding: space.md };
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
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, paddingTop: space.md, gap: space.md, paddingBottom: space.xxl }}>
        <FadeIn index={0} style={{ gap: space.xs }}>
          <Kicker>{tr.heroKicker}</Kicker>
          <T variant="display" serif accessibilityRole="header" style={{ fontSize: 24, lineHeight: 29 }}>
            {tr.heroTitle2} <Mark variant="display" style={{ fontSize: 24, lineHeight: 29 }}>{tr.heroTitle2Em}</Mark>
          </T>
        </FadeIn>

        <FadeIn index={1}>
          <Tap
            accessibilityRole="search"
            accessibilityLabel={tr.ctaSearchShort}
            accessibilityHint={tr.searchHelp}
            // Pushes search in Home's stack (Back returns here). Nonce: every tap re-focuses the field.
            onPress={() => router.push(`/search?focus=${Date.now()}`)}
            style={[{ minHeight: minTouch + 16, borderRadius: radius.lg, backgroundColor: color.primary, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg }, shadow]}
          >
            <SearchIcon color={color.onPrimary} />
            <View style={{ flex: 1 }}>
              <T bold style={{ color: color.onPrimary, fontSize: 17 }}>{tr.ctaSearchShort}</T>
              <T variant="micro" style={{ color: color.onPrimary, opacity: 0.9 }}>{tr.searchPlaceholder}</T>
            </View>
          </Tap>
        </FadeIn>

        {/* Executive summary: four numbers, each one a door. */}
        <FadeIn index={2}>
          <KpiRow items={[
            { value: data.addresses.length, label: ms.kpiAddresses, onPress: () => router.push(`/search?focus=${Date.now()}`) },
            { value: jurs.length, label: ms.kpiJurisdictions, onPress: () => scroll.current?.scrollTo({ y: mapY - space.md, animated: true }) },
            { value: data.rules.length, label: ms.kpiRules, onPress: () => router.push("/method") },
            { value: data.manifest.lookup_dates.length, label: ms.kpiDates, onPress: () => router.push("/date") },
          ]} />
        </FadeIn>

        <FadeIn index={3}><Roadmap /></FadeIn>

        {bubbles.length > 0 && (
          <View onLayout={(e) => setMapY(e.nativeEvent.layout.y)}>
            <Card flat style={card}>
              <T variant="small" bold>{ms.mapJur}</T>
              <PointsMap points={bubbles} selected={selJur} onSelect={setSelJur} height={220} />
              {selJur ? (() => {
                const info = jurInfo(selJur);
                return (
                  <FadeIn key={selJur} style={{ gap: space.sm }}>
                    <T bold>{selJur}</T>
                    <T variant="small" muted>{ms.jurAddresses(info.n)} · {ms.jurRules(info.rules)} · {ms.jurUnknown(info.unknownPct)}</T>
                    <Button label={ms.seeAddresses} onPress={() => { setQuery(selJur); router.push("/search"); }} />
                  </FadeIn>
                );
              })() : <T variant="micro" muted>{ms.mapJurHint}</T>}
            </Card>
          </View>
        )}

        {Object.keys(counts).length > 0 && (
          <Card flat style={card}>
            <StackedBar key={asOf} title={ms.resultsAt(readableDate(asOf, lang))} segments={results} onSelect={setSelResult} />
            {reasons.length > 0 ? (
              <FadeIn key={selResult} style={{ gap: space.sm }}>
                <T variant="small" bold>{ms.topReasons}</T>
                <BarList rows={reasons} />
              </FadeIn>
            ) : <T variant="micro" muted>{ms.tapToDrill}</T>}
          </Card>
        )}

        <T variant="micro" muted style={{ textAlign: "center" }}>{ms.sampleCount(data.addresses.length)}</T>
        {data.manifest.uses_fixtures && <Notice tone="warn" title={tr.fixtures}>{tr.fixturesBody}</Notice>}
      </ScrollView>
    </SafeAreaView>
  );
}
