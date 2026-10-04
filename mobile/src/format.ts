// format.ts: display-only formatting (EN/ES): readable dates and plain-language engine reason codes.
import type { Lang } from "./types";

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};

/** Display-only: "2026-10-01T22:44Z" -> "Oct 1, 2026" / "1 oct 2026". Data keeps the raw value; unparsable input is shown as-is. */
export function readableDate(raw: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  const [y, mo, d] = [m[1], Number(m[2]), Number(m[3])];
  const name = MONTHS[lang][mo - 1];
  if (!name) return raw;
  return lang === "es" ? `${d} ${name} ${y}` : `${name} ${d}, ${y}`;
}

/**
 * Engine reason codes ("missing_units,superseded_by:r-D041-01") → plain sentences, joined with " · ".
 * Unknown codes are shown as-is rather than hidden.
 */
export function reasonText(reason: string | undefined, reasons: Record<string, string>, displacedBy: (r: string) => string, titleOf: (id: string) => string | undefined): string | null {
  if (!reason) return null;
  return reason
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c.startsWith("superseded_by:") ? displacedBy(titleOf(c.slice(14)) ?? c.slice(14)) : reasons[c] ?? c.replace(/_/g, " ")))
    .join(" · ");
}
