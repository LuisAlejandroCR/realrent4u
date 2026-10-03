# engine.py: deterministic apply engine (Module B): rule x building facts x as_of -> LookupItems.
# Pure functions, no network, no model calls; tolerant of null/oddly typed fields in extracted rules.
# Policy: when a needed fact is missing or ambiguous the answer is `unknown` with a machine reason.

from __future__ import annotations

import re
from datetime import date, timedelta

from realrent.contracts import Jurisdiction, LookupItem

STATE_NAMES = {"california": "CA", "new jersey": "NJ", "massachusetts": "MA"}

# Postal cities that may sit inside an in-scope legal city. Used only for addresses the resolver
# could not place, to answer `unknown` (reason unresolved_address) instead of silently omitting.
POSTAL_ALIASES = {
    "dorchester": "boston", "roxbury": "boston", "allston": "boston", "brighton": "boston",
    "east boston": "boston", "south boston": "boston", "hyde park": "boston",
    "jamaica plain": "boston", "mattapan": "boston", "charlestown": "boston",
    "west roxbury": "boston", "roslindale": "boston", "san ysidro": "san diego",
}

# Default "small building" size for the owner-occupied exemption when the exemption text gives none.
# Deliberately generous so the exemption is only ruled out for clearly larger buildings.
SMALL_OWNER_DEFAULT_MAX_UNITS = 4

REASON_TEXT = {
    "missing_year_built": "the year built is not in the data",
    "missing_units": "the number of units is not in the data",
    "cutoff_year_ambiguous": "the building dates from the cutoff year, and the exact date "
    "(e.g. certificate of occupancy) is not in the data",
    "cutoff_unparsed": "the construction cutoff in the rule could not be read",
    "small_owner_exemption_unresolved": "an owner-occupied small-building exemption may apply "
    "and owner data is not available",
    "unresolved_address": "the address could not be placed in a legal jurisdiction",
    "effective_date_ambiguous": "the effective date is given only as a month or year",
    "not_yet_effective_no_date": "the law is enacted but its effective date is not stated",
    "unrecognized_status": "the rule status could not be read",
    "bars_local_rent_control": "state law forbids local rent control; there is no rent cap",
}

_WORD_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
             "eight": 8, "nine": 9, "ten": 10, "fifteen": 15, "twenty": 20, "thirty": 30}
_MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september",
     "october", "november", "december"], start=1)}


# ---------------------------------------------------------------- parsing helpers

def _norm(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def _num(s) -> int | None:
    """Integer from int/float/str like '32', '32.0', '5+', 'five'; None if absent or not positive."""
    if s is None or isinstance(s, bool):
        return None
    if isinstance(s, (int, float)):
        return int(s) if s > 0 else None
    t = _norm(s)
    if t in _WORD_NUM:
        return _WORD_NUM[t]
    m = re.search(r"\d+(?:\.\d+)?", t)
    if not m:
        return None
    n = int(float(m.group()))
    return n if n > 0 else None


def _end_of_month(y: int, m: int) -> date:
    return (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1))


def parse_period(s) -> tuple[date, date] | None:
    """Date or partial date -> (first day, last day). Accepts YYYY, YYYY-MM, YYYY-MM-DD,
    MM/DD/YYYY and 'Month D, YYYY'. None if absent or unreadable."""
    if s is None:
        return None
    if isinstance(s, date):
        return s, s
    t = _norm(s)
    if not t or t in {"none", "null", "n/a"}:
        return None
    try:
        if m := re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})(?:t.*)?", t):
            d = date(int(m[1]), int(m[2]), int(m[3]))
            return d, d
        if m := re.fullmatch(r"(\d{4})-(\d{1,2})", t):
            y, mo = int(m[1]), int(m[2])
            return date(y, mo, 1), _end_of_month(y, mo)
        if m := re.fullmatch(r"(\d{4})", t):
            y = int(m[1])
            return date(y, 1, 1), date(y, 12, 31)
        if m := re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", t):
            d = date(int(m[3]), int(m[1]), int(m[2]))
            return d, d
        if m := re.fullmatch(r"([a-z]+)\.? (\d{1,2}),? (\d{4})", t):
            mo = next((v for k, v in _MONTHS.items() if k.startswith(m[1][:3])), None)
            if mo:
                d = date(int(m[3]), mo, int(m[2]))
                return d, d
    except ValueError:
        return None
    return None


