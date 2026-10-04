// PreviewChrome.tsx: web-only preview frame (status bar, keyboard mock) used for screenshots; no-op on devices.
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { isAndroid, preview } from "../platform";
import { color } from "../theme";

/**
 * Screenshot-only chrome for the web preview build (?frame). Draws a status bar and, with ?kbd,
 * a keyboard mock. Never rendered on iOS/Android devices, where the real system UI exists.
 */
export function PreviewChrome({ children }: { children: ReactNode }) {
  if (!preview.frame) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: color.surface }}>
      <View style={{ height: isAndroid ? 32 : 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: isAndroid ? 18 : 30, paddingTop: isAndroid ? 0 : 8, backgroundColor: color.surface }}>
        <Text style={{ fontWeight: "700", fontSize: 14, color: color.ink }}>{isAndroid ? "12:30" : "9:41"}</Text>
        {isAndroid
          ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.ink }} />
          : <View style={{ width: 110, height: 30, borderRadius: 16, backgroundColor: color.ink }} />}
        <Text style={{ fontWeight: "700", fontSize: 12, color: color.ink }}>{isAndroid ? "▾▴ ▮" : "●●● ▮"}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      {preview.keyboard && <KeyboardMock />}
      {isAndroid
        ? <View style={{ height: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.surface }}><View style={{ width: 100, height: 4, borderRadius: 2, backgroundColor: color.ink }} /></View>
        : <View style={{ height: 22, alignItems: "center", justifyContent: "center", backgroundColor: preview.keyboard ? "#D6D9DE" : color.surface }}><View style={{ width: 134, height: 5, borderRadius: 3, backgroundColor: color.ink }} /></View>}
    </View>
  );
}

function KeyboardMock() {
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  return (
    <View style={{ backgroundColor: "#D6D9DE", paddingVertical: 8, paddingHorizontal: 3, gap: 10 }}>
      {rows.map((r) => (
        <View key={r} style={{ flexDirection: "row", justifyContent: "center", gap: 5 }}>
          {r.split("").map((c) => (
            <View key={c} style={{ width: 33, height: 42, borderRadius: isAndroid ? 10 : 5, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, color: color.ink }}>{c}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        <View style={{ width: 210, height: 42, borderRadius: isAndroid ? 10 : 5, backgroundColor: "#FFFFFF" }} />
        <View style={{ width: 90, height: 42, borderRadius: isAndroid ? 21 : 5, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{isAndroid ? "⌕" : "search"}</Text>
        </View>
      </View>
    </View>
  );
}
