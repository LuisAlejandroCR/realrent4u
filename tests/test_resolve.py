# test_resolve.py: Module B jurisdiction resolution, offline only (cached Census responses).
# Checks the postal traps (Dorchester, San Ysidro, bad ZIPs) and the contracts.Jurisdiction shape.

import json

import pytest

from realrent import corpus, paths, resolve
from realrent.contracts import Jurisdiction

CITIES = set(resolve.CITY_COUNTY)


@pytest.fixture(scope="module")
def resolved():
    return resolve.resolve(corpus.addresses(), offline=True)


@pytest.fixture(scope="module")
def rows():
    return {r["address_id"]: r for r in corpus.addresses()}


def test_in_scope_cities_come_from_manifest():
    assert resolve.in_scope_cities() == CITIES


def test_committed_file_matches_offline_rerun(resolved):
    committed = json.loads(paths.JURISDICTIONS_JSON.read_text(encoding="utf-8"))
    assert committed == resolved


def test_every_address_has_a_contract_shaped_entry(resolved, rows):
    assert set(resolved) == set(rows)
    for aid, j in resolved.items():
        assert set(j) == set(Jurisdiction.__annotations__)
        assert j["state"] == rows[aid]["state"]
        assert j["match"] in {"exact", "fallback", "none"}
        assert j["source"] in {"census", "postal_map", "none"}
        assert j["jurisdiction"] is None or j["jurisdiction"] in CITIES
        if j["jurisdiction"]:
            assert j["jurisdiction"].endswith(", " + j["state"])


def test_dorchester_is_boston(resolved, rows):
    dorchester = [a for a, r in rows.items() if r["postal_city"] == "Dorchester"]
    assert dorchester
    assert all(resolved[a]["jurisdiction"] == "Boston, MA" for a in dorchester)
    assert resolved["A0065"]["jurisdiction"] == "Boston, MA"


def test_all_boston_neighborhoods_are_boston(resolved, rows):
    for a, r in rows.items():
        if r["state"] == "MA" and r["postal_city"] != "Cambridge":
            assert resolved[a]["jurisdiction"] == "Boston, MA", a


def test_san_ysidro_is_san_diego(resolved, rows):
    assert rows["A0322"]["postal_city"] == "San Ysidro"
    assert resolved["A0322"]["jurisdiction"] == "San Diego, CA"
    assert resolved["A0322"]["county"] == "San Diego County"


@pytest.mark.parametrize("aid,city,county", [
    ("A0003", "Newark, NJ", "Essex County"),  # Brooklyn ZIP 11219
    ("A0008", "Jersey City, NJ", "Hudson County"),  # Texas ZIP 78746
])
def test_bad_zip_rows_resolve_to_their_real_city(resolved, aid, city, county):
    assert resolved[aid]["jurisdiction"] == city
    assert resolved[aid]["county"] == county
    assert resolved[aid]["state"] == "NJ"


def test_agrees_with_shared_fixture(resolved):
    fixture = json.loads((paths.FIXTURES / "jurisdictions.json").read_text(encoding="utf-8"))
    for aid, j in fixture.items():
        if aid.startswith("_"):
            continue
        assert resolved[aid]["jurisdiction"] == j["jurisdiction"], aid
        assert resolved[aid]["county"] == j["county"], aid


# ---- unit tests on synthetic Census output (no cache needed)

ROW = {"address_id": "X1", "street_address": "1 MAIN ST", "postal_city": "Dorchester", "state": "MA", "zip": "02124"}


def test_parse_batch_handles_match_and_no_match():
    raw = ('"X1","1 MAIN ST, Dorchester, MA, 02124","Match","Exact","1 MAIN ST, BOSTON, MA, 02124",'
           '"-71.06,42.30","1","L","25","025","000100","1000"\n'
           '"X2","2 MAIN ST, Dorchester, MA, ","No_Match"\n')
    hits = resolve.parse_batch(raw)
    assert hits["X1"]["coord"] == "-71.06,42.30" and hits["X1"]["state_fips"] == "25"
    assert hits["X2"]["status"] == "No_Match" and hits["X2"]["coord"] == ""


def test_match_in_another_state_is_not_trusted():
    hit = {"status": "Match", "quality": "Exact", "matched": "", "coord": "-73.9,40.6",
           "state_fips": "36", "county_fips": "047"}  # Brooklyn, NY
    row = {**ROW, "postal_city": "Newark", "state": "NJ"}
    assert not resolve.usable(hit, "NJ")
    j = resolve.resolve_row(row, hit, {"Incorporated Places": [{"BASENAME": "New York"}]}, CITIES)
    assert j["match"] == "fallback" and j["jurisdiction"] == "Newark, NJ"


def test_census_place_wins_over_postal_city():
    hit = {"status": "Match", "quality": "Exact", "matched": "", "coord": "-71.1,42.3",
           "state_fips": "25", "county_fips": "017"}
    geo = {"Incorporated Places": [{"BASENAME": "Cambridge"}], "Counties": [{"NAME": "Middlesex County"}]}
    j = resolve.resolve_row(ROW, hit, geo, CITIES)
    assert j == {"state": "MA", "county": "Middlesex County", "place": "Cambridge",
                 "jurisdiction": "Cambridge, MA", "match": "exact", "source": "census"}


def test_census_place_outside_scope_has_no_jurisdiction():
    hit = {"status": "Match", "quality": "Exact", "matched": "", "coord": "-71.1,42.3",
           "state_fips": "25", "county_fips": "021"}
    geo = {"Incorporated Places": [{"BASENAME": "Brookline"}], "Counties": [{"NAME": "Norfolk County"}]}
    j = resolve.resolve_row(ROW, hit, geo, CITIES)
    assert j["match"] == "exact" and j["place"] == "Brookline" and j["jurisdiction"] is None


def test_unknown_postal_city_without_census_is_none():
    row = {**ROW, "postal_city": "Somerville"}
    j = resolve.resolve_row(row, None, None, CITIES)
    assert j["match"] == "none" and j["jurisdiction"] is None


def test_clean_street_drops_leading_zero_ordinals():
    assert resolve.clean_street("397 05TH AV") == "397 5TH AV"
    assert resolve.clean_street("1845 08TH AV") == "1845 8TH AV"
    assert resolve.clean_street("100 10TH ST") == "100 10TH ST"
