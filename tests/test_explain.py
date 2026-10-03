# test_explain.py: tests for the EN/ES explanation templates and the guarded LLM rewrite (W5).
# Runs with no API key; the Claude client is mocked.

from types import SimpleNamespace

import pytest

from realrent import explain as ex

RULE = {
    "team_rule_id": "fx-ca-rent-cap", "title": "Statewide rent cap",
    "citation": "Cal. Civ. Code § 1947.12", "effective_date": "2020-01-01",
}
AS_OF = "2026-10-01"
RESULTS = ["applies", "unknown", "superseded", "not_yet_effective", "pending"]


@pytest.fixture(autouse=True)
def no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("REALRENT_LLM_EXPLAIN", raising=False)


@pytest.mark.parametrize("lang", ["en", "es"])
@pytest.mark.parametrize("result", RESULTS)
def test_every_result_has_citation_date_and_disclaimer(result, lang):
    out = ex.explain(RULE, {"team_rule_id": "fx-ca-rent-cap", "result": result}, lang, as_of=AS_OF)
    assert RULE["citation"] in out
    assert AS_OF in out
    assert out.endswith(ex.DISCLAIMER[lang])
    assert "Statewide rent cap" in out


def test_contract_signature_positional_and_default_as_of():
    out = ex.explain(RULE, {"result": "applies"}, "en")
    assert out == ("Statewide rent cap applies to this address. "
                   "Source: Cal. Civ. Code § 1947.12; as of 2026-10-01. Not legal advice.")


def test_deterministic():
    item = {"result": "unknown", "reason": "missing_units"}
    assert ex.explain(RULE, item, "es", AS_OF) == ex.explain(RULE, item, "es", AS_OF)


@pytest.mark.parametrize("reason,en,es", [
    ("missing_year_built", "year the building was built", "año de construcción"),
    ("missing_units", "number of units", "número de unidades"),
    ("cutoff_year_ambiguous", "cutoff year", "año de corte"),
    ("unresolved_address", "which city", "qué ciudad"),
    ("small_owner_exemption_unresolved", "ownership data", "datos de propiedad"),
    ("something_new", "a fact needed to decide coverage is missing", "falta un dato"),
    (None, "a fact needed to decide coverage is missing", "falta un dato"),
])
def test_unknown_reasons(reason, en, es):
    item = {"result": "unknown", "reason": reason}
    assert en in ex.explain(RULE, item, "en", AS_OF)
    assert es in ex.explain(RULE, item, "es", AS_OF)
    assert "cannot tell" in ex.explain(RULE, item, "en", AS_OF)


def test_superseded_reason_names_overriding_rule():
    item = {"result": "superseded", "reason": "superseded_by:fx-sf-rent-ord"}
    en = ex.explain(RULE, item, "en", AS_OF)
    es = ex.explain(RULE, item, "es", AS_OF)
    assert "does not govern" in en and "fx-sf-rent-ord" in en
    assert "no rige" in es and "fx-sf-rent-ord" in es
    generic = ex.explain(RULE, {"result": "superseded"}, "en", AS_OF)
    assert "a local rule governs instead" in generic


def test_not_yet_effective_states_effective_date():
    rule = dict(RULE, effective_date="2027-07-01")
    item = {"result": "not_yet_effective"}
    assert "takes effect on 2027-07-01" in ex.explain(rule, item, "en", AS_OF)
    assert "entra en vigor el 2027-07-01" in ex.explain(rule, item, "es", AS_OF)
    no_date = ex.explain(dict(RULE, effective_date=None), item, "en", AS_OF)
    assert "not stated in the source" in no_date


def test_pending_is_never_presented_as_law():
    out = ex.explain(RULE, {"result": "pending"}, "en", AS_OF)
    assert "pending bill, not law" in out