def _year(row: dict) -> int | None:
    y = _num(row.get("year_built"))
    return y if y and 1600 <= y <= 2100 else None


def units_known(row: dict) -> tuple[int | None, int | None]:
    """(exact units, lower bound). The lower bound comes only from explicit wording in the row's
    use description ('5+ units', 'Five or more apartments', '4-8-UNIT-APT'); never guessed."""
    exact = _num(row.get("units"))
    if exact:
        return exact, exact
    desc = _norm(row.get("use_description"))
    for pat in (r"(\d+)\s*\+\s*units?", r"(\w+) or more (?:apartments|units)",
                r"(\d+)\s*units? or more", r"(\d+)\s*-\s*\d+\s*-?\s*units?"):
        if m := re.search(pat, desc):
            if n := _num(m[1]):
                return None, n
    return None, None


def _cond(rule: dict) -> dict:
    c = rule.get("coverage_conditions")
    return c if isinstance(c, dict) else {}


def _bool(v) -> bool:
    if isinstance(v, str):
        return _norm(v) in {"true", "yes", "1"}
    return bool(v)


def _jur_key(s) -> str:
    """Normalize 'City of San Francisco, California' -> 'san francisco, ca'; 'California' -> 'ca'."""
    t = _norm(s).replace("city of ", "").replace("city and county of ", "")
    for name, code in STATE_NAMES.items():
        t = re.sub(rf"\b{name}\b", code.lower(), t)
    return t


def _state_of(rule: dict) -> str:
    return _jur_key(rule.get("jurisdiction")).rsplit(",", 1)[-1].strip()


def _is_state_rule(rule: dict) -> bool:
    return "," not in _jur_key(rule.get("jurisdiction"))


# ---------------------------------------------------------------- candidate + time

def _place(row: dict, jur: Jurisdiction | None) -> tuple[str, str | None, str | None, bool]:
    """(state key, city key, county key, resolved) for the address."""
    jur = jur or {}
    state = _norm(jur.get("state") or row.get("state"))
    city = _jur_key(jur["jurisdiction"]) if jur.get("jurisdiction") else None
    county = f"{_norm(jur['county'])}, {state}" if jur.get("county") else None
    resolved = bool(jur) and jur.get("match") != "none"
    return state, city, county, resolved


def _candidate(rule: dict, row: dict, jur: Jurisdiction | None) -> str | None:
    """'yes' if the rule's jurisdiction covers the address, 'maybe' if the address is unresolved
    but its postal city names the rule's city, else None."""
    rj = _jur_key(rule.get("jurisdiction"))
    if not rj:
        return None
    state, city, county, resolved = _place(row, jur)
    if rj == state or rj == city or (county and rj == county):
        return "yes"
    if resolved or "," not in rj:
        return None
    r_city, r_state = (p.strip() for p in rj.rsplit(",", 1))
    postal = _norm(row.get("postal_city"))
    if r_state == state and r_city in {postal, POSTAL_ALIASES.get(postal)}:
        return "maybe"
    return None


def _time_result(rule: dict, as_of: date) -> tuple[str | None, str | None]:
    """(result or None to continue to coverage, reason). Result 'omit' drops the rule."""
    status = _norm(rule.get("status")).replace(" ", "_").replace("-", "_")
    if status == "failed":
        return "omit", None
    if status == "pending":
        return "pending", None
    if status not in {"in_force", "not_yet_effective"}:
        return "unknown", "unrecognized_status"
    period = parse_period(rule.get("effective_date"))
    if period is None:
        if status == "not_yet_effective":
            return "not_yet_effective", "not_yet_effective_no_date"
        return None, None
    start, end = period
    if as_of < start:
        return "not_yet_effective", None
    if as_of < end:  # inside a month/year-only effective period
        return "unknown", "effective_date_ambiguous"
    return None, None


# ---------------------------------------------------------------- coverage

def _rolling_years(rule: dict) -> int | None:
    """N from 'certificate of occupancy within the last 15 years' / 'older than 15 years'."""
    c = _cond(rule)
    text = " ".join(_norm(x) for x in (c.get("text"), rule.get("exemptions"),
                                       rule.get("coverage_conditions") if isinstance(
                                           rule.get("coverage_conditions"), str) else None))
    m = re.search(r"(?:last|past|previous|preceding|within|older than|more than|at least)\s+"
                  r"(\d+|\w+)\s+years", text)
    return _num(m[1]) if m and _num(m[1]) else None


