// [ruleId].tsx: 04 rule details, lean: stamp + one-line reason, three fact tiles, the requirement (clamped),
// the quoted evidence card, then only the detail sections the record actually has. Opening the source earns "source".
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LegalDateBar } from "../../../../../src/components/Chrome";
import { Stamp, Tap } from "../../../../../src/components/motion";
import { Disclosure, EvidencePanel, Fold, Kicker, Notice, T } from "../../../../../src/components/ui";
import { haptic } from "../../../../../src/feel";
import { readableDate, reasonText } from "../../../../../src/format";
import { usePrefs } from "../../../../../src/prefs";
import { badge, color, radius, space } from "../../../../../src/theme";

/** Reading order: result → why → what it requires → the source. Everything else is one tap away. */
export default function RuleScreen() {
  const { ruleId, address } = useLocalSearchParams<{ ruleId: string; address?: string }>();
  const { tr, ms, data, asOf, lang, earn } = usePrefs();
  const [more, setMore] = useState(false);
  const r = data.rules.find((x) => x.team_rule_id === ruleId);
  const li = r && address ? data.lookups[asOf]?.[address]?.find((x) => x.team_rule_id === r.team_rule_id) : undefined;
  const conflict = !!(li?.conflict_flag || r?.conflict_flag);
  useEffect(() => { if (conflict) haptic.warn(); }, [conflict]);
  if (!r) return <View style={{ padding: space.lg }}><Notice tone="warn" title={tr.ruleNotInRecord} /></View>;

  const explanation = li ? (lang === "es" && li.explanation_es ? li.explanation_es : li.explanation) : null;
  const kind = li ? li.result : "unevaluated";
  const label = kind === "unevaluated" ? tr.notEvaluated : tr.result[kind] ?? kind;
  const why = reasonText(li?.reason, ms.reasons, ms.displacedBy, (rid) => data.rules.find((x) => x.team_rule_id === rid)?.title);
  const retrieved = r.retrieved_at ? ms.retrievedOn(readableDate(r.retrieved_at, lang)) : null;
  const hasEvidence = !!(r.quoted_span || r.citation || r.source_url);
  const long = (r.requirement ?? "").length > 180;
  const coverage = r.coverage_conditions?.text ? String(r.coverage_conditions.text) : null;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.ruleDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
        <View style={{ gap: 4 }}>
          <Kicker tone="primary">{tr.category[r.category] ?? r.category}</Kicker>
          <T variant="title" serif accessibilityRole="header">{r.title}</T>
        </View>

        {/* 1 · Result: the stamp and one plain sentence. Opened without an address (Method, scenario) → no result. */}
        {address ? <View style={{ backgroundColor: badge[kind].bg, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <T variant="micro" bold muted>{ms.evaluation} · {readableDate(asOf, lang)}</T>
          {li ? (
            <>
              <Stamp key={`${kind}-${asOf}`} kind={kind} label={label} />
              {why ? <T variant="small" bold style={{ color: badge[kind].fg }}>{why}</T> : null}
              {explanation ? <Disclosure label={ms.fullExplanation}><T variant="small">{explanation}</T></Disclosure> : null}
            </>
          ) : (
            <>
              <T bold>{ms.evalNone}</T>
              <T variant="small">{ms.evalNoneBody(tr.status[r.status], readableDate(asOf, lang))}</T>
            </>
          )}
        </View> : null}
        {conflict && <Notice tone="danger" title={ms.conflict}>{r.conflict_note ?? undefined}</Notice>}

        {/* 2 · Three facts at a glance. */}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Tile label={tr.ruleStatus} value={tr.status[r.status] ?? r.status} />
          <Tile label={ms.effective} value={r.effective_date ? readableDate(r.effective_date, lang) : "—"} />
          <Tile label={ms.where} value={r.jurisdiction} />
        </View>

        {/* 3 · What it requires, clamped to three lines. */}
        {r.requirement ? (
          <View style={{ gap: 4 }}>
            <T variant="small" bold muted>{tr.requirement}</T>
            <T numberOfLines={more ? undefined : 3}>{r.requirement}</T>
            {long && (
              <Tap onPress={() => setMore(!more)} feel="select" accessibilityState={{ expanded: more }} style={{ alignSelf: "flex-start", paddingVertical: 4 }}>
                <Text style={{ color: color.primary, fontWeight: "800" }}>{more ? ms.less : ms.more}</Text>
              </Tap>
            )}
          </View>
        ) : null}

        {/* 4 · The source, visible: the quote is the trust signal. */}
        {hasEvidence ? <EvidencePanel rule={r} tr={tr} hint={ms.openExternal} retrievedLabel={retrieved ?? undefined} onSource={() => earn("source")} /> : null}

        {/* 5 · Only the sections this record actually has. */}
        {coverage || r.exemptions || r.penalty || r.overrides?.length ? (
          <View style={{ gap: space.sm }}>
            {coverage ? <Fold title={tr.coverage} hint={ms.tapToOpen}><T variant="small">{coverage}</T></Fold> : null}
            {r.exemptions ? <Fold title={ms.exemptions} hint={ms.tapToOpen}><T variant="small">{r.exemptions}</T></Fold> : null}
            {r.penalty ? <Fold title={tr.penalty} hint={ms.tapToOpen}><T variant="small">{r.penalty}</T></Fold> : null}
            {r.overrides?.length ? <Fold title={tr.displaces(r.overrides.length)} hint={ms.tapToOpen}><T variant="small">{r.overrides.join(", ")}</T></Fold> : null}
          </View>
        ) : null}
        <T variant="micro" muted>{r.team_rule_id}</T>
      </ScrollView>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, padding: space.sm, borderRadius: radius.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, gap: 2 }}>
      <Text maxFontSizeMultiplier={1.4} style={{ fontSize: 11, color: color.ink2, fontWeight: "600" }}>{label}</Text>
      <Text maxFontSizeMultiplier={1.4} numberOfLines={2} style={{ fontSize: 14, color: color.ink, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}
