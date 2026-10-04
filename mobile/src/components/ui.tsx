// ui.tsx: design-system primitives: text, buttons, rows, status badges, notices, cards, folds.
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { haptic } from "../feel";
import { isAndroid } from "../platform";
import { badge, color, font, minTouch, radius, shadow, space, type, type BadgeKind } from "../theme";
import type { Dict } from "../i18n";
import type { Rule } from "../types";
import { ChevronIcon, ExternalIcon } from "./Icons";

export function T({ children, style, variant = "body", muted, serif, mono, bold, accessibilityRole, numberOfLines }: {
  children: ReactNode; style?: object; variant?: keyof typeof type; muted?: boolean; serif?: boolean; mono?: boolean; bold?: boolean;
  accessibilityRole?: "header" | "text"; numberOfLines?: number;
}) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[type[variant], { color: muted ? color.ink2 : color.ink }, bold && { fontWeight: "700" }, serif && { fontFamily: font.serif }, mono && { fontFamily: font.mono }, style]}
    >
      {children}
    </Text>
  );
}

export function Kicker({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "primary" | "muted" }) {
  const c = tone === "accent" ? color.accent : tone === "primary" ? color.primary : color.ink2;
  return <Text maxFontSizeMultiplier={1.6} style={[s.kicker, { color: c }]}>{children}</Text>;
}

/** Marker-highlighted words inside a headline (ink text on yellow — 12:1). */
export function Mark({ children, variant = "hero", style }: { children: ReactNode; variant?: keyof typeof type; style?: object }) {
  return <Text style={[type[variant], style, { fontFamily: font.serif, fontStyle: "italic", color: color.ink, backgroundColor: color.marker }]}>{children}</Text>;
}

export function Card({ children, style, flat }: { children: ReactNode; style?: ViewStyle; flat?: boolean }) {
  return <View style={[s.card, !flat && shadow, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = "primary", hint, icon, compact }: {
  label: string; onPress: () => void; variant?: "primary" | "ghost" | "quiet"; hint?: string; icon?: ReactNode; compact?: boolean;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      android_ripple={{ color: primary ? color.primaryPressed : color.tint }}
      style={({ pressed }) => [
        s.btn, compact && { paddingHorizontal: space.md, alignSelf: "flex-start" },
        primary ? { backgroundColor: pressed && !isAndroid ? color.primaryPressed : color.primary } : variant === "ghost" ? s.btnGhost : null,
      ]}
    >
      <Text style={[s.btnText, { color: primary ? color.onPrimary : color.primary }]}>{label}</Text>
      {icon}
    </Pressable>
  );
}

export function Chevron() {
  return <ChevronIcon color={color.ink2} />;
}

export function Id({ children, tone = "primary" }: { children: ReactNode; tone?: "primary" | "accent" }) {
  const c = tone === "primary" ? color.primary : color.accent;
  return (
    <View style={[s.idChip, { borderColor: c }]}>
      <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: font.mono, color: c, fontWeight: "700", ...type.micro }}>{children}</Text>
    </View>
  );
}

