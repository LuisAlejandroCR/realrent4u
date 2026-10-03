# test_engine.py: engine.evaluate against the fixtures (T1-T5, SF precedence, unknown policy).
# No network, no model: rules and jurisdictions come from tests/fixtures/ or are defined inline.

import copy
import json

import pytest

from realrent import corpus, engine, lookups, paths

FX_RULES = json.loads((paths.FIXTURES / "rules.json").read_text())["rules"]
FX_JUR = {k: v for k, v in json.loads((paths.FIXTURES / "jurisdictions.json").read_text()).items()
          if not k.startswith("_")}
ROWS = {r["address_id"]: r for r in corpus.addresses()}
DEFAULT = paths.DEFAULT_AS_OF


def run(aid, as_of=DEFAULT, rules=None, row=None, jur="fixture"):
    row = row or ROWS[aid]
    j = FX_JUR.get(aid) if jur == "fixture" else jur
    items = engine.evaluate(rules if rules is not None else FX_RULES, row, j, as_of)
    return {i["team_rule_id"]: i for i in items}


def result(items, rid):
    return items[rid]["result"] if rid in items else None


def jur(city, state):
    return {"state": state, "county": None, "place": city, "jurisdiction": f"{city}, {state}",
            "match": "exact", "source": "test"}


def sf_row(year, units="21"):
    return {**ROWS["A0016"], "year_built": str(year) if year else "", "units": units}


# ---- A5: precedence


def test_sf_1926_ordinance_applies_and_state_cap_superseded():
    items = run("A0016")
    assert ROWS["A0016"]["year_built"] == "1926"
    assert result(items, "fx-sf-rent-ord") == "applies"
    assert result(items, "fx-ca-rent-cap") == "superseded"
    assert items["fx-ca-rent-cap"]["reason"] == "superseded_by:fx-sf-rent-ord"
    assert "S.F. Admin. Code ch. 37" in items["fx-ca-rent-cap"]["explanation"]


def test_sf_building_outside_ordinance_coverage_keeps_state_rule():
    items = run("A0016", row=sf_row(1995))
    assert "fx-sf-rent-ord" not in items  # built after the 1979 cutoff: out of coverage
    assert result(items, "fx-ca-rent-cap") == "applies"


def test_local_not_yet_effective_does_not_supersede():
    items = run("A0016", as_of="2025-12-31")
    assert result(items, "fx-sf-rent-ord") == "not_yet_effective"
    assert result(items, "fx-ca-rent-cap") == "applies"


def test_local_unknown_makes_state_unknown_not_superseded():
    items = run("A0016", row=sf_row(1979))
    assert result(items, "fx-sf-rent-ord") == "unknown"
    assert items["fx-sf-rent-ord"]["reason"] == "cutoff_year_ambiguous"
    assert result(items, "fx-ca-rent-cap") == "unknown"
    assert items["fx-ca-rent-cap"]["reason"] == "possibly_superseded_by:fx-sf-rent-ord"


def test_overrides_by_citation_supersede():
    rules = copy.deepcopy(FX_RULES)
    sf = next(r for r in rules if r["team_rule_id"] == "fx-sf-rent-ord")
    sf["overrides"] = ["Civil Code Section 1947.12"]
    sf["coverage_conditions"]["displaces_state_rule"] = False
    assert result(run("A0016", rules=rules), "fx-ca-rent-cap") == "superseded"


# ---- A6: missing facts -> unknown with a reason; never guess


def test_sf_1979_is_unknown_cutoff_year():
    assert result(run("A0016", row=sf_row(1979)), "fx-sf-rent-ord") == "unknown"
    assert result(run("A0016", row=sf_row(1978)), "fx-sf-rent-ord") == "applies"
    assert "fx-sf-rent-ord" not in run("A0016", row=sf_row(1980))


