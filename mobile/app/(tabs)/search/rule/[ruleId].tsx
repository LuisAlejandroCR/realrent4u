// [ruleId].tsx: 04 rule details: result as a rubber stamp, plain-language reason, requirement (open),
// coverage, exemptions and source evidence. Opening the evidence earns the "source" stamp.
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { LegalDateBar } from "../../../../src/components/Chrome";
import { Stamp } from "../../../../src/components/motion";
import { EvidencePanel, Fold, Id, Kicker, Notice, T } from "../../../../src/components/ui";
import { haptic } from "../../../../src/feel";
import { readableDate, reasonText } from "../../../../src/format";
import { usePrefs } from "../../../../src/prefs";
import { badge, radius, space } from "../../../../src/theme";

/**
 * 04 Rule detail. Reading order: stamp → reason → requirement → evidence (citation, quote, retrieved, link).
 * Fields render only when present in the data.
 */
export default function RuleScreen() {
  const { ruleId, address } = useLocalSearchParams<{ ruleId: string; address?: string }>();
  const { tr, ms, data, asOf, lang, earn } = usePrefs();
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

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ms.ruleDetails }} />
      <LegalDateBar />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}>
        <View style={{ gap: space.sm }}>
          <Kicker tone="primary">{tr.category[r.category] ?? r.category}</Kicker>
          <T variant="title" serif accessibilityRole="header">{r.title}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}><Id>{r.team_rule_id}</Id><T variant="small" muted>{r.jurisdiction}</T><T variant="small" bold>{tr.ruleStatus}: {tr.status[r.status]}</T></View>
        </View>

        {/* The result lands like a stamp on the file; the reason sits right under it. */}
        <View style={{ backgroundColor: badge[kind].bg, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <T variant="micro" bold muted>{ms.evaluation} · {readableDate(asOf, lang)}</T>
          {li ? (
            <>
              <Stamp key={`${kind}-${asOf}`} kind={kind} label={label} />
              {why ? <T variant="small" bold style={{ color: badge[kind].fg }}>{why}</T> : null}
              <T variant="small">{explanation}</T>
            </>
          ) : (
            <>
              <T bold>{ms.evalNone}</T>
              <T variant="small">{ms.evalNoneBody(tr.status[r.status], readableDate(asOf, lang))}</T>
            </>
          )}
        </View>
        {conflict && <Notice tone="danger" title={ms.conflict}>{r.conflict_note ?? undefined}</Notice>}

        <View style={{ gap: space.sm }}>
          <Fold title={tr.requirement} preview={r.requirement || null} empty={ms.noInfo} hint={ms.tapToOpen} initiallyOpen={!!r.requirement}>
            {r.requirement ? <T>{r.requirement}</T> : null}
            {r.overrides?.length ? <T variant="small" muted>{tr.displaces(r.overrides.length)}: {r.overrides.join(", ")}</T> : null}
          </Fold>
          <Fold title={tr.coverage} preview={r.coverage_conditions?.text ? String(r.coverage_conditions.text) : null} empty={ms.noInfo} hint={ms.tapToOpen}>
            {r.coverage_conditions?.text ? <T variant="small">{String(r.coverage_conditions.text)}</T> : null}
          </Fold>
          <Fold title={ms.exemptions} preview={r.exemptions || null} empty={ms.noInfo} hint={ms.tapToOpen}>
            {r.exemptions ? <T variant="small">{r.exemptions}</T> : null}
          </Fold>
          {r.penalty ? (
            <Fold title={tr.penalty} preview={r.penalty} hint={ms.tapToOpen}>
              <T variant="small">{r.penalty}</T>
            </Fold>
          ) : null}
          <Fold title={ms.sourceEvidence} preview={retrieved} empty={ms.noInfo} hint={ms.tapToOpen} onOpen={() => earn("source")}>
            {hasEvidence ? <EvidencePanel rule={r} tr={tr} hint={ms.openExternal} retrievedLabel={retrieved ?? undefined} onSource={() => earn("source")} /> : null}
          </Fold>
        </View>
      </ScrollView>
    </View>
  );
}
