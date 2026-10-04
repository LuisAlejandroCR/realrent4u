// index.tsx: 02 address search over the 500 samples (pushed from Home); postal city vs legal jurisdiction per row.
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalDateBar } from "../../../../src/components/Chrome";
import { QuickWins } from "../../../../src/components/Story";
import { SearchIcon } from "../../../../src/components/Icons";
import { LoadingState } from "../../../../src/components/States";
import { Chevron, Id, StateBlock, T } from "../../../../src/components/ui";
import { searchAddresses } from "../../../../src/data";
import { haptic } from "../../../../src/feel";
import { preview } from "../../../../src/platform";
import { usePrefs } from "../../../../src/prefs";
import { color, minTouch, radius, shadow, space, type } from "../../../../src/theme";
import type { Address } from "../../../../src/types";

const LIMIT = 50;

/** 02 Search — the main task. Strong header band, big field, designed empty / no-match / loading states. */
export default function SearchScreen() {
  const { tr, ms, data, query: q, setQuery: setQ } = usePrefs();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(preview.keyboard);
  // Arriving from Home's CTA: focus the field so the keyboard is ready.
  useEffect(() => { if (focus) { const id = setTimeout(() => input.current?.focus(), 250); return () => clearTimeout(id); } }, [focus]);
  useEffect(() => { const p = preview.param("q"); if (p) setQ(p); }, [setQ]);
  // Count every match, render the first LIMIT: the count must never claim fewer matches than exist.
  const all = useMemo(() => searchAddresses(data.addresses, q, Infinity, (id) => data.jurisdictions[id]?.jurisdiction), [data.addresses, data.jurisdictions, q]);
  const matches = all.slice(0, LIMIT);
  const typed = q.trim().length > 0;
  const loading = preview.param("state") === "loading";
  const countText = typed ? (all.length ? tr.matches(all.length) + (all.length > LIMIT ? ` · ${ms.matchesFirst(LIMIT)}` : "") : tr.noMatches) : "";

  useEffect(() => {
    if (!typed) return;
    const id = setTimeout(() => AccessibilityInfo.announceForAccessibility(countText), 600);
    return () => clearTimeout(id);
  }, [countText, typed]);

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: color.surface }}>
      {/* Native header with Back to Home; the band below holds only the field. */}
      <Stack.Screen options={{ headerShown: true, title: ms.searchTitle }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header band */}
        <View style={{ backgroundColor: color.tint, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm }}>
          
          <View style={[{ flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 2, borderColor: focused ? color.primary : color.ink, borderRadius: radius.lg, paddingLeft: space.md }, shadow]}>
            <SearchIcon color={color.primary} />
            <TextInput
              ref={input}
              value={q}
              onChangeText={setQ}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus={preview.keyboard || !!focus}
              placeholder={tr.searchPlaceholder}
              placeholderTextColor={color.ink2}
              accessibilityLabel={tr.searchLabel}
              accessibilityHint={tr.searchHelp}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, minHeight: minTouch + 10, color: color.ink, ...type.body, fontWeight: "600", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null) }}
            />
            {typed && (
              <Pressable onPress={() => { haptic.select(); setQ(""); input.current?.focus(); }} accessibilityRole="button" accessibilityLabel={ms.clear} style={{ minWidth: minTouch, minHeight: minTouch, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: color.ink2, fontSize: 18, fontWeight: "700" }}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
        <LegalDateBar />

        {loading ? (
          <LoadingState label={ms.loadingTitle} />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={typed ? matches : []}
            keyExtractor={(a) => a.address_id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: focused ? space.sm : space.lg, gap: space.sm }}
            ListHeaderComponent={
              <View accessibilityLiveRegion="polite">
                {typed && matches.length > 0 && <T variant="small" bold muted>{countText}</T>}
              </View>
            }
            ListEmptyComponent={
              !typed ? (
                // What you can type, plus three one-tap stories instead of a paragraph.
                <View style={{ gap: space.md }}>
                  <T variant="small" muted>{ms.searchSub}</T>
                  <QuickWins />
                </View>
              ) : (
                // Compact so it sits right under the field when the keyboard is open.
                <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start", padding: space.md, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line }} accessibilityRole="summary">
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.accentTint, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: color.accent, fontWeight: "800", fontSize: 18 }}>0</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T bold>{tr.noMatches}</T>
                    <T variant="small" muted>{ms.noMatchShort}</T>
                  </View>
                </View>
              )
            }
            renderItem={({ item }) => <AddressRow a={item} onPress={() => { haptic.tap(); router.push(`/search/${item.address_id}`); }} />}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AddressRow({ a, onPress }: { a: Address; onPress: () => void }) {
  const { tr, data } = usePrefs();
  const j = data.jurisdictions[a.address_id];
  const differs = j?.place && j.place !== a.postal_city;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${a.address_id}, ${a.street_address}, ${a.postal_city} ${a.state}. ${tr.legalJurisdiction}: ${j?.jurisdiction ?? tr.unresolved}`}
      android_ripple={{ color: color.tint }}
      style={({ pressed }) => [{ minHeight: minTouch + 24, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, backgroundColor: pressed && Platform.OS === "ios" ? color.tint : color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Id>{a.address_id}</Id>
          <T variant="small" muted>{a.postal_city}, {a.state} {a.zip}</T>
        </View>
        <T bold>{a.street_address}</T>
        <T variant="small" style={{ color: differs ? color.accent : color.ink2, fontWeight: differs ? "700" : "400" }}>
          {differs ? "≠ " : ""}{tr.legalJurisdiction}: {j?.jurisdiction ?? tr.unresolved}
        </T>
      </View>
      <Chevron />
    </Pressable>
  );
}