def _cutoff(rule: dict, as_of: date) -> tuple[str, tuple[date, date] | None] | None:
    """(direction 'before'|'after', cutoff period) or None if the rule has no construction cutoff.
    Period None means a cutoff exists but cannot be read."""
    c = _cond(rule)
    basis = _norm(c.get("built_cutoff_basis"))
    direction = _norm(c.get("built_cutoff_direction"))
    raw = c.get("built_cutoff_date")
    has_raw = raw not in (None, "") and _norm(raw) not in {"none", "null"}
    if "before" in direction:
        direction = "before"
    elif "after" in direction:
        direction = "after"
    else:
        direction = ""
    if has_raw and direction:
        return direction, parse_period(raw)
    if has_raw and basis not in {"", "none"}:
        return "before", parse_period(raw)  # a dated cutoff with no direction: usual "built before"
    if (n := _rolling_years(rule)) is not None:
        try:
            d = as_of.replace(year=as_of.year - n)
        except ValueError:
            d = as_of.replace(year=as_of.year - n, day=28)
        return "before", (d, d)  # covered when certificate of occupancy is more than N years old
    return None


def _coverage(rule: dict, row: dict, as_of: date) -> tuple[str, list[str]]:
    """('in' | 'out' | 'unknown', reasons)."""
    reasons: list[str] = []
    out = False
    c = _cond(rule)

    cut = _cutoff(rule, as_of)
    if cut:
        direction, period = cut
        year = _year(row)
        if period is None:
            reasons.append("cutoff_unparsed")
        elif year is None:
            reasons.append("missing_year_built")
        else:
            b0, b1 = date(year, 1, 1), date(year, 12, 31)
            c0, c1 = period
            if direction == "before":
                sure_in, sure_out = b1 <= c0, b0 > c1
            else:
                sure_in, sure_out = b0 > c1, b1 <= c0
            if sure_out:
                out = True
            elif not sure_in:
                reasons.append("cutoff_year_ambiguous")

    exact, lower = units_known(row)
    min_units = _num(c.get("min_units")) or 0
    if min_units > 1:
        if exact is not None:
            out = out or exact < min_units
        elif lower is None or lower < min_units:
            reasons.append("missing_units")
    if c.get("max_units") is not None and (mx := _num(c.get("max_units"))):
        if lower is not None and lower > mx:
            out = True
        elif exact is None:
            reasons.append("missing_units")

    if _bool(c.get("exempts_small_owner_occupied")):
        if lower is None or lower <= _small_owner_max(rule):
            reasons.append("small_owner_exemption_unresolved")

    if out:
        return "out", []
    return ("unknown" if reasons else "in"), reasons


def _small_owner_max(rule: dict) -> int:
    text = " ".join(_norm(x) for x in (rule.get("exemptions"), _cond(rule).get("text")))
    m = re.search(r"(?:not more than|no more than|up to|at most)\s+(\w+)\s+(?:\w+\s+)?units?", text) \
        or re.search(r"(\w+)\s+(?:or fewer|or less)\s+(?:\w+\s+)?units?", text) \
        or re.search(r"(\w+)\s*-?\s*(?:unit|family)\s+(?:building|dwelling|propert)", text)
    if m and (n := _num(m[1])):
        return n
    for word, n in (("fourplex", 4), ("triplex", 3), ("duplex", 2), ("single-family", 1),
                    ("single family", 1)):
        if word in text:
            return n
    return SMALL_OWNER_DEFAULT_MAX_UNITS


# ---------------------------------------------------------------- precedence + conflicts

_SECTION = re.compile(r"\d+[a-z]?(?:[.:-]\d+[a-z]?)+")


def _refers_to(ref: str, rule: dict) -> bool:
    """Does an overrides entry (team_rule_id or citation) name this rule?"""
    ref_n = _norm(ref)
    if not ref_n:
        return False
    if ref_n == _norm(rule.get("team_rule_id")):
        return True
    cit = _norm(rule.get("citation"))
    if not cit:
        return False
    secs = set(_SECTION.findall(ref_n)) & set(_SECTION.findall(cit))
    if secs:
        return True
    squash = lambda s: re.sub(r"[^a-z0-9]", "", s)  # noqa: E731
    a, b = squash(ref_n), squash(cit)
    return len(min(a, b, key=len)) >= 5 and (a in b or b in a)


