// Story.tsx: the exploration layer: profile avatar with stamp ring, stamp toast, case-file list,
// and the "try a tricky one" quick wins that open real sample addresses.
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { nativeDriver, useReduceMotion } from "../feel";
import { STAMPS, usePrefs, type StampId } from "../prefs";
import { color, font, radius, shadow, space } from "../theme";
import { ChevronIcon, UserIcon } from "./Icons";
import { FadeIn, Tap } from "./motion";
import { T } from "./ui";

export const stampGlyph: Record<StampId, string> = { find: "A", mismatch: "≠", source: "§", time: "◷", scenario: "T" };

/** Round stamp mark. Earned: marigold ink, slightly rotated. Not yet: dashed outline. */
export function StampMark({ id, earned, size = 34 }: { id: StampId; earned: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
        borderWidth: 2, borderStyle: earned ? "solid" : "dashed",
        borderColor: earned ? color.accentBrand : color.lineStrong,
        backgroundColor: earned ? color.accentTint : "transparent",
        transform: [{ rotate: earned ? "-8deg" : "0deg" }],
      }}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.serif, fontWeight: "800", fontSize: size * 0.45, color: earned ? color.accent : color.lineStrong }}>{stampGlyph[id]}</Text>
    </View>
  );
}

/** Avatar button for the tab headers: person icon inside a ring that fills with stamps (k/5). */
export function ProfileButton() {
  const { ms, stamps } = usePrefs();
  const router = useRouter();
  const size = 42;
  const r = 18;
  const c = 2 * Math.PI * r;
  const k = stamps.length;
  return (
    <Tap
      onPress={() => router.push("/profile")}
      feel="tap"
      accessibilityLabel={`${ms.profile}. ${ms.stampProgress(k, STAMPS.length)}`}
      accessibilityHint={ms.profileOpen}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size} viewBox="0 0 42 42" style={{ position: "absolute" }}>
        <Circle cx="21" cy="21" r={r} stroke={color.line} strokeWidth={3} fill="none" />
        {k > 0 && (
          <Circle
            cx="21" cy="21" r={r} stroke={k === STAMPS.length ? color.accentBrand : color.primary} strokeWidth={3} fill="none"
            strokeDasharray={`${(c * k) / STAMPS.length} ${c}`} strokeLinecap="round" transform="rotate(-90 21 21)"
          />
        )}
      </Svg>
      <UserIcon color={color.ink} size={20} />
    </Tap>
  );
}

/** Slides down from the top when a new stamp is earned, then leaves. Never blocks touches. */
export function StampToast() {
  const { lastStamp, clearLastStamp, ms, stamps } = usePrefs();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lastStamp) return;
    v.setValue(reduce ? 1 : 0);
    const show = Animated.timing(v, { toValue: 1, duration: reduce ? 0 : 380, easing: Easing.out(Easing.back(1.6)), useNativeDriver: nativeDriver });
    const hide = Animated.timing(v, { toValue: 0, duration: reduce ? 0 : 260, delay: 2200, useNativeDriver: nativeDriver });
    Animated.sequence([show, hide]).start(({ finished }) => finished && clearLastStamp());
    // Frames can pause (backgrounded app); the toast must still leave.
    const away = setTimeout(clearLastStamp, 3200);
    return () => { v.stopAnimation(); clearTimeout(away); };
  }, [lastStamp, reduce, v, clearLastStamp]);
  if (!lastStamp) return null;
  const done = stamps.length === STAMPS.length;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute", top: insets.top + space.sm, left: space.lg, right: space.lg, zIndex: 50,
        opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }],
      }}
    >
      <View style={[{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.ink }, shadow]}>
        <StampMark id={lastStamp} earned size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: color.marker, fontWeight: "800", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>{ms.stampEarned} · {ms.stampProgress(stamps.length, STAMPS.length)}</Text>
          <Text style={{ color: color.surface, fontWeight: "700", fontSize: 16 }}>{done ? ms.stampDone : ms.stamp[lastStamp]}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

