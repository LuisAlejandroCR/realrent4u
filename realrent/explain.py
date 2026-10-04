# explain.py: plain-language EN/ES explanation of one lookup result (rule x address x as_of).
# Deterministic templates by default; an opt-in Claude rewrite (REALRENT_LLM_EXPLAIN=1 + key) only
# polishes wording and is discarded unless it keeps the citation, the as-of date and the disclaimer.
# Rewrites are cached in runs/explain/ (committed, like runs/raw/), so offline runs reproduce them.

import hashlib
import json
import os
from datetime import datetime, timezone

from realrent import paths

MODEL = "claude-opus-5-5"
# One JSON file per rewritten text: the audit trail of model output (A14) and the offline cache.
CACHE_DIR = paths.RUNS / "explain"
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
POSSIBLY_SUPERSEDED_REASON = {
    "en": "a local rule ({id}) may govern instead of it, but we cannot tell whether that local rule "
    "covers this address",
    "es": "una regla local ({id}) podría regir en su lugar, pero no podemos saber si esa regla local "
    "cubre esta dirección",
}
POSSIBLY_SUPERSEDED_GENERIC = {
    "en": "a local rule may govern instead of it, but we cannot tell whether that local rule covers "
    "this address",
    "es": "una regla local podría regir en su lugar, pero no podemos saber si esa regla local cubre "
    "esta dirección",
}
# Not a coverage gap but a description of what the rule does; appended as its own clause.
BARS_LOCAL_RENT_CONTROL = "bars_local_rent_control"
BARS_NOTE = {
    "en": "This state law bars cities from imposing rent control; it is not a rent cap and sets no "
    "limit on rent increases.",
    "es": "Esta ley estatal prohíbe a las ciudades imponer control de rentas; no es un tope de renta "
    "y no fija ningún límite a los aumentos de renta.",
}
AND = {"en": " and ", "es": " y "}
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


def _reasons(reason) -> list[str]:
    """Split a (possibly comma-joined) machine reason into its parts, in order, without duplicates."""
    parts = [p.strip() for p in _text(reason).split(",")]
    return list(dict.fromkeys(p for p in parts if p))


def _one_reason(reason: str, lang: str) -> str:
    if reason.startswith("superseded_by:"):
        rid = reason.split(":", 1)[1].strip()
        return SUPERSEDED_REASON[lang].format(id=rid) if rid else SUPERSEDED_GENERIC[lang]
    if reason.startswith("possibly_superseded_by:"):
        rid = reason.split(":", 1)[1].strip()
        return POSSIBLY_SUPERSEDED_REASON[lang].format(id=rid) if rid else POSSIBLY_SUPERSEDED_GENERIC[lang]
    if reason in REASONS:
        return REASONS[reason][lang]
    return GENERIC_REASON[lang]


def _reason_text(reason, lang: str) -> str:
    """Human text for one or more reasons (bars_local_rent_control is a note, not a reason)."""
    texts = [_one_reason(r, lang) for r in _reasons(reason) if r != BARS_LOCAL_RENT_CONTROL]
    texts = list(dict.fromkeys(texts)) or [GENERIC_REASON[lang]]
    if len(texts) == 1:
        return texts[0]
    return ", ".join(texts[:-1]) + AND[lang] + texts[-1]


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
        if not [r for r in _reasons(reason) if r != BARS_LOCAL_RENT_CONTROL]:
            overrider = _text(item.get("superseded_by"))
            reason = ",".join([f"superseded_by:{overrider}"] + _reasons(reason))
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

    if BARS_LOCAL_RENT_CONTROL in _reasons(reason):
        first = f"{first} {BARS_NOTE[lang]}"
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
        # The model may think before answering, and thinking shares this budget; 400 cut answers short.
        max_tokens=1500,
        system=REWRITE_SYSTEM.format(
            language="English" if lang == "en" else "Spanish", as_of=as_of, disclaimer=DISCLAIMER[lang]
        ),
        messages=[{"role": "user", "content": text}],
    )
    if getattr(response, "stop_reason", None) == "max_tokens":
        return ""  # a cut-off answer is never used or cached
    return "".join(getattr(b, "text", "") for b in response.content).strip()


def _cache_file(text: str, lang: str, as_of: str):
    system = REWRITE_SYSTEM.format(
        language="English" if lang == "en" else "Spanish", as_of=as_of, disclaimer=DISCLAIMER[lang]
    )
    digest = hashlib.sha256("\n".join((MODEL, system, text)).encode("utf-8")).hexdigest()[:20]
    return CACHE_DIR / f"{digest}.json"


def _cached(text: str, lang: str, as_of: str) -> str | None:
    try:
        return json.loads(_cache_file(text, lang, as_of).read_text(encoding="utf-8")).get("rewrite")
    except (OSError, ValueError):
        return None


def _store(text: str, lang: str, as_of: str, rewrite: str, kept: bool) -> None:
    f = _cache_file(text, lang, as_of)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps({
        "model": MODEL, "lang": lang, "as_of": as_of, "template": text, "rewrite": rewrite,
        "kept": kept, "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _rewrite_ok(rewrite: str, citation: str, as_of: str, lang: str) -> bool:
    return bool(rewrite) and citation in rewrite and as_of in rewrite and rewrite.endswith(DISCLAIMER[lang])


def explain(rule: dict, item: dict, lang: str = "en", as_of: str | None = None, *,
            use_llm: bool | None = None, client=None) -> str:
    """One or two plain sentences + disclaimer. Template unless the LLM rewrite is enabled and valid."""
    lang = _lang(lang)
    as_of = _text(as_of) or _text((item or {}).get("as_of")) or paths.DEFAULT_AS_OF
    text = template(rule, item, lang, as_of)
    citation = citation_of(rule, lang)
    if use_llm is False:
        return text
    # A cached rewrite is reused with or without a key, so offline runs give the same text (A2).
    cached = _cached(text, lang, as_of) if client is None else None
    if cached is not None:
        return cached if _rewrite_ok(cached, citation, as_of, lang) else text
    if client is None and not _llm_enabled(use_llm):
        return text
    try:
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        rewrite = _rewrite(client, text, lang, as_of)
    except Exception:
        return text
    if not rewrite:
        return text
    kept = _rewrite_ok(rewrite, citation, as_of, lang)
    _store(text, lang, as_of, rewrite, kept)
    return rewrite if kept else text