def test_robust_to_missing_fields():
    out = ex.explain({}, {}, "en", AS_OF)
    assert out.startswith("We could not determine the status of This rule")
    assert "citation not available" in out and out.endswith("Not legal advice.")
    out = ex.explain(None, None, "es")
    assert "cita no disponible" in out and "2026-10-01" in out and out.endswith("No es asesoría legal.")
    out = ex.explain({"team_rule_id": "r1", "title": None, "citation": None}, {"result": "applies"}, "en")
    assert out.startswith("r1 applies")


def test_as_of_from_item():
    assert "as of 2027-07-02" in ex.explain(RULE, {"result": "applies", "as_of": "2027-07-02"}, "en")


@pytest.mark.parametrize("lang,expected", [("ES", "es"), ("es-MX", "es"), ("fr", "en"), (None, "en")])
def test_language_normalization(lang, expected):
    out = ex.explain(RULE, {"result": "applies"}, lang, AS_OF)
    assert out.endswith(ex.DISCLAIMER[expected])


def test_no_avoidance_advice_in_templates():
    for result in RESULTS:
        for lang in ex.LANGS:
            text = ex.explain(RULE, {"result": result}, lang, AS_OF).lower()
            for word in ("avoid", "get around", "loophole", "evitar", "eludir"):
                assert word not in text


class FakeClient:
    def __init__(self, reply=None, error=None):
        self.calls = []
        self.messages = self
        self.reply, self.error = reply, error

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=self.reply)])


def test_llm_off_by_default_even_with_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    import anthropic

    monkeypatch.setattr(anthropic, "Anthropic", lambda: pytest.fail("client must not be built"))
    assert ex.explain(RULE, {"result": "applies"}, "en", AS_OF) == ex.template(RULE, {"result": "applies"}, "en", AS_OF)


def test_llm_flag_without_key_uses_template(monkeypatch):
    monkeypatch.setenv("REALRENT_LLM_EXPLAIN", "1")
    assert ex.explain(RULE, {"result": "applies"}, "en", AS_OF) == ex.template(RULE, {"result": "applies"}, "en", AS_OF)


def test_llm_rewrite_accepted_when_it_keeps_citation_date_disclaimer():
    good = ("This address is covered by the statewide rent cap (Cal. Civ. Code § 1947.12), "
            "as of 2026-10-01. Not legal advice.")
    client = FakeClient(reply=good)
    assert ex.explain(RULE, {"result": "applies"}, "en", AS_OF, client=client) == good
    assert client.calls[0]["model"] == "claude-opus-5-5"


@pytest.mark.parametrize("reply", [
    "The statewide rent cap applies here as of 2026-10-01. Not legal advice.",  # no citation
    "The cap applies (Cal. Civ. Code § 1947.12). Not legal advice.",  # no date
    "The cap applies (Cal. Civ. Code § 1947.12) as of 2026-10-01.",  # no disclaimer
    "",
])
def test_llm_rewrite_rejected_falls_back_to_template(reply):
    out = ex.explain(RULE, {"result": "applies"}, "en", AS_OF, client=FakeClient(reply=reply))
    assert out == ex.template(RULE, {"result": "applies"}, "en", AS_OF)


def test_llm_exception_falls_back_to_template():
    out = ex.explain(RULE, {"result": "unknown"}, "es", AS_OF, client=FakeClient(error=RuntimeError("boom")))
    assert out == ex.template(RULE, {"result": "unknown"}, "es", AS_OF)


def test_llm_enabled_via_env_builds_client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("REALRENT_LLM_EXPLAIN", "1")
    good = "Se aplica Cal. Civ. Code § 1947.12 a esta dirección a fecha de 2026-10-01. No es asesoría legal."
    import anthropic

    monkeypatch.setattr(anthropic, "Anthropic", lambda: FakeClient(reply=good))
    assert ex.explain(RULE, {"result": "applies"}, "es", AS_OF) == good


def test_use_llm_false_ignores_client():
    client = FakeClient(reply="x")
    ex.explain(RULE, {"result": "applies"}, "en", AS_OF, use_llm=False, client=client)
    assert client.calls == []
