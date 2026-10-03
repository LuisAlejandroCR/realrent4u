# resolve.py: Module B, legal jurisdiction per sample address (Census Geocoder + postal-city fallback).
# Batch-geocodes data/data/sample_addresses.csv, looks up the incorporated place of each hit, caches
# the raw Census responses in derived/census/ and writes derived/jurisdictions.json (contracts.Jurisdiction).

import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from realrent import corpus, paths
from realrent.contracts import Jurisdiction

CENSUS = "https://geocoding.geo.census.gov/geocoder"
BENCHMARK = "Public_AR_Current"
VINTAGE = "Current_Current"
CENSUS_DIR = paths.DERIVED / "census"
BATCH_CSV = CENSUS_DIR / "batch.csv"  # raw response, street + postal city + state + ZIP
BATCH_NOZIP_CSV = CENSUS_DIR / "batch_nozip.csv"  # raw response, retry of misses: no ZIP, cleaned street
PLACES_JSON = CENSUS_DIR / "places.json"  # "lon,lat" -> Incorporated Places + Counties layers

STATE_FIPS = {"06": "CA", "34": "NJ", "25": "MA"}

# County of each in-scope city, used when the postal-city fallback has no Census geography.
CITY_COUNTY = {
    "Los Angeles, CA": "Los Angeles County",
    "San Francisco, CA": "San Francisco County",
    "San Diego, CA": "San Diego County",
    "Berkeley, CA": "Alameda County",
    "Santa Ana, CA": "Orange County",
    "Jersey City, NJ": "Hudson County",
    "Hoboken, NJ": "Hudson County",
    "Newark, NJ": "Essex County",
    "Boston, MA": "Suffolk County",
    "Cambridge, MA": "Middlesex County",
}

# Postal names that are neighborhoods of an in-scope city, not municipalities of their own.
POSTAL_ALIASES = {
    ("MA", "DORCHESTER"): "Boston",
    ("MA", "ROXBURY"): "Boston",
    ("MA", "EAST BOSTON"): "Boston",
    ("MA", "SOUTH BOSTON"): "Boston",
    ("MA", "BRIGHTON"): "Boston",
    ("MA", "ALLSTON"): "Boston",
    ("MA", "JAMAICA PLAIN"): "Boston",
    ("MA", "HYDE PARK"): "Boston",
    ("MA", "MATTAPAN"): "Boston",
    ("MA", "ROSLINDALE"): "Boston",
    ("MA", "WEST ROXBURY"): "Boston",
    ("MA", "CHARLESTOWN"): "Boston",
    ("MA", "MISSION HILL"): "Boston",
    ("MA", "BACK BAY"): "Boston",
    ("CA", "SAN YSIDRO"): "San Diego",
    ("CA", "LA JOLLA"): "San Diego",
    ("CA", "HOLLYWOOD"): "Los Angeles",
    ("CA", "NORTH HOLLYWOOD"): "Los Angeles",
    ("CA", "VAN NUYS"): "Los Angeles",
    ("CA", "SAN PEDRO"): "Los Angeles",
    ("CA", "WILMINGTON"): "Los Angeles",
}


def in_scope_cities() -> set[str]:
    """The "City, ST" jurisdictions named in the corpus manifest (state-only entries excluded)."""
    with paths.MANIFEST.open(encoding="utf-8", newline="") as f:
        names = {j.strip() for r in csv.DictReader(f) for j in r["jurisdictions"].split(";")}
    return {n for n in names if ", " in n}


def city_for(place: str | None, state: str, cities: set[str]) -> str | None:
    if not place:
        return None
    name = f"{place}, {state}"
    return name if name in cities else None


def postal_city(row: dict, cities: set[str]) -> str | None:
    """In-scope city implied by the postal city (aliases for neighborhoods), or None."""
    pc = row["postal_city"].strip().upper()
    base = POSTAL_ALIASES.get((row["state"], pc), row["postal_city"].strip().title())
    return city_for(base, row["state"], cities)


# ---------------------------------------------------------------- Census calls


