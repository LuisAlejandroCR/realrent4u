// feel.ts: haptics and motion helpers: one place that decides when the phone buzzes and how things move.
// Haptics are no-ops on web; animations respect the system Reduce Motion setting or the in-app override.
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

const device = Platform.OS === "ios" || Platform.OS === "android";
const safe = (p: Promise<unknown>) => void p.catch(() => {});

/** User settings from the profile sheet (session only). Module-level so non-React helpers can read them. */
const settings = { haptics: true, reduceMotion: false };
const listeners = new Set<() => void>();
export function setFeel(next: Partial<typeof settings>) {
  Object.assign(settings, next);
  listeners.forEach((l) => l());
}
export const feelSettings = () => ({ ...settings });

const buzz = (p: () => Promise<unknown>) => { if (device && settings.haptics) safe(p()); };

/** Semantic haptics: name the moment, not the motor pattern. */
export const haptic = {
  /** Picking one option among several (tab, language, date, filter). */
  select: () => buzz(() => Haptics.selectionAsync()),
  /** Opening something (card, row, link). */
  tap: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A stamp landing on paper. */
  thunk: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Something earned. */
  success: () => buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A conflict that needs human review. */
  warn: () => buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

/** The native driver is unavailable on web; animate in JS there. */
export const nativeDriver = Platform.OS !== "web";

/** True when the system asks for reduced motion or the user turned motion off in the profile sheet. */
export function useReduceMotion(): boolean {
  const [system, setSystem] = useState(false);
  const [forced, setForced] = useState(settings.reduceMotion);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystem).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystem);
    const l = () => setForced(settings.reduceMotion);
    listeners.add(l);
    return () => { sub.remove(); listeners.delete(l); };
  }, []);
  return system || forced;
}
