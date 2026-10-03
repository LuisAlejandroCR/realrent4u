# test_validate.py: tests for the submission validator and the corpus quote check (A1, A3).
# Uses the real starter pack in data/; no network, no LLM.

import json

from realrent import corpus, paths, validate

D001_QUOTE = "BE IT ORDAINED by the Council of the City of Berkeley as follows:"


def good_rule(**overrides):
    rule = json.loads(paths.RULE_SCHEMA.parent.joinpath("sample_rule_record.json").read_text())
    rule.update(
        jurisdiction="Berkeley, CA",
        level="city",
        category="algorithmic_rent_setting",
        source_doc_id="D001",
        quoted_span=D001_QUOTE,
    )
    rule.update(overrides)
    return rule


def test_manifest_counts():
    docs = corpus.documents()
    assert len(docs) == 87
    assert sum(d.has_text for d in docs.values()) == 54
    assert len(corpus.addresses()) == 500


def test_document_text_drops_header():
    text = corpus.documents()["D001"].text()
    assert not text.startswith("SOURCE:")
    assert "ORDINANCE NO. 7,992-N.S." in text


def test_quote_found_across_line_breaks():
    quote = "AMENDING CHAPTER 13.63 OF THE BERKELEY MUNICIPAL CODE COORDINATED PRICING ALGORITHMS"
    assert corpus.find_quote("D001", quote)


def test_invented_quote_rejected():
    assert corpus.find_quote("D001", "Rent may never increase by more than one percent per year.") is None
    assert corpus.find_quote("D002", D001_QUOTE) is None  # link-only document has no text


def test_valid_rule_passes():
    assert validate.check_rules({"rules": [good_rule()]}) == []


def test_rule_schema_violations_reported():
    errors = validate.check_rules({"rules": [good_rule(status="enacted"), good_rule()]})
    assert any("enacted" in e for e in errors)
    assert any("duplicate" in e for e in errors)


def test_rule_with_fake_quote_fails():
    errors = validate.check_rules({"rules": [good_rule(quoted_span="This sentence is not in the source text.")]})
    assert any("not found" in e for e in errors)


def test_lookups_must_cover_all_addresses():
    errors = validate.check_lookups({"as_of": "2026-10-01", "lookups": {"A0001": []}}, set())
    assert any("499 addresses missing" in e for e in errors)


def test_lookups_reject_bad_result_value():
    lookups = {a["address_id"]: [] for a in corpus.addresses()}
    lookups["A0001"] = [{"team_rule_id": "r-0001", "result": "not yet effective",
                         "explanation": "x", "conflict_flag": False}]
    errors = validate.check_lookups({"as_of": "2026-10-01", "lookups": lookups}, {"r-0001"})
    assert errors == ["lookups.json A0001: bad result 'not yet effective'"]


def test_changes_require_every_test():
    errors = validate.check_changes({"T1": {"affected_address_ids": ["A0001"]}})
    assert {e for e in errors if "missing test" in e} == {f"changes.json: missing test T{i}" for i in range(2, 6)}


def test_committed_submission_is_valid():
    assert validate.validate_all() == []