def _displaces(local: dict, state_rule: dict) -> bool:
    """Local rule governs instead of the state rule (local supersedes state)."""
    if _norm(local.get("category")) != _norm(state_rule.get("category")):
        overrides = local.get("overrides") or []
        return isinstance(overrides, list) and any(_refers_to(str(o), state_rule) for o in overrides)
    overrides = local.get("overrides")
    if isinstance(overrides, list) and any(_refers_to(str(o), state_rule) for o in overrides):
        return True
    if _bool(_cond(local).get("displaces_state_rule")):
        return True
    back = state_rule.get("overrides")
    inter = _norm(state_rule.get("interaction"))
    if isinstance(back, list) and any(_refers_to(str(o), local) for o in back):
        return any(w in inter for w in ("yield", "exempt", "does not apply", "stricter local"))
    return False


def _preempts(state_rule: dict) -> bool:
    text = _norm(state_rule.get("interaction")) + " " + _norm(state_rule.get("conflict_note"))
    return "preempt" in text


# ---------------------------------------------------------------- explanation

_PHRASE = {
    "en": {
        "applies": "applies to this address",
        "unknown": "may apply, but coverage cannot be determined",
        "superseded": "is superseded here",
        "not_yet_effective": "is enacted but not yet in effect",
        "pending": "is a pending bill or proposal and is not law",
    },
    "es": {
        "applies": "aplica a esta dirección",
        "unknown": "podría aplicar, pero no se puede determinar si cubre esta dirección",
        "superseded": "queda desplazada aquí por otra norma",
        "not_yet_effective": "está aprobada pero aún no está vigente",
        "pending": "es un proyecto de ley o propuesta pendiente y no es ley",
    },
}

REASON_TEXT_ES = {
    "missing_year_built": "el año de construcción no está en los datos",
    "missing_units": "el número de unidades no está en los datos",
    "cutoff_year_ambiguous": "el edificio es del año de corte y la fecha exacta (por ejemplo, "
    "el certificado de ocupación) no está en los datos",
    "cutoff_unparsed": "no se pudo leer la fecha de corte de construcción de la norma",
    "small_owner_exemption_unresolved": "podría aplicar una exención para edificios pequeños "
    "ocupados por su dueño y no hay datos de propiedad",
    "unresolved_address": "no se pudo ubicar la dirección en una jurisdicción legal",
    "effective_date_ambiguous": "la fecha de vigencia solo indica el mes o el año",
    "not_yet_effective_no_date": "la ley está aprobada pero no indica su fecha de vigencia",
    "unrecognized_status": "no se pudo leer el estado de la norma",
    "bars_local_rent_control": "la ley estatal prohíbe el control de rentas local; no hay tope de renta",
}

_WORDS = {
    "en": {"why": "Why", "as_of": "As of", "disclaimer": "Not legal advice.",
           "effective": "effective", "flag": "Flagged for human review",
           "flag_default": "state and local rules on this topic may conflict",
           "sup": "the local rule {name} governs instead",
           "maybe_sup": "the local rule {name} may govern instead"},
    "es": {"why": "Motivo", "as_of": "A fecha de", "disclaimer": "No es asesoría legal.",
           "effective": "vigente desde", "flag": "Marcado para revisión humana",
           "flag_default": "las normas estatales y locales sobre este tema podrían entrar en conflicto",
           "sup": "la norma local {name} rige en su lugar",
           "maybe_sup": "la norma local {name} podría regir en su lugar"},
}


def reason_text(reason: str | None, rules_by_id: dict[str, dict] | None = None,
                lang: str = "en") -> str:
    if not reason:
        return ""
    w = _WORDS[lang]
    table = REASON_TEXT if lang == "en" else REASON_TEXT_ES
    parts = []
    for r in reason.split(","):
        if ":" in r:
            kind, rid = r.split(":", 1)
            other = (rules_by_id or {}).get(rid, {})
            name = other.get("citation") or other.get("title") or rid
            parts.append((w["sup"] if kind == "superseded_by" else w["maybe_sup"]).format(name=name))
        else:
            parts.append(table.get(r, r.replace("_", " ")))
    return "; ".join(parts)


