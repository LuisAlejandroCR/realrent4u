# test_changes.py: tests for Module C change tracking (T1–T5) with a stub evaluate and the fixtures.
# No network, no LLM, and no dependency on realrent.engine (W3).

import json

import pytest

from realrent import changes, contracts, paths, validate


def _fixture(name):
    data = json.loads((paths.FIXTURES / name).read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_")}


RULES = _fixture("rules.json")["rules"]
JUR = _fixture("jurisdictions.json")


def stub_evaluate(rules, address_row, jurisdiction: contracts.Jurisdiction, as_of):
    """Minimal engine: state + city stacking, status and effective date only."""
    out = []
    for r in rules:
        if r["jurisdiction"] not in (jurisdiction["state"], jurisdiction["jurisdiction"]):
            continue
        if r["status"] == "failed":
            continue
        if r["status"] == "pending":
            result = "pending"
        elif r.get("effective_date") and r["effective_date"] > as_of:
            result = "not_yet_effective"
        else:
            result = "applies"
        out.append({"team_rule_id": r["team_rule_id"], "result": result, "explanation": "stub",
                    "conflict_flag": bool(r.get("conflict_flag"))})
    return out


@pytest.fixture(scope="module")
def result():
    return changes.run_tests(stub_evaluate, RULES, JUR)


def ids_where(**kw):
    return sorted(a for a, j in JUR.items() if all(j[k] == v for k, v in kw.items()))


def test_matching_picks_expected_fixture_rules():
    expected = {
        "CA-ALG-01": "fx-ca-alg", "HOB-ALG-01": "fx-hob-alg", "JC-ALG-01": "fx-jc-alg",
        "NJ-ALG-01": "fx-nj-fair", "MA-ALG-P1": "fx-ma-alg-s2983", "MA-ALG-P2": "fx-ma-alg-h5222",
        "MA-RENT-P1": "fx-ma-rent-ballot",
    }
    got = changes.match_rules(list(expected), RULES)
    assert {k: v["team_rule_id"] for k, v in got.items()} == expected


def test_matching_is_robust_to_llm_ids_and_order():
    renamed = [dict(r, team_rule_id=f"r-{i:04d}") for i, r in enumerate(reversed(RULES))]
    got = changes.match_rules(["MA-ALG-P1", "MA-ALG-P2"], renamed)
    assert got["MA-ALG-P1"]["citation"] == "Mass. S.2983 (194th)"
    assert got["MA-ALG-P2"]["citation"] == "Mass. H.5222 (194th)"


def test_no_candidate_gives_none():
    ca_only = [r for r in RULES if r["jurisdiction"] == "CA"]
    assert changes.match_rules(["HOB-ALG-01"], ca_only) == {"HOB-ALG-01": None}


def test_t1_every_ca_address_flips(result):
    assert result["T1"]["affected_address_ids"] == ids_where(state="CA")
    assert "fx-ca-alg" in result["T1"]["notes"]


def test_t2_local_bans_only_in_their_cities(result):
    affected = result["T2"]["affected_address_ids"]
    assert affected == sorted(ids_where(jurisdiction="Hoboken, NJ") + ids_where(jurisdiction="Jersey City, NJ"))
    assert not set(affected) & set(ids_where(jurisdiction="Newark, NJ"))


def test_t3_all_nj_flip_with_conflicts_on_local_bans(result):
    assert result["T3"]["affected_address_ids"] == ids_where(state="NJ")
    assert result["T3"]["conflict_flag_address_ids"] == sorted(
        ids_where(jurisdiction="Hoboken, NJ") + ids_where(jurisdiction="Jersey City, NJ"))
    assert "A0003" not in result["T3"]["conflict_flag_address_ids"]  # Newark has no local ban


def test_t4_pending_bills_reach_all_ma(result):
    assert result["T4"]["affected_address_ids"] == ids_where(state="MA")
    assert result["T4"]["conflict_flag_address_ids"] == []


def test_t5_struck_measure_is_empty(result):
    assert result["T5"]["affected_address_ids"] == []
    assert "failed" in result["T5"]["notes"]


def test_t5_empty_when_no_rule_extracted():
    rules = [r for r in RULES if r["team_rule_id"] != "fx-ma-rent-ballot"]
    out = changes.run_tests(stub_evaluate, rules, JUR)
    assert out["T5"]["affected_address_ids"] == []
    assert "no rule extracted" in out["T5"]["notes"]


def test_t2_leak_outside_city_is_excluded_and_reported():
    def leaky(rules, row, j, as_of):
        items = stub_evaluate(rules, row, j, as_of)
        if j["jurisdiction"] == "Newark, NJ":
            items.append({"team_rule_id": "fx-hob-alg", "result": "applies", "explanation": "x",
                          "conflict_flag": False})
        return items
    out = changes.run_tests(leaky, RULES, JUR)
    assert "A0003" not in out["T2"]["affected_address_ids"]
    assert "WARNING" in out["T2"]["notes"]


def test_output_matches_template_and_validator(result):
    template = json.loads((paths.DATA / "submission_templates" / "changes.json").read_text())
    tests = [t["test_id"] for t in json.loads(paths.CHANGE_TESTS.read_text())]
    assert list(result) == tests
    for entry in result.values():
        assert set(entry) == {"affected_address_ids", "conflict_flag_address_ids", "notes"}
        assert set(entry) >= set().union(*map(set, template.values()))
        assert isinstance(entry["notes"], str) and entry["notes"]
    assert validate.check_changes(result) == []


def test_cli_without_engine_fails_clearly(monkeypatch, capsys, tmp_path):
    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "realrent.engine":
            raise ImportError("No module named 'realrent.engine'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    out = tmp_path / "changes.json"
    assert changes.main(["--out", str(out)]) == 2
    assert "realrent.engine" in capsys.readouterr().err
    assert not out.exists()


BAR_40P = {
    "team_rule_id": "r-D048-01", "jurisdiction": "MA", "level": "state",
    "category": "rent_increase_limits", "status": "in_force",
    "title": "Statewide bar on local rent control",
    "requirement": "Cities and towns may not adopt rent control.",
    "citation": "M.G.L. c. 40P, § 4", "source_doc_id": "D048",
    "source_url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40P/Section4",
    "quoted_span": "placeholder quote for a test-only rule", "effective_date": "1994-12-31",
}


def _tag_bar(rule_id):
    def ev(rules, row, j, as_of):
        items = stub_evaluate(rules, row, j, as_of)
        for i in items:
            if i["team_rule_id"] == rule_id:
                i["reason"] = "bars_local_rent_control"
        return items
    return ev


def test_40p_bar_is_never_matched_as_the_struck_rent_cap():
    assert changes.is_rent_control_bar(BAR_40P)
    without_ballot = [BAR_40P] + [r for r in RULES if r["team_rule_id"] != "fx-ma-rent-ballot"]
    assert changes.match_rules(["MA-RENT-P1"], without_ballot) == {"MA-RENT-P1": None}
    got = changes.match_rules(["MA-RENT-P1"], [BAR_40P] + RULES)["MA-RENT-P1"]
    assert got["team_rule_id"] == "fx-ma-rent-ballot"


@pytest.mark.parametrize("drop_ballot", [False, True])
def test_t5_stays_empty_when_40p_bar_applies(drop_ballot):
    rules = [BAR_40P] + [r for r in RULES
                         if not (drop_ballot and r["team_rule_id"] == "fx-ma-rent-ballot")]
    out = changes.run_tests(_tag_bar("r-D048-01"), rules, JUR)
    notes = out["T5"]["notes"]
    assert out["T5"]["affected_address_ids"] == []
    assert "Rent caps applying to MA addresses at 2026-10-01: 0 of 3" in notes
    assert "r-D048-01" in notes and "not a rent cap" in notes


def test_t5_excludes_bar_reason_even_without_40p_citation():
    bar = dict(BAR_40P, team_rule_id="r-bar", citation="Rent Control Prohibition Act")
    out = changes.run_tests(_tag_bar("r-bar"), [bar] + RULES, JUR)
    assert out["T5"]["affected_address_ids"] == []
    assert ": 0 of 3" in out["T5"]["notes"]
