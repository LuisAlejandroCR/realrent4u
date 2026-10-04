// profile.tsx: "You" sheet: case-file stamps and settings (language, haptics, reduce motion). Session only,
// no account and no personal data. Opened from the avatar on every tab header and the Home case-file strip.
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LangToggle } from "../src/components/Chrome";
import { CaseFileList } from "../src/components/Story";
import { Button, T } from "../src/components/ui";
import { readableDate } from "../src/format";
import { STAMPS, usePrefs } from "../src/prefs";
import { color, minTouch, radius, space } from "../src/theme";

export default function ProfileSheet() {
  const { tr, ms, lang, stamps, haptics, setHaptics, motionOff, setMotionOff, resetStamps, data } = usePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const k = stamps.length;
  return (
    <View style={{ backgroundColor: color.surface, paddingTop: space.lg, paddingBottom: Math.max(insets.bottom, space.lg), paddingHorizontal: space.xl, gap: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T variant="title" serif accessibilityRole="header" style={{ flex: 1 }}>{ms.profile}</T>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={ms.done} style={{ minHeight: minTouch, minWidth: minTouch, justifyContent: "center", alignItems: "flex-end" }}>
          <Text style={{ color: color.primary, fontWeight: "800" }}>{ms.done}</Text>
        </Pressable>
      </View>

      {/* Case file */}
      <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: color.paper }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <T bold accessibilityRole="header">{ms.stampTitle}</T>
          <T variant="small" bold style={{ color: k === STAMPS.length ? color.accent : color.primary }}>{ms.stampProgress(k, STAMPS.length)}</T>
        </View>
        <T variant="micro" muted>{k === STAMPS.length ? ms.stampDone : ms.stampHint}</T>
        <CaseFileList />
        {k > 0 && <Button variant="quiet" compact label={ms.resetStamps} onPress={resetStamps} />}
      </View>

      {/* Settings */}
      <View style={{ gap: space.xs }}>
        <T bold accessibilityRole="header">{ms.settings}</T>
        <Setting label={ms.langLabel} body={ms.langBody}>
          <LangToggle key={lang} />
        </Setting>
        <Setting label={ms.hapticsLabel} body={ms.hapticsBody}>
          <Switch value={haptics} onValueChange={setHaptics} accessibilityLabel={ms.hapticsLabel} trackColor={{ true: color.primary, false: color.line }} thumbColor={Platform.OS === "android" ? color.surface : undefined} />
        </Setting>
        <Setting label={ms.motionLabel} body={ms.motionBody}>
          <Switch value={motionOff} onValueChange={setMotionOff} accessibilityLabel={ms.motionLabel} trackColor={{ true: color.primary, false: color.line }} thumbColor={Platform.OS === "android" ? color.surface : undefined} />
        </Setting>
      </View>

      <View style={{ gap: 2 }}>
        <T variant="micro" muted>{ms.sessionOnly}</T>
        <T variant="micro" muted>{ms.dataAsOf(readableDate(data.manifest.generated_at, lang))} · § {tr.notAdvice}</T>
      </View>
    </View>
  );
}

function Setting({ label, body, children }: { label: string; body: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T>{label}</T>
        <T variant="micro" muted>{body}</T>
      </View>
      {children}
    </View>
  );
}
