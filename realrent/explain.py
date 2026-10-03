# explain.py: plain-language EN/ES explanation of one lookup result (rule x address x as_of).
# Deterministic templates by default; an opt-in Claude rewrite (REALRENT_LLM_EXPLAIN=1 + key) only
# polishes wording and is discarded unless it keeps the citation, the as-of date and the disclaimer.

import os

from realrent import paths

MODEL = "claude-opus-5-5"
LANGS = ("en", "es")
DISCLAIMER = {"en": "Not legal advice.", "es": "No es asesoría legal."}

# Machine reasons (LookupItem.reason) -> human text. Keys without a prefix match exactly;
# "superseded_by:<id>" is handled separately.
REASONS = {
    "missing_year_built": {
        "en": "the year the building was built is not in our data",
        "es": "no tenemos el año de construcción del edificio",
    },
    "missing_units": {
        "en": "the number of units in the building is not in our data",
        "es": "no tenemos el número de unidades del edificio",
    },
    "cutoff_year_ambiguous": {
        "en": "the building was built in the cutoff year, and the rule depends on the exact "
        "date (such as the certificate of occupancy), which we do not have",
        "es": "el edificio se construyó en el año de corte y la regla depende de la fecha exacta "
        "(por ejemplo, el certificado de ocupación), que no tenemos",
    },
    "unresolved_address": {
        "en": "we could not confirm which city's laws govern this address",
        "es": "no pudimos confirmar qué ciudad tiene jurisdicción sobre esta dirección",
    },
    "small_owner_exemption_unresolved": {
        "en": "the rule exempts some small or owner-occupied properties, and we do not have "
        "ownership data to check that",
        "es": "la regla exime a algunas propiedades pequeñas u ocupadas por su dueño, y no tenemos "
        "datos de propiedad para verificarlo",
    },
}
GENERIC_REASON = {
    "en": "a fact needed to decide coverage is missing",
    "es": "falta un dato necesario para decidir si aplica",
}
SUPERSEDED_REASON = {
    "en": "a local rule ({id}) governs instead of it",
    "es": "una regla local ({id}) rige en su lugar",
}
SUPERSEDED_GENERIC = {
    "en": "a local rule governs instead of it",
    "es": "una regla local rige en su lugar",
}

RESULT_TEXT = {
    "applies": {
        "en": "{title} applies to this address.",
        "es": "{title} aplica a esta dirección.",
    },
    "unknown": {
        "en": "We cannot tell whether {title} applies to this address because {reason}.",
        "es": "No podemos saber si {title} aplica a esta dirección porque {reason}.",
    },
    "superseded": {
        "en": "{title} does not govern this address because {reason}.",
        "es": "{title} no rige para esta dirección porque {reason}.",
    },
    "not_yet_effective": {
        "en": "{title} would cover this address but is not yet in effect; it takes effect {when}.",
        "es": "{title} cubriría esta dirección pero aún no está vigente; entra en vigor {when}.",
    },
    "pending": {
        "en": "{title} is a pending bill, not law; if enacted as written it would reach this address.",
        "es": "{title} es un proyecto de ley pendiente, no una ley; si se aprueba tal como está, "
        "alcanzaría esta dirección.",
    },
}
UNKNOWN_RESULT = {
    "en": "We could not determine the status of {title} for this address.",
    "es": "No pudimos determinar la situación de {title} para esta dirección.",
}
WHEN = {"en": "on {date}", "es": "el {date}"}
WHEN_UNKNOWN = {"en": "on a date not stated in the source", "es": "en una fecha que la fuente no indica"}
SOURCE = {"en": "Source: {citation}; as of {as_of}.", "es": "Fuente: {citation}; a fecha de {as_of}."}
NO_CITATION = {"en": "citation not available", "es": "cita no disponible"}
DEFAULT_TITLE = {"en": "This rule", "es": "Esta regla"}


def _lang(lang) -> str:
    """Normalize lang ("es", "ES", "es-MX" -> "es"); anything unknown falls back to English."""
    code = str(lang or "en").strip().lower()[:2]
    return code if code in LANGS else "en"


def _text(value) -> str:
    return str(value).strip() if value not in (None, "") else ""


