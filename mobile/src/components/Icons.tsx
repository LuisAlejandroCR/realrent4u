// Icons.tsx: SVG icons for tabs, brand mark, chevrons, calendar, external link and profile.
import { Platform } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Custom 24×24 stroke icons (react-native-svg). Decorative: labels always accompany them. */
type P = { color: string; size?: number; filled?: boolean };
// Native-only a11y props: on web react-native-svg forwards them to the DOM and React warns.
const hidden = Platform.OS === "web" ? {} : { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", ...hidden });

export function SearchIcon({ color, size = 24, filled }: P) {
  return (
    <Svg {...base(size)}>
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={filled ? 2.6 : 2} fill={filled ? color : "none"} fillOpacity={filled ? 0.15 : 0} />
      <Path d="M15.5 15.5L20.5 20.5" stroke={color} strokeWidth={filled ? 2.6 : 2} strokeLinecap="round" />
    </Svg>
  );
}

/** House — "Home". */
export function HomeIcon({ color, size = 24, filled }: P) {
  const w = filled ? 2.4 : 1.9;
  return (
    <Svg {...base(size)}>
      <Path d="M4 10.5L12 4L20 10.5V19.5C20 20 19.6 20.5 19 20.5H5C4.4 20.5 4 20 4 19.5V10.5Z" stroke={color} strokeWidth={w} strokeLinejoin="round" fill={filled ? color : "none"} fillOpacity={filled ? 0.15 : 0} />
      <Path d="M10 20.5V14.5H14V20.5" stroke={color} strokeWidth={w} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Calendar with a change arrow — "Change tests" (rules over time). */
export function ChangesIcon({ color, size = 24, filled }: P) {
  const w = filled ? 2.4 : 1.9;
  return (
    <Svg {...base(size)}>
      <Rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke={color} strokeWidth={w} fill={filled ? color : "none"} fillOpacity={filled ? 0.15 : 0} />
      <Path d="M3.5 9.5H20.5M8 3V6.5M16 3V6.5" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M8 15H15M13 12.8L15.2 15L13 17.2" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Document with checklist — "Method & audit". */
export function MethodIcon({ color, size = 24, filled }: P) {
  const w = filled ? 2.4 : 1.9;
  return (
    <Svg {...base(size)}>
      <Path d="M6 3.5H14L18.5 8V20.5H6Z" stroke={color} strokeWidth={w} strokeLinejoin="round" fill={filled ? color : "none"} fillOpacity={filled ? 0.15 : 0} />
      <Path d="M14 3.5V8H18.5" stroke={color} strokeWidth={w} strokeLinejoin="round" fill="none" />
      <Path d="M9 12.5L10.3 13.8L12.8 11.3M9 17H15.5" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Brand mark: house outline with a section sign doorway. */
export function HouseMark({ size = 36, color = "#141C2E", accent = "#B86A0E" }: { size?: number; color?: string; accent?: string }) {
  return (
    <Svg {...base(size)}>
      <Path d="M3 11L12 3.5L21 11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M5.5 9.5V20.5H18.5V9.5" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
      <Rect x="10" y="13.5" width="4" height="7" rx="1" fill={accent} />
    </Svg>
  );
}

export function ChevronIcon({ color, size = 18, back }: P & { back?: boolean }) {
  return (
    <Svg {...base(size)}>
      <Path d={back ? "M15 5L8 12L15 19" : "M9 5L16 12L9 19"} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function CalendarIcon({ color, size = 16 }: P) {
  return (
    <Svg {...base(size)}>
      <Rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M3.5 9.5H20.5M8 3V6.5M16 3V6.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ExternalIcon({ color, size = 16 }: P) {
  return (
    <Svg {...base(size)}>
      <Path d="M14 4H20V10M20 4L11 13M18 14V19.5H4.5V6H10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Person — profile button. */
export function UserIcon({ color, size = 22 }: P) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="8.5" r="3.8" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M4.8 20C5.8 16.4 8.6 14.5 12 14.5S18.2 16.4 19.2 20" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
