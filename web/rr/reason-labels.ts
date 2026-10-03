// reason-labels.ts: converts engine reason tokens into concise labels for the lookup UI.
import type { Lang } from "./types";

const LABELS: Record<string, Record<Lang, string>> = {
  missing_year_built: { en: "year built is missing", es: "falta el ano de construccion" },
  missing_units: { en: "unit count is missing", es: "falta el numero de unidades" },
  cutoff_year_ambiguous: {
    en: "the recorded year matches the cutoff year, but the exact date is unknown",
    es: "el ano registrado coincide con el ano limite, pero se desconoce la fecha exacta",
  },
  cutoff_unparsed: { en: "the coverage cutoff could not be evaluated", es: "no se pudo evaluar la fecha limite de cobertura" },
  small_owner_exemption_unresolved: {
    en: "owner information needed for the small-owner exemption is unavailable",
    es: "no esta disponible la informacion del propietario necesaria para la exencion de pequenos propietarios",
  },
  unresolved_address: {
    en: "the legal jurisdiction could not be resolved",
    es: "no se pudo determinar la jurisdiccion legal",
  },
  effective_date_contradiction: {
    en: "the sources contain conflicting effective dates",
    es: "las fuentes contienen fechas de vigencia contradictorias",
  },
  source_discrepancy: {
    en: "the sources contain conflicting information",
    es: "las fuentes contienen informacion contradictoria",
  },
  bars_local_rent_control: {
    en: "state law bars local rent control for this property",
    es: "la ley estatal impide el control local de alquiler para esta propiedad",
  },
};

function labelOne(reason: string, lang: Lang): string {
  const token = reason.trim();
  const prefixed = token.match(/^(possibly_)?superseded_by:(.+)$/);
  if (prefixed) {
    const ruleId = prefixed[2]?.trim();
    if (!ruleId) return token.replaceAll("_", " ");
    return prefixed[1]
      ? (lang === "es" ? `puede ser desplazada por ${ruleId}` : `may be superseded by ${ruleId}`)
      : (lang === "es" ? `desplazada por ${ruleId}` : `superseded by ${ruleId}`);
  }
  return LABELS[token]?.[lang] ?? token.replaceAll("_", " ");
}

export function reasonLabel(reason: string, lang: Lang): string {
  return reason
    .split(",")
    .map((part) => labelOne(part, lang))
    .filter(Boolean)
    .join("; ");
}
