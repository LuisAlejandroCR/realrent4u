// _layout.tsx: root stack: prefs provider, safe area, the tab group, the date and profile form sheets
// and the stamp toast that floats above every screen.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PreviewChrome } from "../src/components/PreviewChrome";
import { StampToast } from "../src/components/Story";
import { PrefsProvider, usePrefs } from "../src/prefs";
import { color } from "../src/theme";

function RootStack() {
  const { ms, reduceMotion } = usePrefs();
  return (
    <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? "none" : "default", contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="(tabs)" />
      {/*
        Date sheet sized to its content (no big empty dimmed area).
        iOS: native form sheet with grabber. Android: react-native-screens bottom sheet (Material pattern);
        system back dismisses it and keeps the current date.
      */}
      <Stack.Screen
        name="date"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          headerShown: false,
          title: ms.dateTitle,
          contentStyle: { backgroundColor: color.surface },
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          headerShown: false,
          title: ms.profile,
          contentStyle: { backgroundColor: color.surface },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <StatusBar style="dark" />
        <PreviewChrome>
          <RootStack />
          <StampToast />
        </PreviewChrome>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