_BAR = re.compile(r"(prohibit|bars?\b|barred|bans?\b|preclud|forbid|may not|shall not|no city or town|"
                  r"preempt)[^.]{0,100}rent control|rent control[^.]{0,60}(prohibited|barred|banned)")


def is_rent_control_bar(rule: dict) -> bool:
    """A state law that forbids local rent control (e.g. Mass. G.L. c. 40P). It is not a rent cap and
    must never be described as one."""
    if _norm(rule.get("category")) != "rent_increase_limits":
        return False
    cit = re.sub(r"[^a-z0-9]", "", _norm(rule.get("citation")))
    text = " ".join(_norm(rule.get(k)) for k in ("title", "requirement", "key_value", "interaction"))
    return "40p" in cit or bool(_BAR.search(text))


def _bar_explanation(rule: dict, item: dict, as_of: str, rules_by_id, lang: str) -> str:
    cit = rule.get("citation") or rule.get("source_doc_id") or "source"
    w = _WORDS[lang]
    res = item["result"]
    if lang == "es":
        lead = {"applies": "La ley estatal prohíbe", "not_yet_effective": "La ley estatal prohibirá",
                "pending": "La ley estatal prohibiría"}.get(res, "La ley estatal podría prohibir")
        out = (f"{lead} a las ciudades imponer control de rentas. "
               f"No es un tope de renta y no fija ningún límite a los aumentos de renta. "
               f"Cita: {cit}")
    else:
        verb = {"applies": "bars", "not_yet_effective": "will bar", "pending": "would bar"}.get(
            res, "may bar")
        out = (f"State law ({cit}) {verb} cities and towns from imposing rent control. "
               f"It is not a rent cap and sets no limit on rent increases")
    if res not in {"applies", "not_yet_effective", "pending"}:
        out += f" ({_PHRASE[lang].get(res, res)})"
    reason = item.get("reason") if item.get("reason") != "bars_local_rent_control" else None
    if why := reason_text(reason, rules_by_id, lang):
        out += f". {w['why']}: {why}"
    return out + f". {w['as_of']} {as_of}. {w['disclaimer']}"


def template_explanation(rule: dict, item: dict, as_of: str,
                         rules_by_id: dict[str, dict] | None = None, lang: str = "en") -> str:
    lang = lang if lang in _WORDS else "en"
    if is_rent_control_bar(rule):
        return _bar_explanation(rule, item, as_of, rules_by_id, lang)
    w = _WORDS[lang]
    title = rule.get("title") or rule.get("team_rule_id")
    cit = rule.get("citation") or rule.get("source_doc_id") or "source"
    out = f"{title} ({cit}) {_PHRASE[lang].get(item['result'], item['result'])}"
    if item["result"] == "not_yet_effective" and rule.get("effective_date"):
        out += f" ({w['effective']} {rule['effective_date']})"
    out += "."
    if why := reason_text(item.get("reason"), rules_by_id, lang):
        out += f" {w['why']}: {why}."
    if item.get("conflict_flag"):
        note = (rule.get("conflict_note") if lang == "en" else None) or w["flag_default"]
        out += f" {w['flag']}: {note.rstrip('.')}."
    return out + f" {w['as_of']} {as_of}. {w['disclaimer']}"


try:  # W5's explainer, if present; any failure falls back to the template.
    from realrent.explain import explain as _explain  # type: ignore
except Exception:  # pragma: no cover - depends on W5 being merged
    _explain = None

_EXPLAIN_CACHE: dict[tuple, str] = {}


def _call_explain(rule: dict, item: dict, as_of: str, lang: str) -> str:
    try:
        return _explain(rule, {**item, "as_of": as_of}, lang, as_of=as_of) or ""
    except TypeError:  # an explain() without the as_of keyword
        return _explain(rule, {**item, "as_of": as_of}, lang) or ""


def explanation(rule: dict, item: dict, as_of: str, rules_by_id: dict[str, dict],
                lang: str = "en") -> str:
    """Memoized per (rule, result, reason, flag, date, lang): explanations never depend on the
    address beyond those, so even an LLM-backed explainer is called a bounded number of times."""
    key = (rule.get("team_rule_id"), item["result"], item.get("reason"),
           item.get("conflict_flag"), as_of, rule.get("title"), rule.get("citation"), lang)
    if key in _EXPLAIN_CACHE:
        return _EXPLAIN_CACHE[key]
    base = {k: v for k, v in item.items() if not k.startswith("explanation")}
    text = ""
    if _explain is not None and not is_rent_control_bar(rule):
        try:
            text = _call_explain(rule, base, as_of, lang)
        except Exception:
            text = ""
    if not text.strip():
        text = template_explanation(rule, base, as_of, rules_by_id, lang)
    _EXPLAIN_CACHE[key] = text
    return text