def test_la_1978_certificate_of_occupancy_cutoff_is_unknown():
    rso = {**FX_RULES[1], "team_rule_id": "t-la-rso", "jurisdiction": "Los Angeles, CA",
           "overrides": [], "coverage_conditions": {
               "built_cutoff_date": "1978-10-01", "built_cutoff_basis": "certificate_of_occupancy",
               "built_cutoff_direction": "on_or_before", "min_units": 2}}
    row = {**ROWS["A0001"], "year_built": "1978"}
    items = run("A0001", rules=[rso], row=row)
    assert items["t-la-rso"]["result"] == "unknown"
    assert items["t-la-rso"]["reason"] == "cutoff_year_ambiguous"


def test_san_diego_without_year_is_unknown():
    for aid in ("A0019", "A0322"):  # San Diego and San Ysidro (-> San Diego)
        items = run(aid)
        assert result(items, "fx-ca-rent-cap") == "unknown"
        assert items["fx-ca-rent-cap"]["reason"] == "missing_year_built"
        assert "Not legal advice" in items["fx-ca-rent-cap"]["explanation"]


def test_berkeley_without_year_or_units_is_unknown():
    rule = {**FX_RULES[1], "team_rule_id": "t-berk", "jurisdiction": "Berkeley, CA", "overrides": [],
            "coverage_conditions": {"built_cutoff_date": "1980-02-01",
                                    "built_cutoff_basis": "certificate_of_occupancy",
                                    "built_cutoff_direction": "on_or_before", "min_units": 6}}
    row = {**ROWS["A0005"], "use_description": ""}
    items = run("A0005", rules=FX_RULES + [rule], row=row)
    assert items["t-berk"]["result"] == "unknown"
    assert set(items["t-berk"]["reason"].split(",")) == {"missing_year_built", "missing_units"}
    assert result(items, "fx-ca-rent-cap") == "unknown"


def test_known_units_below_minimum_is_omitted():
    rule = {**FX_RULES[2], "team_rule_id": "t-min", "coverage_conditions": {"min_units": 50}}
    assert run("A0016", rules=[rule]) == {}


def test_small_owner_exemption_unresolved_unless_building_is_large():
    items = run("A0002")  # Hoboken, no units: owner-occupied exemption cannot be ruled out
    assert items["fx-nj-deposit"]["result"] == "unknown"
    assert items["fx-nj-deposit"]["reason"] == "small_owner_exemption_unresolved"
    big = {**ROWS["A0002"], "units": "20"}
    assert run("A0002", row=big)["fx-nj-deposit"]["result"] == "applies"


def test_odd_types_do_not_crash():
    rule = {"team_rule_id": "t-odd", "jurisdiction": "California", "category": "security_deposits",
            "status": "In Force", "effective_date": "2020", "title": "x", "citation": "y",
            "coverage_conditions": {"min_units": "5+", "built_cutoff_date": None,
                                    "built_cutoff_basis": None, "exempts_small_owner_occupied": "no"}}
    assert run("A0016", rules=[rule, None, {"no": "id"}])["t-odd"]["result"] == "applies"


# ---- A4: jurisdiction


def test_unresolved_address_local_rule_is_unknown_and_state_rules_still_evaluate():
    aid = next(a for a, r in ROWS.items() if r["postal_city"] == "Hoboken" and a not in FX_JUR)
    items = run(aid, jur=None)
    assert items["fx-hob-alg"]["result"] == "unknown"
    assert items["fx-hob-alg"]["reason"] == "unresolved_address"
    assert result(items, "fx-nj-fair") == "not_yet_effective"
    assert "fx-jc-alg" not in items


def test_resolved_outside_scope_gets_no_local_rule():
    j = {"state": "NJ", "county": None, "place": "Union City", "jurisdiction": None,
         "match": "exact", "source": "test"}
    assert "fx-hob-alg" not in run("A0002", jur=j)


# ---- T1-T5


def test_t1_ab325_dates():
    for aid in ("A0001", "A0016", "A0019"):
        assert result(run(aid, "2025-12-31"), "fx-ca-alg") == "not_yet_effective"
        assert result(run(aid, "2026-01-02"), "fx-ca-alg") == "applies"


