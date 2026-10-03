# test_contracts.py: keeps the shared fixtures consistent with the official schema and the data.
# Every workstream builds on these fixtures, so a broken fixture breaks all of them.

import json

from jsonschema import Draft202012Validator

from realrent import corpus, paths

CITIES = {
    "Los Angeles, CA", "San Francisco, CA", "San Diego, CA", "Berkeley, CA", "Santa Ana, CA",
    "Jersey City, NJ", "Hoboken, NJ", "Newark, NJ", "Boston, MA", "Cambridge, MA",
}


def _fixture(name):
    return json.loads((paths.FIXTURES / name).read_text(encoding="utf-8"))


def test_fixture_rules_match_official_schema():
    validator = Draft202012Validator(json.loads(paths.RULE_SCHEMA.read_text(encoding="utf-8")))
    rules = _fixture("rules.json")["rules"]
    for rule in rules:
        assert list(validator.iter_errors(rule)) == [], rule["team_rule_id"]
        assert rule["team_rule_id"].startswith("fx-")
        assert rule["jurisdiction"] in CITIES | {"CA", "NJ", "MA"}
    ids = {r["team_rule_id"] for r in rules}
    assert all(o in ids for r in rules for o in r["overrides"])


def test_fixture_jurisdictions_use_real_addresses():
    by_id = {a["address_id"]: a for a in corpus.addresses()}
    for aid, j in _fixture("jurisdictions.json").items():
        if aid.startswith("_"):
            continue
        assert aid in by_id
        assert j["state"] == by_id[aid]["state"]
        assert j["jurisdiction"] in CITIES
        assert j["match"] in {"exact", "fallback", "none"}


def test_demo_dates_cover_change_tests():
    tests = json.loads(paths.CHANGE_TESTS.read_text(encoding="utf-8"))
    dates = {t.get(k) for t in tests for k in ("as_of", "as_of_before", "as_of_after")} - {None}
    assert dates <= set(paths.DEMO_DATES)