def _reason_text(reason, lang: str) -> str:
    reason = _text(reason)
    if reason.startswith("superseded_by:"):
        rid = reason.split(":", 1)[1].strip()
        return (SUPERSEDED_REASON[lang].format(id=rid) if rid else SUPERSEDED_GENERIC[lang])
    if reason in REASONS:
        return REASONS[reason][lang]
    return GENERIC_REASON[lang]


def citation_of(rule: dict, lang: str = "en") -> str:
    return _text((rule or {}).get("citation")) or NO_CITATION[_lang(lang)]


def template(rule: dict, item: dict, lang: str = "en", as_of: str | None = None) -> str:
    """Deterministic explanation: result sentence, source + as-of sentence, disclaimer."""
    rule, item, lang = rule or {}, item or {}, _lang(lang)
    as_of = _text(as_of) or _text(item.get("as_of")) or paths.DEFAULT_AS_OF
    title = _text(rule.get("title")) or _text(rule.get("team_rule_id")) or DEFAULT_TITLE[lang]
    result = _text(item.get("result"))
    reason = item.get("reason")

    if result == "superseded":
        if not _text(reason):
            overrider = _text(item.get("superseded_by"))
            reason = f"superseded_by:{overrider}" if overrider else "superseded_by:"
        first = RESULT_TEXT[result][lang].format(title=title, reason=_reason_text(reason, lang))
    elif result == "unknown":
        first = RESULT_TEXT[result][lang].format(title=title, reason=_reason_text(reason, lang))
    elif result == "not_yet_effective":
        date = _text(rule.get("effective_date"))
        when = WHEN[lang].format(date=date) if date else WHEN_UNKNOWN[lang]
        first = RESULT_TEXT[result][lang].format(title=title, when=when)
    elif result in RESULT_TEXT:
        first = RESULT_TEXT[result][lang].format(title=title)
    else:
        first = UNKNOWN_RESULT[lang].format(title=title)

    second = SOURCE[lang].format(citation=citation_of(rule, lang), as_of=as_of)
    return f"{first} {second} {DISCLAIMER[lang]}"


def _llm_enabled(use_llm) -> bool:
    if use_llm is None:
        use_llm = os.environ.get("REALRENT_LLM_EXPLAIN", "").strip().lower() in ("1", "true", "yes")
    return bool(use_llm) and bool(os.environ.get("ANTHROPIC_API_KEY"))


REWRITE_SYSTEM = (
    "You rewrite a short explanation of a housing-law lookup result so a tenant or landlord can read "
    "it easily. Keep the same language ({language}) and the same meaning. Do not add facts, rules, "
    "advice, or any suggestion of how to avoid or get around a rule. Keep the citation, the date "
    "{as_of} and the final sentence \"{disclaimer}\" exactly as written. At most two sentences "
    "before the disclaimer. Reply with the rewritten text only."
)


def _rewrite(client, text: str, lang: str, as_of: str) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=400,
        system=REWRITE_SYSTEM.format(
            language="English" if lang == "en" else "Spanish", as_of=as_of, disclaimer=DISCLAIMER[lang]
        ),
        messages=[{"role": "user", "content": text}],
    )
    return "".join(getattr(b, "text", "") for b in response.content).strip()


def _rewrite_ok(rewrite: str, citation: str, as_of: str, lang: str) -> bool:
    return bool(rewrite) and citation in rewrite and as_of in rewrite and rewrite.endswith(DISCLAIMER[lang])


def explain(rule: dict, item: dict, lang: str = "en", as_of: str | None = None, *,
            use_llm: bool | None = None, client=None) -> str:
    """One or two plain sentences + disclaimer. Template unless the LLM rewrite is enabled and valid."""
    lang = _lang(lang)
    as_of = _text(as_of) or _text((item or {}).get("as_of")) or paths.DEFAULT_AS_OF
    text = template(rule, item, lang, as_of)
    if client is None and not _llm_enabled(use_llm):
        return text
    if client is not None and use_llm is False:
        return text
    try:
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        rewrite = _rewrite(client, text, lang, as_of)
    except Exception:
        return text
    return rewrite if _rewrite_ok(rewrite, citation_of(rule, lang), as_of, lang) else text
