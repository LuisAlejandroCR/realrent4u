// _layout.tsx: bottom tabs (Home, Search, Changes, Method) with icon + pill + bold label for the active tab.
import { Tabs } from "expo-router";
import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { ChangesIcon, HomeIcon, MethodIcon, SearchIcon } from "../../src/components/Icons";
import { haptic } from "../../src/feel";
import { isAndroid, preview } from "../../src/platform";
import { usePrefs } from "../../src/prefs";
import { color, minTouch, radius } from "../../src/theme";

type IconC = ComponentType<{ color: string; filled?: boolean }>;

/**
 * Active tab = filled icon + bold label + blue pill behind the icon (three cues, not colour alone).
 * Inactive = outline icon + regular label in ink-2. Screen readers announce "selected" via the tab bar.
 */
function tabIcon(Icon: IconC) {
  return ({ focused }: { focused: boolean }) => (
    <View style={{ width: 60, height: 30, borderRadius: radius.pill, backgroundColor: focused ? color.primaryTint : "transparent", alignItems: "center", justifyContent: "center" }}>
      <Icon color={focused ? color.primary : color.ink2} filled={focused} />
    </View>
  );
}
function tabLabel(text: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={{ fontSize: 12, marginTop: 2, fontWeight: focused ? "800" : "500", color: focused ? color.primary : color.ink2 }}>{text}</Text>
  );
}

export default function TabsLayout() {
  const { ms, reduceMotion } = usePrefs();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.select() }}
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? "none" : "fade",
        tabBarHideOnKeyboard: true,
        tabBarStyle: preview.keyboard ? { display: "none" } : { backgroundColor: color.surface, borderTopColor: color.line, minHeight: isAndroid ? 72 : 64, paddingTop: 6 },
        tabBarItemStyle: { minHeight: minTouch },
      }}
    >
      <Tabs.Screen name="index" options={{ title: ms.tabHome, tabBarIcon: tabIcon(HomeIcon), tabBarLabel: tabLabel(ms.tabHome) }} />
      <Tabs.Screen name="search" options={{ title: ms.tabSearch, tabBarIcon: tabIcon(SearchIcon), tabBarLabel: tabLabel(ms.tabSearch) }} />
      <Tabs.Screen name="changes" options={{ title: ms.tabChanges, tabBarIcon: tabIcon(ChangesIcon), tabBarLabel: tabLabel(ms.tabChanges) }} />
      <Tabs.Screen name="method" options={{ title: ms.tabMethod, tabBarIcon: tabIcon(MethodIcon), tabBarLabel: tabLabel(ms.tabMethod) }} />
    </Tabs>
  );
}