/** Case-file strip for Home: five marks + progress. Tapping expands the stamp list in place (no navigation). */
export function CaseFileStrip() {
  const { ms, stamps } = usePrefs();
  const [open, setOpen] = useState(false);
  const k = stamps.length;
  return (
    <View style={{ gap: space.sm }}>
      <Tap onPress={() => setOpen(!open)} feel="select" accessibilityLabel={`${ms.stampTitle}: ${ms.stampProgress(k, STAMPS.length)}`} accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {STAMPS.map((id) => <StampMark key={id} id={id} earned={stamps.includes(id)} size={30} />)}
        </View>
        <View style={{ flex: 1 }}>
          <T variant="small" bold>{ms.stampTitle}</T>
          <T variant="micro" muted>{k === STAMPS.length ? ms.stampDone : ms.stampProgress(k, STAMPS.length)}</T>
        </View>
        <Text style={{ color: color.primary, fontWeight: "800", fontSize: 18, transform: [{ rotate: open ? "90deg" : "0deg" }] }}>›</Text>
      </Tap>
      {open && (
        <FadeIn style={{ padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line }}>
          <CaseFileList />
        </FadeIn>
      )}
    </View>
  );
}

/** Full case file for the profile sheet: each stamp with its name, or how to earn it. */
export function CaseFileList() {
  const { ms, stamps } = usePrefs();
  return (
    <View style={{ gap: space.sm }}>
      {STAMPS.map((id) => {
        const on = stamps.includes(id);
        return (
          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: space.md }} accessible accessibilityLabel={`${ms.stamp[id]}. ${on ? ms.stampEarned : ms.stampHow[id]}`}>
            <StampMark id={id} earned={on} />
            <View style={{ flex: 1 }}>
              <T variant="small" bold style={on ? undefined : { color: color.ink2 }}>{ms.stamp[id]}</T>
              {!on && <T variant="micro" muted>{ms.stampHow[id]}</T>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Three real sample addresses that each tell one story of the brief: postal ≠ legal jurisdiction,
 * neighborhood under city rules, state/local conflict. Rows whose address is missing are skipped.
 */
export function QuickWins() {
  const { ms, data } = usePrefs();
  const router = useRouter();
  const picks: { id: string; story: string; tone: "accent" | "danger" }[] = [
    { id: "A0065", story: ms.tryMismatch, tone: "accent" },
    { id: "A0322", story: ms.tryNeighborhood, tone: "accent" },
    { id: "A0002", story: ms.tryConflict, tone: "danger" },
  ];
  const rows = picks.flatMap((p) => {
    const a = data.addresses.find((x) => x.address_id === p.id);
    const j = data.jurisdictions[p.id];
    return a && j?.jurisdiction ? [{ ...p, a, legal: j.jurisdiction, differs: !!j.place && j.place !== a.postal_city }] : [];
  });
  if (!rows.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <T variant="small" bold muted>{ms.tryTitle}</T>
      {rows.map(({ id, story, tone, a, legal, differs }) => (
        <Tap
          key={id}
          onPress={() => router.push(`/search/${id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${story}. ${a.street_address}, ${a.postal_city}. ${legal}`}
          style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderLeftWidth: 4, borderLeftColor: tone === "danger" ? color.danger : color.accentBrand }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="micro" bold style={{ color: tone === "danger" ? color.danger : color.accent, textTransform: "uppercase", letterSpacing: 0.6 }}>{story}</T>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              {differs ? <T variant="small" muted style={{ textDecorationLine: "line-through" }}>{a.postal_city}</T> : null}
              {differs ? <T variant="small" muted>→</T> : null}
              <T variant="small" bold>{legal}</T>
            </View>
          </View>
          <ChevronIcon color={color.ink2} />
        </Tap>
      ))}
    </View>
  );
}