def test_t2_local_bans_only_inside_their_city():
    hob, jc, nwk = run("A0002"), run("A0008"), run("A0003")
    assert result(hob, "fx-hob-alg") == "applies" and "fx-jc-alg" not in hob
    assert result(jc, "fx-jc-alg") == "applies" and "fx-hob-alg" not in jc
    assert "fx-hob-alg" not in nwk and "fx-jc-alg" not in nwk


def test_t3_fair_act_dates_and_conflict_flags():
    for aid in ("A0002", "A0003", "A0008"):
        assert result(run(aid, "2026-10-01"), "fx-nj-fair") == "not_yet_effective"
        assert result(run(aid, "2027-07-02"), "fx-nj-fair") == "applies"
    for aid in ("A0002", "A0008"):
        for as_of in ("2026-10-01", "2027-07-02"):
            assert run(aid, as_of)["fx-nj-fair"]["conflict_flag"] is True
    assert run("A0003", "2027-07-02")["fx-nj-fair"]["conflict_flag"] is False


def test_t4_ma_bills_pending_never_in_force():
    for aid in ("A0006", "A0065", "A0009"):
        for as_of in paths.DEMO_DATES:
            items = run(aid, as_of)
            assert result(items, "fx-ma-alg-s2983") == "pending"
            assert result(items, "fx-ma-alg-h5222") == "pending"


def test_t5_failed_rules_absent_and_no_ma_rent_cap():
    for aid in ("A0006", "A0065", "A0009"):
        items = run(aid)
        assert "fx-ma-rent-ballot" not in items
        by_id = {r["team_rule_id"]: r for r in FX_RULES}
        assert not any(by_id[rid]["category"] == "rent_increase_limits" for rid in items)


D048_LIKE = {
    "team_rule_id": "t-d048-01", "jurisdiction": "MA", "level": "state",
    "category": "rent_increase_limits", "status": "in_force",
    "title": "Prohibition of rent control by cities and towns",
    "requirement": "No city or town may enact or enforce rent control on privately owned housing.",
    "key_value": None, "coverage_conditions": {"text": "Statewide", "min_units": 0,
                                               "built_cutoff_basis": "none"},
    "exemptions": None, "overrides": [], "effective_date": None,
    "citation": "M.G.L. c. 40P, § 4", "source_doc_id": "D048", "source_url": "https://example.org",
    "quoted_span": "placeholder placeholder", "conflict_flag": False, "conflict_note": None,
}


def test_rent_control_bar_is_not_presented_as_a_cap():
    for aid in ("A0006", "A0065", "A0009"):
        item = run(aid, rules=FX_RULES + [D048_LIKE])["t-d048-01"]
        assert item["result"] == "applies"
        assert item["reason"] == "bars_local_rent_control"
        text = item["explanation"].lower()
        assert "bars cities and towns from imposing rent control" in text
        assert "not a rent cap" in text
        for bad in ("capped", "cap of", "caps rent", "limit on rent increases applies",
                    "rent increases are limited"):
            assert bad not in text
    assert engine.is_rent_control_bar(D048_LIKE)
    assert not engine.is_rent_control_bar(FX_RULES[0])  # the CA cap is a real cap


# ---- invariants and lookups.py


@pytest.mark.parametrize("as_of", paths.DEMO_DATES)
def test_every_item_well_formed(as_of):
    for aid in list(ROWS)[:60] + list(FX_JUR):
        for item in engine.evaluate(FX_RULES, ROWS[aid], FX_JUR.get(aid), as_of):
            assert item["result"] in {"applies", "unknown", "superseded", "not_yet_effective",
                                      "pending"}
            assert isinstance(item["conflict_flag"], bool)
            assert as_of in item["explanation"] and "Not legal advice" in item["explanation"]
            if item["result"] in {"unknown", "superseded"}:
                assert item["reason"]


def test_lookups_build_covers_all_addresses():
    data = lookups.build(FX_RULES, FX_JUR, DEFAULT)
    assert data["as_of"] == DEFAULT
    assert set(data["lookups"]) == set(ROWS)
