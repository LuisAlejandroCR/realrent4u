# contracts.py: shared data shapes between workstreams (resolve, engine, changes, explain, web).
# Frozen once merged: change a shape only in its own PR, updating every consumer in the same PR.

from typing import Callable, Literal, TypedDict

Result = Literal["applies", "unknown", "superseded", "not_yet_effective", "pending"]


class Jurisdiction(TypedDict):
    """One entry of derived/jurisdictions.json, keyed by address_id (written by realrent.resolve)."""

    state: str  # "CA" | "NJ" | "MA"
    county: str | None  # e.g. "Suffolk County"
    place: str | None  # Census incorporated place name, e.g. "Boston"
    jurisdiction: str | None  # in-scope city as "City, ST"; None if unresolved or outside the 10 cities
    match: Literal["exact", "fallback", "none"]  # Census hit, postal-city fallback, or nothing
    source: str  # "census" | "postal_map" | "fixture"


class LookupItem(TypedDict, total=False):
    """One element of lookups.json[address_id] (written by realrent.lookups via engine.evaluate)."""

    team_rule_id: str
    result: Result
    explanation: str  # plain language, cites the rule; never legal advice
    conflict_flag: bool
    reason: str | None  # machine-readable reason for unknown/superseded, e.g. "missing_year_built"


# engine.evaluate(rules, address_row, jurisdiction, as_of) -> items for one address.
# Rules that do not apply are omitted. address_row is a dict row of data/data/sample_addresses.csv.
Evaluate = Callable[[list[dict], dict, Jurisdiction, str], list[LookupItem]]
