// theme.ts: Stamp & Marigold tokens, spacing, type scale and result badge colours.
import { Platform } from "react-native";
import { isAndroid } from "./platform";

/**
 * "Stamp & Marigold" — RealRent4U mobile visual system (option B, chosen by the team).
 * Light paper, stamp blue for actions/links/active tab, marigold for editorial emphasis and notes,
 * a soft highlight used sparingly behind ink words. Ink is for text and small selected controls only.
 * Contrast (WCAG): ink on paper 16.4:1 · ink2 on paper 6.6:1 · white on primary 7.9:1 ·
 * accent text #8F520A on white 5.9:1 (brand marigold #B86A0E is 3.9:1, so it is used only for
 * large glyphs, bars and borders, never small text).
 */
export const color = {
  paper: "#F5F4EF", // page background
  surface: "#FFFFFF", // cards, sheets, tab bar
  tint: "#E9EEF8", // soft bands, selected tab pill
  sand: "#FFF6E3", // "note": evidence excerpt, attention states
  ink: "#141C2E", // primary text
  ink2: "#4F5869", // secondary text
  line: "#D8DAE0", // hairlines and card borders
  lineStrong: "#9AA0AD", // input borders (3:1 non-text)
  primary: "#2949A8", // stamp blue — actions, links, active tab
  primaryPressed: "#1F3884",
  primaryTint: "#DDE5F6",
  accent: "#8F520A", // marigold, text-safe shade
  accentBrand: "#B86A0E", // marigold brand — bars, glyphs, borders only
  accentTint: "#FFF0D6",
  marker: "#FFE29A", // highlight behind ink words, sparingly
  onPrimary: "#FFFFFF",
  danger: "#A3282B",
  dangerTint: "#FBE3E3",
  amber: "#7A4A00",
  amberTint: "#FFF0CC",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 };

/** 44 pt on iOS, 48 dp on Android. */
export const minTouch = isAndroid ? 48 : 44;

export const font = {
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Source Serif 4', serif" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, monospace" }),
};

/** Type scale (pt/sp). Text scales with system settings; only chrome caps the multiplier. */
export const type = {
  hero: { fontSize: 34, lineHeight: 39 },
  display: { fontSize: 28, lineHeight: 33 },
  title: { fontSize: 21, lineHeight: 27 },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  micro: { fontSize: 12, lineHeight: 16 },
};

export const shadow = Platform.select({
  ios: { shadowColor: "#141C2E", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: { boxShadow: "0 4px 14px rgba(20,28,46,0.08)" } as object,
});

export type BadgeKind = "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending" | "unevaluated" | "review";

/** Result states: own colour pair + glyph + text label. Colour is never the only signal. */
export const badge: Record<BadgeKind, { fg: string; bg: string; glyph: string }> = {
  applies: { fg: "#1D6B3A", bg: "#E3F1E7", glyph: "●" },
  unknown: { fg: "#7A4A00", bg: "#FFF0CC", glyph: "?" },
  superseded: { fg: "#5B4B8A", bg: "#ECE8F5", glyph: "⤳" },
  not_yet_effective: { fg: "#0E5F6E", bg: "#E0F0F2", glyph: "◷" },
  pending: { fg: "#8A3B2B", bg: "#F8E6E0", glyph: "◌" },
  unevaluated: { fg: "#4F5869", bg: "#FFFFFF", glyph: "○" },
  review: { fg: "#A3282B", bg: "#FBE3E3", glyph: "!" },
};
