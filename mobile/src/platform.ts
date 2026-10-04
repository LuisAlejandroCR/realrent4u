// platform.ts: platform flags and web preview switches.
import { Platform } from "react-native";

/**
 * The platform the UI should look like. On devices this is simply Platform.OS.
 * The web build exists ONLY to render design screenshots: there `?pf=android` previews the
 * Android variant, anything else previews iOS. It is not a supported product target.
 */
function previewParam(name: string): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export const OS: "ios" | "android" = Platform.OS === "android" ? "android" : Platform.OS === "ios" ? "ios" : previewParam("pf") === "android" ? "android" : "ios";
export const isAndroid = OS === "android";
/** Web screenshot mode only: draws a status bar / keyboard mock so frames read like a phone. */
export const preview = { frame: Platform.OS === "web" && previewParam("frame") !== null, keyboard: previewParam("kbd") !== null, param: previewParam };