def _urlopen(req, timeout=300, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except OSError as e:  # URLError, HTTPError, timeouts
            if i == tries - 1:
                raise
            wait = 2 ** (i + 1)
            print(f"census: {e}; retry in {wait}s", file=sys.stderr)
            time.sleep(wait)


_ZERO_ORDINAL = re.compile(r"\b0+(\d+(?:ST|ND|RD|TH))\b", re.IGNORECASE)


def clean_street(street: str) -> str:
    """Retry-only cleanup: SF parcel data writes "05TH AV", which Census does not match."""
    return _ZERO_ORDINAL.sub(r"\1", street)


def batch_request(rows: list[dict], retry: bool = False) -> str:
    """POST one batch (<= 10,000 rows) to the geographies/addressbatch endpoint; returns raw CSV.
    retry=True drops the ZIP (postal ZIPs may be wrong) and cleans the street."""
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in rows:
        street = clean_street(r["street_address"]) if retry else r["street_address"]
        w.writerow([r["address_id"], street, r["postal_city"], r["state"], "" if retry else r["zip"]])
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in (("benchmark", BENCHMARK), ("vintage", VINTAGE)):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n')
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="addressFile"; '
                 f'filename="addresses.csv"\r\nContent-Type: text/csv\r\n\r\n{buf.getvalue()}\r\n')
    parts.append(f"--{boundary}--\r\n")
    req = urllib.request.Request(
        f"{CENSUS}/geographies/addressbatch",
        data="".join(parts).encode("utf-8"),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    return _urlopen(req).decode("utf-8")


def place_request(coord: str) -> dict:
    """Incorporated place and county containing a "lon,lat" point (trimmed Census JSON)."""
    lon, lat = coord.split(",")
    q = urllib.parse.urlencode({
        "x": lon, "y": lat, "benchmark": BENCHMARK, "vintage": VINTAGE,
        "layers": "Incorporated Places,Counties", "format": "json",
    })
    data = json.loads(_urlopen(f"{CENSUS}/geographies/coordinates?{q}", timeout=60))
    geo = data["result"]["geographies"]
    keep = ("NAME", "BASENAME", "GEOID", "STATE", "LSADC", "FUNCSTAT")
    return {layer: [{k: g.get(k) for k in keep} for g in geo.get(layer, [])]
            for layer in ("Incorporated Places", "Counties")}


# ---------------------------------------------------------------- parsing and resolution


def parse_batch(raw: str) -> dict[str, dict]:
    """Census batch CSV -> {address_id: {status, quality, matched, coord, state_fips, county_fips}}."""
    out = {}
    for rec in csv.reader(io.StringIO(raw)):
        if not rec:
            continue
        rec += [""] * (12 - len(rec))
        out[rec[0]] = {
            "status": rec[2], "quality": rec[3], "matched": rec[4], "coord": rec[5],
            "state_fips": rec[8], "county_fips": rec[9],
        }
    return out


def usable(hit: dict | None, state: str) -> bool:
    """A Census match counts only if it is a match and lands in the row's own state."""
    return bool(hit and hit["status"] == "Match" and STATE_FIPS.get(hit["state_fips"]) == state)


def resolve_row(row: dict, hit: dict | None, geo: dict | None, cities: set[str]) -> Jurisdiction:
    state = row["state"]
    if usable(hit, state) and geo is not None:
        places = geo.get("Incorporated Places") or []
        counties = geo.get("Counties") or []
        place = places[0]["BASENAME"] if places else None
        county = counties[0]["NAME"] if counties else None
        return Jurisdiction(state=state, county=county, place=place,
                            jurisdiction=city_for(place, state, cities), match="exact", source="census")
    city = postal_city(row, cities)
    if city:
        return Jurisdiction(state=state, county=CITY_COUNTY.get(city), place=city.split(", ")[0],
                            jurisdiction=city, match="fallback", source="postal_map")
    return Jurisdiction(state=state, county=None, place=None, jurisdiction=None,
                        match="none", source="none")


def resolve(rows: list[dict], offline: bool = False, workers: int = 8) -> dict[str, Jurisdiction]:
    cities = in_scope_cities()
    CENSUS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Batch with ZIP.
    if offline:
        raw = BATCH_CSV.read_text(encoding="utf-8")
    else:
        raw = batch_request(rows)
        BATCH_CSV.write_text(raw, encoding="utf-8")
    hits = parse_batch(raw)

    # 2. Retry misses (no match, or match in another state) without the ZIP and with a cleaned street.
    misses = [r for r in rows if not usable(hits.get(r["address_id"]), r["state"])]
    if offline:
        raw2 = BATCH_NOZIP_CSV.read_text(encoding="utf-8") if BATCH_NOZIP_CSV.exists() else ""
    else:
        raw2 = batch_request(misses, retry=True) if misses else ""
        BATCH_NOZIP_CSV.write_text(raw2, encoding="utf-8")
    state_of = {r["address_id"]: r["state"] for r in rows}
    for aid, hit in parse_batch(raw2).items():
        if usable(hit, state_of.get(aid, "")):
            hits[aid] = hit

    # 3. Incorporated place for every usable hit.
    coords = sorted({hits[r["address_id"]]["coord"] for r in rows if usable(hits.get(r["address_id"]), r["state"])})
    places = json.loads(PLACES_JSON.read_text(encoding="utf-8")) if PLACES_JSON.exists() else {}
    if not offline:
        todo = [c for c in coords if c not in places]
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for c, g in zip(todo, ex.map(place_request, todo)):
                places[c] = g
        places = {c: places[c] for c in coords}
        PLACES_JSON.write_text(json.dumps(places, indent=1, sort_keys=True) + "\n", encoding="utf-8")

    out = {}
    for r in rows:
        hit = hits.get(r["address_id"])
        geo = places.get(hit["coord"]) if hit else None
        out[r["address_id"]] = resolve_row(r, hit, geo, cities)
    return out


def stats(result: dict[str, Jurisdiction]) -> str:
    by_match = Counter(j["match"] for j in result.values())
    by_city = Counter(j["jurisdiction"] or "(none)" for j in result.values())
    lines = ["match: " + ", ".join(f"{k}={by_match.get(k, 0)}" for k in ("exact", "fallback", "none"))]
    lines += [f"  {c}: {n}" for c, n in sorted(by_city.items())]
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offline", action="store_true", help="reuse the cached Census responses in derived/census/")
    ap.add_argument("--out", type=Path, default=paths.JURISDICTIONS_JSON)
    args = ap.parse_args(argv)
    result = resolve(corpus.addresses(), offline=args.offline)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({len(result)} addresses)")
    print(stats(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