export function StatusBadge({ kind, tr, large }: { kind: BadgeKind; tr: Dict; large?: boolean }) {
  const b = badge[kind];
  const label = kind === "unevaluated" ? tr.notEvaluated : kind === "review" ? tr.needsReview : tr.result[kind] ?? kind;
  return (
    <View style={[s.badge, { backgroundColor: b.bg, borderColor: b.fg }, large && { paddingVertical: 6, paddingHorizontal: 12 }]} accessible accessibilityLabel={label}>
      <Text style={{ color: b.fg, fontWeight: "800" }}>{b.glyph}</Text>
      <Text style={{ color: b.fg, fontWeight: "700", ...(large ? type.body : type.small) }}>{label}</Text>
    </View>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger"; title: string; children?: ReactNode }) {
  const c = tone === "danger" ? color.danger : tone === "warn" ? color.amber : color.primary;
  const bg = tone === "danger" ? color.dangerTint : tone === "warn" ? color.amberTint : color.tint;
  return (
    <View style={[s.notice, { backgroundColor: bg }]} accessibilityRole="summary">
      <View style={[s.noticeDot, { backgroundColor: c }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <T bold style={{ color: tone === "info" ? color.ink : c }}>{title}</T>
        {children ? <T variant="small">{children}</T> : null}
      </View>
    </View>
  );
}

/** Designed empty / no-match / error state: illustration slot, headline, body, optional action. */
export function StateBlock({ art, title, body, action }: { art: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={s.state} accessibilityRole="summary">
      <View style={s.stateArt}>{art}</View>
      <T variant="title" serif style={{ textAlign: "center" }}>{title}</T>
      {body ? <T muted style={{ textAlign: "center" }}>{body}</T> : null}
      {action}
    </View>
  );
}

/** One building fact. Missing values are visually distinct (amber dashed, "?") and read aloud as missing. */
export function Fact({ label, value, missing }: { label: string; value: string | null | undefined; missing: string }) {
  const empty = value == null || String(value).trim() === "";
  return (
    <View style={[s.fact, empty && s.factMissing]} accessible accessibilityLabel={`${label}: ${empty ? missing : value}`}>
      <Text maxFontSizeMultiplier={1.6} style={{ ...type.micro, color: empty ? color.amber : color.ink2, fontWeight: "600" }}>{label}</Text>
      {empty ? <T variant="small" bold style={{ color: color.amber }}>? {missing}</T> : <T variant="small" bold>{value}</T>}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg, marginBottom: space.xs }}>
      <T variant="title" serif accessibilityRole="header">{children}</T>
      {right}
    </View>
  );
}

/** Accordion with aria-expanded semantics. */
export function Disclosure({ label, children, initiallyOpen = false }: { label: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View>
      <Pressable
        onPress={() => { haptic.select(); setOpen(!open); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ minHeight: minTouch, flexDirection: "row", alignItems: "center", gap: space.sm }}
      >
        <Text style={{ color: color.primary, fontWeight: "800", width: 14 }}>{open ? "−" : "+"}</Text>
        <T variant="small" bold style={{ color: color.primary }}>{label}</T>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/** Collapsible section row (card) — header is a full-width button with aria-expanded. */
/**
 * Collapsible section. When closed it shows a one-line preview from the record (or `empty` text when the record has
 * nothing), so closed sections still tell you what is inside. The full text is never truncated once open.
 */
export function Fold({ title, children, initiallyOpen = false, preview, empty, hint, onOpen }: { title: string; children?: ReactNode; initiallyOpen?: boolean; preview?: string | null; empty?: string; hint?: string; onOpen?: () => void }) {
  const [open, setOpen] = useState(initiallyOpen);
  const hasContent = children != null && children !== false;
  // Never truncate legal text: a preview is shown only when it fits whole on a line; otherwise just the title.
  const fits = preview && preview.length <= 44 ? preview : null;
  const line = hasContent ? fits : empty ?? null;
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, overflow: "hidden" }}>
      <Pressable
        onPress={() => {
          if (!hasContent) return;
          haptic.select();
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        disabled={!hasContent}
        accessibilityRole="button"
        accessibilityLabel={line && !open ? `${title}. ${line}` : title}
        accessibilityHint={hasContent && !open ? hint : undefined}
        accessibilityState={{ expanded: hasContent ? open : undefined, disabled: !hasContent }}
        style={({ pressed }) => ({ minHeight: minTouch + 4, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: pressed ? color.tint : color.surface })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <T bold>{title}</T>
          {!open && line ? <T variant="small" muted style={hasContent ? undefined : { fontStyle: "italic" }}>{line}</T> : null}
        </View>
        {hasContent ? <Text style={{ color: color.primary, fontWeight: "800", fontSize: 18, transform: [{ rotate: open ? "90deg" : "0deg" }] }}>›</Text> : null}
      </Pressable>
      {open && hasContent ? <View style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm }}>{children}</View> : null}
    </View>
  );
}

/** Document-excerpt panel for quoted source text + citation + retrieval date + link. Only renders fields that exist. */
export function EvidencePanel({ rule, tr, hint, retrievedLabel, onSource }: { rule: Rule; tr: Dict; hint: string; retrievedLabel?: string; onSource?: () => void }) {
  return (
    <View style={s.evidence}>
      <Kicker tone="muted">{tr.quoted}</Kicker>
      {rule.quoted_span ? <T serif style={{ fontStyle: "italic" }}>“{rule.quoted_span}”</T> : <T muted>—</T>}
      <View style={s.evMeta}>
        {rule.citation ? <T variant="small"><T variant="small" bold>{tr.citation} </T>{rule.citation}</T> : null}
        {rule.retrieved_at ? <T variant="small">{retrievedLabel ?? `${tr.retrieved} ${rule.retrieved_at}`}</T> : null}
      </View>
      {rule.source_url ? (
        <Button
          variant="ghost"
          compact
          label={tr.source}
          hint={hint}
          icon={<ExternalIcon color={color.primary} />}
          onPress={() => { haptic.tap(); onSource?.(); WebBrowser.openBrowserAsync(rule.source_url!, { toolbarColor: color.surface, controlsColor: color.primary }); }}
        />
      ) : null}
    </View>
  );
}

export const s = StyleSheet.create({
  kicker: { fontWeight: "700", ...type.small },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, padding: space.lg },
  btn: { minHeight: minTouch + 4, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: space.sm, paddingHorizontal: space.xl, overflow: "hidden" },
  btnGhost: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.primary },
  btnText: { fontWeight: "800", ...type.body },
  idChip: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  notice: { flexDirection: "row", gap: space.md, borderRadius: radius.md, padding: space.md },
  noticeDot: { width: 4, borderRadius: 2 },
  state: { alignItems: "center", gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xl },
  stateArt: { width: 72, height: 72, borderRadius: 36, backgroundColor: color.tint, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  fact: { flexBasis: "30%", flexGrow: 1, gap: 0, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: color.paper },
  factMissing: { backgroundColor: color.amberTint, borderWidth: 1, borderStyle: "dashed", borderColor: color.amber },
  evidence: { backgroundColor: color.sand, borderRadius: radius.md, borderLeftWidth: 4, borderLeftColor: color.accent, padding: space.lg, gap: space.sm },
  evMeta: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.lineStrong, paddingTop: space.sm },
});
