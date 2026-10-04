// reason-labels.ts: converts engine reason tokens into concise labels for the lookup UI.
import type { Lang } from "./types";

const LABELS: Record<string, Record<Lang, string>> = {
  missing_year_built: { en: "year built is missing", es: "falta el año de construcción" },
  missing_units: { en: "unit count is missing", es: "falta el número de unidades" },
  cutoff_year_ambiguous: {
    en: "the recorded year matches the cutoff year, but the exact date is unknown",
    es: "el año registrado coincide con el año límite, pero se desconoce la fecha exacta",
  },
  cutoff_unparsed: { en: "the coverage cutoff could not be evaluated", es: "no se pudo evaluar la fecha límite de cobertura" },
  small_owner_exemption_unresolved: {
    en: "owner information needed for the small-owner exemption is unavailable",
    es: "no está disponible la información del propietario necesaria para la exención de pequeños propietarios",
  },
  unresolved_address: {
    en: "the legal jurisdiction could not be resolved",
    es: "no se pudo determinar la jurisdicción legal",
  },
  effective_date_contradiction: {
    en: "the sources contain conflicting effective dates",
    es: "las fuentes contienen fechas de vigencia contradictorias",
  },
  source_discrepancy: {
    en: "the sources contain conflicting information",
    es: "las fuentes contienen información contradictoria",
  },
  // Time reasons from realrent/engine.py _time_result.
  unrecognized_status: {
    en: "the rule's status could not be classified",
    es: "no se pudo clasificar el estado de la regla",
  },
  not_yet_effective_no_date: {
    en: "enacted but not yet in effect; the source gives no effective date",
    es: "promulgada pero aún no vigente; la fuente no indica fecha de vigencia",
  },
  effective_date_ambiguous: {
    en: "the source gives only a month or year for the effective date, and the as-of date falls inside it",
    es: "la fuente da solo un mes o un año como fecha de vigencia, y la fecha de consulta cae dentro de ese periodo",
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
