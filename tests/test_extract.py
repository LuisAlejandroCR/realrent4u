# test_extract.py: tests for Module A post-processing (A2, A3, A14) with fake model outputs.
# Covers quote verification, mapping to the official schema, de-duplication and overrides.

from realrent import extract, validate

D001_QUOTE = "AMENDING CHAPTER 13.63 OF THE BERKELEY MUNICIPAL CODE COORDINATED PRICING ALGORITHMS"


def raw_rule(**overrides):
    rule = {
        "jurisdiction": "Berkeley, CA", "level": "city", "category": "algorithmic_rent_setting",
        "status": "in_force", "title": "Coordinated pricing algorithm ban",
        "requirement": "Landlords may not use coordinated pricing algorithms to set rents.",
        "key_value": "", "citation": "BMC ch. 13.63", "quoted_span": D001_QUOTE,
        "effective_date": "2026-03-01", "coverage_text": "", "built_cutoff_date": "",
        "built_cutoff_basis": "none", "built_cutoff_direction": "none", "min_units": 0,
        "exempts_small_owner_occupied": False, "exemptions": "", "penalty": "Civil penalty up to $1,000.",
        "displaces_state_rule": False,
        "interaction": "", "conflict_note": "", "confidence": 0.8,
    }
    rule.update(overrides)
    return rule


def test_valid_output_maps_to_official_schema():
    log = []
    rules = extract.build_rules({"D001": {"rules": [raw_rule()]}}, log)
    assert [r["team_rule_id"] for r in rules] == ["r-D001-01"]
    assert rules[0]["source_url"].startswith("https://berkeleyca.gov")
    assert rules[0]["exemptions"] is None and rules[0]["conflict_flag"] is False
    assert rules[0]["penalty"] == "Civil penalty up to $1,000."
    assert validate.check_rules({"rules": rules}) == []
    assert log[0]["action"] == "kept"


def test_invented_quote_is_dropped_and_logged():
    log = []
    fake = raw_rule(quoted_span="Rent increases are capped at three percent per year in Berkeley.")
    assert extract.build_rules({"D001": {"rules": [fake]}}, log) == []
    assert log == [{"doc_id": "D001", "n": 1, "category": "algorithmic_rent_setting",
                    "jurisdiction": "Berkeley, CA", "citation": "BMC ch. 13.63",
                    "action": "dropped", "reason": "quote_not_in_source", "quoted_span": fake["quoted_span"]}]


def test_bad_date_becomes_null_and_conflict_note_sets_flag():
    rules = extract.build_rules(
        {"D001": {"rules": [raw_rule(effective_date="March 2026", conflict_note="Two dates published.")]}}, [])
    assert rules[0]["effective_date"] is None
    assert rules[0]["conflict_flag"] is True


def test_duplicates_keep_highest_confidence():
    log = []
    rules = extract.build_rules(
        {"D001": {"rules": [raw_rule(confidence=0.5), raw_rule(confidence=0.9)]}}, log)
    assert [r["team_rule_id"] for r in rules] == ["r-D001-02"]
    assert any(e.get("reason") == "duplicate_of r-D001-02" for e in log)


def test_local_rule_that_displaces_state_links_overrides():
    state = raw_rule(jurisdiction="CA", level="state", category="rent_increase_limits",
                     citation="Cal. Civ. Code § 1947.12")
    local = raw_rule(category="rent_increase_limits", citation="BMC ch. 13.76", displaces_state_rule=True)
    rules = {r["team_rule_id"]: r for r in extract.build_rules({"D001": {"rules": [state, local]}}, [])}
    assert rules["r-D001-02"]["overrides"] == ["r-D001-01"]
    assert rules["r-D001-01"]["overrides"] == []


def test_raw_output_uses_cache_without_client(tmp_path, monkeypatch):
    monkeypatch.setattr(extract, "RAW", tmp_path)
    (tmp_path / "D001.json").write_text('{"rules": [], "meta": {}}', encoding="utf-8")
    doc = extract.corpus.documents()["D001"]
    assert extract.raw_output(None, doc) == {"rules": [], "meta": {}}


def test_ca_statute_without_date_gets_january_first_after_enactment():
    alg = raw_rule(jurisdiction="CA", level="state", citation="AB 325", effective_date="",
                   enacted_date="2025-10-06")
    rule = extract.build_rules({"D001": {"rules": [alg]}}, [])[0]
    assert rule["effective_date"] == "2026-01-01"
    assert rule["status"] == "in_force"
    assert "derived" in rule["extraction_note"]


def test_stated_effective_date_is_never_replaced():
    alg = raw_rule(jurisdiction="CA", level="state", effective_date="2027-07-01", enacted_date="2025-10-06")
    assert extract.build_rules({"D001": {"rules": [alg]}}, [])[0]["effective_date"] == "2027-07-01"


def test_state_rule_that_exempts_local_rent_control_is_overridden():
    state = raw_rule(jurisdiction="CA", level="state", category="rent_increase_limits", citation="1947.12",
                     exemptions="Housing under valid local rent control that restricts increases is exempt.")
    local = raw_rule(category="rent_increase_limits", citation="BMC ch. 13.76")
    rules = {r["team_rule_id"]: r for r in extract.build_rules({"D001": {"rules": [state, local]}}, [])}
    assert rules["r-D001-02"]["overrides"] == ["r-D001-01"]


def test_buildings_exempt_from_local_control_do_not_make_state_yield():
    state = raw_rule(jurisdiction="CA", level="state", category="rent_increase_limits", citation="x",
                     exemptions="Subsidized buildings may be exempt from local rent control.")
    local = raw_rule(category="rent_increase_limits", citation="BMC ch. 13.76")
    rules = {r["team_rule_id"]: r for r in extract.build_rules({"D001": {"rules": [state, local]}}, [])}
    assert rules["r-D001-02"]["overrides"] == []


def test_stale_prompt_version_is_reextracted_but_offline_uses_it(tmp_path, monkeypatch):
    monkeypatch.setattr(extract, "RAW", tmp_path)
    (tmp_path / "D001.json").write_text('{"rules": [], "meta": {}, "prompt_version": 1}', encoding="utf-8")
    doc = extract.corpus.documents()["D001"]
    assert extract.raw_output(None, doc)["prompt_version"] == 1
    monkeypatch.setattr(extract, "call_model", lambda client, d, t: {"rules": [], "meta": {"fresh": True}})
    assert extract.raw_output(object(), doc)["meta"] == {"fresh": True}
