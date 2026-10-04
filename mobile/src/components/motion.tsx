// motion.tsx: animated primitives: spring-press wrapper, staggered fade-in, count-up number and the rubber stamp.
// All of them collapse to static rendering under Reduce Motion.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, Text, type AccessibilityRole, type StyleProp, type ViewStyle } from "react-native";
import { haptic, nativeDriver, useReduceMotion } from "../feel";
import { badge, type BadgeKind } from "../theme";

/** Pressable that dips to 97 % on press and springs back, with an optional haptic on press. */
export function Tap({ children, onPress, style, feel = "tap", accessibilityRole = "button", accessibilityLabel, accessibilityHint, accessibilityState, disabled }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; feel?: keyof typeof haptic | "none";
  accessibilityRole?: AccessibilityRole; accessibilityLabel?: string; accessibilityHint?: string;
  accessibilityState?: { selected?: boolean; expanded?: boolean; disabled?: boolean; checked?: boolean }; disabled?: boolean;
}) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => !reduce && Animated.spring(scale, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: v === 1 ? 8 : 0 }).start();
  return (
    <Pressable
      onPress={() => { if (feel !== "none") haptic[feel](); onPress?.(); }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Rises 8 px and fades in; `index` staggers siblings (capped so long lists don't wait). */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 320, delay: Math.min(index, 8) * 45, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [reduce, index, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** A number that counts up to `value` (ease-out, ~0.9 s). Screen readers get the final value immediately. */
export function CountUp({ value, style }: { value: number; style?: object }) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce || value === 0) { setShown(value); return; }
    const start = Date.now();
    const dur = 900;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Frames pause in background/hidden views; the true value must still land, never a stale 0.
    const settle = setTimeout(() => setShown(value), dur + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [value, reduce]);
  return <Text style={style} accessibilityLabel={String(value)}>{shown}</Text>;
}

/**
 * Rubber stamp for a result: rotated, bordered, uppercase. Lands from 1.8x with a haptic thunk.
 * Colour + glyph + text, so colour is never the only signal.
 */
export function Stamp({ kind, label }: { kind: BadgeKind; label: string }) {
  const reduce = useReduceMotion();
  const b = badge[kind];
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { haptic.thunk(); return; }
    const id = setTimeout(haptic.thunk, 230);
    Animated.timing(v, { toValue: 1, duration: 260, delay: 60, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }).start();
    return () => clearTimeout(id);
  }, [kind, reduce, v]);
  return (
    <Animated.View
      accessible
      accessibilityLabel={label}
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 3,
        borderColor: b.fg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: b.bg,
        opacity: v,
        transform: [{ rotate: "-4deg" }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }],
      }}
    >
      <Text style={{ color: b.fg, fontWeight: "900", fontSize: 20 }}>{b.glyph}</Text>
      <Text style={{ color: b.fg, fontWeight: "900", fontSize: 20, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</Text>
    </Animated.View>
  );
}
