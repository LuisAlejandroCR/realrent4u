// Charts.tsx: small native chart kit: KPI tiles, a stacked part-to-whole bar with tap-to-reveal and legend,
// and a one-hue bar list ("x of n"). Plain Views, direct labels everywhere, motion off under Reduce Motion.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { haptic, useReduceMotion } from "../feel";
import { chartBar, chartTrack, color, font, radius, space } from "../theme";
import { T } from "./ui";

/** Grows a 0→1 value once on mount (width animations run on the JS driver). */
function useGrow(delay = 0) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, reduce, delay]);
  return v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
}

export interface Kpi { value: string | number; label: string; tone?: string }

/** KPI row: 2 per line on phones. The number is the chart. */
export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {items.map((k) => (
        <View key={k.label} accessible accessibilityLabel={`${k.value} ${k.label}`}
          style={{ flexBasis: "47%", flexGrow: 1, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderTopWidth: 3, borderTopColor: k.tone ?? chartBar }}>
          <Text maxFontSizeMultiplier={1.4} style={{ fontSize: 28, lineHeight: 32, fontWeight: "800", color: color.ink }}>{k.value}</Text>
          <T variant="micro" muted>{k.label}</T>
        </View>
      ))}
    </View>
  );
}

export interface Segment { key: string; label: string; value: number; color: string; glyph?: string }

/**
 * Horizontal stacked bar (part-to-whole). 2 px surface gaps between segments, rounded ends.
 * Tap a segment to name it in the caption; the legend below always lists every value.
 */
export function StackedBar({ segments, title, legend = true, delay = 0 }: { segments: Segment[]; title?: string; legend?: boolean; delay?: number }) {
  const width = useGrow(delay);
  const [sel, setSel] = useState<string | null>(null);
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0);
  const picked = shown.find((s) => s.key === sel);
  return (
    <View style={{ gap: 6 }}>
      {title ? <T variant="small" bold>{title}</T> : null}
      <View accessible accessibilityRole="image" accessibilityLabel={`${title ? `${title}: ` : ""}${shown.map((s) => `${s.value} ${s.label}`).join(", ")}`}
        style={{ height: 18, borderRadius: 4, backgroundColor: chartTrack, overflow: "hidden" }}>
        <Animated.View style={{ flexDirection: "row", height: "100%", width }}>
          {shown.map((s, i) => (
            <Pressable key={s.key} onPress={() => { haptic.select(); setSel(sel === s.key ? null : s.key); }} hitSlop={{ top: 12, bottom: 12 }}
              style={{ flex: s.value / (total || 1), marginLeft: i ? 2 : 0, backgroundColor: s.color, opacity: sel && sel !== s.key ? 0.35 : 1 }} />
          ))}
        </Animated.View>
      </View>
      {picked ? (
        <T variant="small" bold>{picked.glyph ? `${picked.glyph} ` : ""}{picked.label} · {picked.value} ({Math.round((picked.value / total) * 100)}%)</T>
      ) : null}
      {legend && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: 4 }}>
          {shown.map((s) => (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
              <Text maxFontSizeMultiplier={1.4} style={{ fontSize: 12, color: color.ink2 }}>
                {s.glyph ? `${s.glyph} ` : ""}{s.label} <Text style={{ color: color.ink, fontWeight: "700" }}>{s.value}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export interface BarRow { key: string; label: string; value: number; total?: number }

/** One-hue horizontal bars, label above, "value" or "value of total" right-aligned. Track = total when given. */
export function BarList({ rows, max, unit, onPress }: { rows: BarRow[]; max?: number; unit?: (r: BarRow) => string; onPress?: (r: BarRow) => void }) {
  const width = useGrow();
  const top = max ?? Math.max(1, ...rows.map((r) => r.total ?? r.value));
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r) => {
        const body = (
          <View style={{ gap: 4 }} accessible accessibilityLabel={`${r.label}: ${unit ? unit(r) : r.value}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
              <T variant="small" numberOfLines={1} style={{ flex: 1 }}>{r.label}</T>
              <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.mono, fontSize: 13, fontWeight: "700", color: color.ink }}>{unit ? unit(r) : r.value}</Text>
            </View>
            <Animated.View style={{ width }}>
              <View style={{ height: 10, borderRadius: 4, backgroundColor: r.total != null ? chartTrack : "transparent", width: `${((r.total ?? r.value) / top) * 100}%` }}>
                <View style={{ height: "100%", borderRadius: 4, backgroundColor: chartBar, width: `${(r.value / ((r.total ?? r.value) || 1)) * 100}%`, minWidth: r.value > 0 ? 4 : 0 }} />
              </View>
            </Animated.View>
          </View>
        );
        return onPress ? (
          <Pressable key={r.key} onPress={() => { haptic.tap(); onPress(r); }} accessibilityRole="button">{body}</Pressable>
        ) : <View key={r.key}>{body}</View>;
      })}
    </View>
  );
}
