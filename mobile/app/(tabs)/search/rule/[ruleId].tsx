// [ruleId].tsx: 04 rule details: status, evaluation for the address, requirement, coverage and source evidence.
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { LegalDateBar } from "../../../../src/components/Chrome";
import { EvidencePanel, Fold, Id, Kicker, Notice, StatusBadge, T } from "../../../../src/components/ui";
import { readableDate } from "../../../../src/format";
import { usePrefs } from "../../../../src/prefs";
import { badge, radius, space } from "../../../../src/theme";

/**
 * 04 Rule detail. Reading order: result → reason → requirement → evidence (citation, quote, retrieved, link).
 * Fields render only when present in the data.
 */
export default function RuleScreen() {
  const { ruleId, address } = useLocalSearchParams<{ ruleId: string; address?: string }>();
  const { tr, ms, data, asOf, lang } = usePrefs();
  const r = data.rules.find((x) => x.team_rule_id === ruleId);
  if (!r) return <Notice tone="warn" title={tr.ruleNotInRecord} />;
  const li = address ? data.lookups[asOf]?.[address]?.find((x) => x.team_rule_id === r.team_rule_id) : undefined;
  const explanation = li ? (lang === "es" && li.explanation_es ? li.explanation_es : li.explanation) : null;
  const conflict = li?.conflict_flag || r.conflict_flag;
  const kind = li ? li.result : "unevaluated";
  const retrieved = r.retrieved_at ? ms.retrievedOn(readableDate(r.retrieved_at, lang)) : null;

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

        {/* Result first, short */}
        <View style={{ backgroundColor: badge[kind].bg, borderRadius: radius.md, padding: space.md, gap: space.xs, borderLeftWidth: 4, borderLeftColor: badge[kind].fg }}>
          <T variant="micro" bold muted>{ms.evaluation}</T>
          {li ? (
            <>
              <StatusBadge kind={kind} tr={tr} />
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

        {/* Detail, one tap away. Closed sections preview one line from the record, or say it has none. */}
        <View style={{ gap: space.sm }}>
          {li?.reason ? (
            <Fold title={ms.why} preview={li.reason} hint={ms.tapToOpen}>
              <T variant="small">{li.result === "superseded" ? ms.displacedReason : tr.missingField}: {li.reason}</T>
            </Fold>
          ) : null}
          <Fold title={tr.requirement} preview={r.requirement || null} empty={ms.noInfo} hint={ms.tapToOpen}>
            {r.requirement ? <T>{r.requirement}</T> : null}
            {r.overrides?.length ? <T variant="small" muted>{tr.displaces(r.overrides.length)}: {r.overrides.join(", ")}</T> : null}
          </Fold>
          <Fold title={tr.coverage} preview={r.coverage_conditions?.text ? String(r.coverage_conditions.text) : null} empty={ms.noInfo} hint={ms.tapToOpen}>
            {r.coverage_conditions?.text ? <T variant="small">{String(r.coverage_conditions.text)}</T> : null}
          </Fold>
          <Fold title={ms.exemptions} preview={r.exemptions || null} empty={ms.noInfo} hint={ms.tapToOpen}>
            {r.exemptions ? <T variant="small">{r.exemptions}</T> : null}
          </Fold>
          <Fold
            title={ms.evidence.replace(/^View |^Ver /, "").replace(/^./, (c) => c.toUpperCase())}
            preview={retrieved}
            empty={ms.noInfo}
            hint={ms.tapToOpen}
          >
            {(r.quoted_span || r.citation || r.source_url) ? <EvidencePanel rule={r} tr={tr} hint={ms.openExternal} retrievedLabel={retrieved ?? undefined} /> : null}
          </Fold>
        </View>
      </ScrollView>
    </View>
  );
}