# ---------------------------------------------------------------- evaluate

def _as_date(as_of) -> date:
    p = parse_period(as_of)
    if p is None:
        raise ValueError(f"bad as_of date: {as_of!r}")
    return p[0]


def evaluate(rules: list[dict], address_row: dict, jurisdiction: Jurisdiction | None,
             as_of: str) -> list[LookupItem]:
    """LookupItems for one address on one date; rules that do not apply are omitted.

    Steps: candidate (state / county / city match) -> status and effective date vs as_of ->
    coverage (built cutoff, units, small-owner exemption) -> local-over-state precedence
    (superseded) -> conflict flags -> explanation.
    """
    day = _as_date(as_of)
    rules = [r for r in rules if isinstance(r, dict) and r.get("team_rule_id")]
    by_id = {r["team_rule_id"]: r for r in rules}
    found: list[tuple[dict, dict]] = []  # (rule, item without explanation)

    for rule in rules:
        cand = _candidate(rule, address_row, jurisdiction)
        if cand is None:
            continue
        result, reason = _time_result(rule, day)
        if result == "omit":
            continue
        cov, cov_reasons = _coverage(rule, address_row, day)
        if cov == "out":
            continue
        reasons = [reason] if reason else []
        if cand == "maybe":
            reasons.insert(0, "unresolved_address")
        reasons += cov_reasons
        if result is None:
            result = "unknown" if reasons else "applies"
        if result == "applies" and is_rent_control_bar(rule):
            reasons = ["bars_local_rent_control"]  # informational: not a cap (see T5)
        found.append((rule, {"team_rule_id": rule["team_rule_id"], "result": result,
                             "conflict_flag": False,
                             "reason": ",".join(dict.fromkeys(reasons)) or None}))

    # Precedence: a local rule that displaces a state rule. Applies -> state superseded;
    # unknown -> a state rule that would apply becomes unknown (possibly superseded).
    locals_ = [(r, it) for r, it in found if not _is_state_rule(r)]
    for srule, sitem in found:
        if not _is_state_rule(srule) or sitem["result"] not in {"applies", "unknown"}:
            continue
        for lrule, litem in locals_:
            if not _displaces(lrule, srule):
                continue
            if litem["result"] == "applies":
                sitem["result"] = "superseded"
                sitem["reason"] = f"superseded_by:{lrule['team_rule_id']}"
                break
            if litem["result"] == "unknown" and sitem["result"] == "applies":
                sitem["result"] = "unknown"
                sitem["reason"] = f"possibly_superseded_by:{lrule['team_rule_id']}"

    # Conflicts. A flagged city rule is always flagged. A flagged (or preempting) state rule is
    # flagged where a same-category local rule is also present; if no city rule of that category
    # exists anywhere in its state, the flag is about the rule itself and shows everywhere.
    for srule, sitem in found:
        if not _is_state_rule(srule):
            if _bool(srule.get("conflict_flag")):
                sitem["conflict_flag"] = True
            continue
        if not (_bool(srule.get("conflict_flag")) or _preempts(srule)):
            continue
        cat, st = _norm(srule.get("category")), _state_of(srule)
        peers = [(lr, li) for lr, li in locals_ if _norm(lr.get("category")) == cat]
        any_local = any(not _is_state_rule(r) and _norm(r.get("category")) == cat
                        and _state_of(r) == st for r in rules)
        if peers:
            sitem["conflict_flag"] = True
            for _, li in peers:
                li["conflict_flag"] = True
        elif not any_local and _bool(srule.get("conflict_flag")):
            sitem["conflict_flag"] = True

    items: list[LookupItem] = []
    for rule, item in found:
        item["explanation"] = explanation(rule, item, as_of, by_id)
        item["explanation_es"] = explanation(rule, item, as_of, by_id, "es")
        items.append(item)  # type: ignore[arg-type]
    return items
