// StackHeader.tsx: per-tab native stack with back button, centered title and language toggle.
import { Stack, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { usePrefs } from "../prefs";
import { color, minTouch } from "../theme";
import { LangToggle } from "./Chrome";

/**
 * Native stack per tab. iOS: compact header, "‹ Back" + edge swipe. Android: Material top bar with ←;
 * system back closes the keyboard first, then pops. Root screens of each tab hide the header and draw their own band.
 */
export function TabStack({ backTitle, root }: { backTitle: string; root: string }) {
  const { reduceMotion } = usePrefs();
  const router = useRouter();
  return (
    <Stack
      screenOptions={({ navigation, route }) => ({
        // Always show a clear way back, even when a detail screen is opened directly (deep link).
        headerLeft: route.name !== "index" && (!navigation.canGoBack() || route.name === "[testId]")
          ? () => (
              <Pressable onPress={() => router.replace(root as never)} accessibilityRole="button" accessibilityLabel={backTitle} hitSlop={8} style={{ minHeight: minTouch, minWidth: minTouch, paddingLeft: 8, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: color.primary, fontSize: 28, lineHeight: 30, fontWeight: "500" }}>‹</Text>
                <Text style={{ color: color.primary, fontSize: 16, fontWeight: "600" }}>{backTitle}</Text>
              </Pressable>
            )
          : undefined,
        animation: reduceMotion ? "none" : "default",
        headerStyle: { backgroundColor: color.surface },
        headerTintColor: color.primary,
        headerTitleStyle: { color: color.ink, fontWeight: "700" },
        headerShadowVisible: false,
        headerBackTitle: backTitle,
        headerBackButtonDisplayMode: "generic",
        headerTitleAlign: "center",
        headerRight: () => <LangToggle />,
        contentStyle: { backgroundColor: color.paper },
      })}
    />
  );
}
