# changes.py: Module C — runs the five change tests (T1–T5) through an injected engine.evaluate
# and writes submission/changes.json. Run `python -m realrent.changes` (see main() for options).

import argparse
import json
import re
import sys
from pathlib import Path

from realrent import contracts, corpus, paths

# How each organizer rule id in data/dev/change_tests.json maps onto our (LLM-generated) rules.
# jurisdiction + category are hard filters; status, hints and doc ids only rank the candidates.
SPECS: dict[str, dict] = {
    "CA-ALG-01": {
        "jurisdiction": "CA", "category": "algorithmic_rent_setting",
        "status": ["in_force", "not_yet_effective"],
        "hints": ["AB 325", "AB325", "SB 763", "SB763", "Cartwright", "16729", "pricing algorithm"],
        "doc_ids": ["D022", "D028"],
    },
    "HOB-ALG-01": {
        "jurisdiction": "Hoboken, NJ", "category": "algorithmic_rent_setting",
        "status": ["in_force"],
        "hints": ["Hoboken", "algorithm", "software"],
        "doc_ids": ["D032", "D033", "D034"],
    },
    "JC-ALG-01": {
        "jurisdiction": "Jersey City, NJ", "category": "algorithmic_rent_setting",
        "status": ["in_force"],
        "hints": ["Jersey City", "algorithm", "RealPage", "software"],
        "doc_ids": ["D035", "D037"],
    },
    "NJ-ALG-01": {
        "jurisdiction": "NJ", "category": "algorithmic_rent_setting",
        "status": ["not_yet_effective", "in_force"],
        "hints": ["FAIR", "P.L. 2026", "P.L.2026", "c.43", "c.043", "c. 43", "AL26"],
        "doc_ids": ["D069", "D060"],
    },
    "MA-ALG-P1": {
        "jurisdiction": "MA", "category": "algorithmic_rent_setting",
        "status": ["pending"],
        "hints": ["S.2983", "S2983", "S. 2983", "2983"],
        "doc_ids": ["D046", "D047"],
    },
    "MA-ALG-P2": {
        "jurisdiction": "MA", "category": "algorithmic_rent_setting",
        "status": ["pending"],
        "hints": ["H.5222", "H5222", "H. 5222", "5222"],
        "doc_ids": ["D045"],
    },
    "MA-RENT-P1": {
        "jurisdiction": "MA", "category": "rent_increase_limits",
        "status": ["failed"],
        "hints": ["IP 25-21", "25-21", "ballot", "rent control", "struck"],
        "doc_ids": ["D059", "D055"],
        "exclude": "bar",  # G.L. c. 40P bars local rent control; it is not the struck rent cap
    },
}

BAR_REASON = "bars_local_rent_control"


def is_rent_control_bar(rule: dict) -> bool:
    """True for the MA statewide bar on local rent control (G.L. c. 40P), never a rent cap."""
    return "40p" in _norm(rule.get("citation")).replace(" ", "")

FLIP = ("not_yet_effective", "applies")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _haystack(rule: dict) -> str:
    keys = ("team_rule_id", "title", "citation", "source_url", "requirement", "interaction")
    return _norm(" ".join(str(rule.get(k) or "") for k in keys))


def score(rule: dict, spec: dict) -> float | None:
    """Score a rule against a spec; None when jurisdiction or category don't match."""
    if _norm(rule.get("jurisdiction")) != _norm(spec["jurisdiction"]):
        return None
    if rule.get("category") != spec["category"]:
        return None
    if spec.get("exclude") == "bar" and is_rent_control_bar(rule):
        return None
    s = 1.0
    status = rule.get("status")
    if status in spec["status"]:
        s += 3.0 - spec["status"].index(status) * 0.5
    elif status == "failed":
        s -= 5.0  # a failed rule never stands in for an enacted or pending one
    hay = _haystack(rule)
    s += 2.0 * sum(1 for h in spec["hints"] if _norm(h) in hay)
    if rule.get("source_doc_id") in spec["doc_ids"]:
        s += 4.0
    return s


def match_rules(rule_ids: list[str], rules: list[dict]) -> dict[str, dict | None]:
    """Best rule per organizer id; ids in the same test prefer distinct rules."""
    matched: dict[str, dict | None] = {}
    taken: set[str] = set()
    for rid in rule_ids:
        spec = SPECS.get(rid)
        if spec is None:
            matched[rid] = None
            continue
        ranked = sorted(
            ((sc, r) for r in rules if (sc := score(r, spec)) is not None),
            key=lambda x: (-x[0], x[1].get("team_rule_id", "")),
        )
        fresh = [r for _, r in ranked if r.get("team_rule_id") not in taken]
        best = fresh[0] if fresh else (ranked[0][1] if ranked else None)
        matched[rid] = best
        if best is not None:
            taken.add(best["team_rule_id"])
    return matched


class Runner:
    """Calls evaluate once per (address, as_of) and caches the result items by rule id."""

    def __init__(self, evaluate: contracts.Evaluate, rules: list[dict], addresses: list[dict],
                 jurisdictions: dict[str, contracts.Jurisdiction]):
        self.evaluate = evaluate
        self.rules = rules
        self.addresses = [a for a in addresses if a["address_id"] in jurisdictions]
        self.jurisdictions = jurisdictions
        self.skipped = len(addresses) - len(self.addresses)
        self._cache: dict[str, dict[str, dict[str, dict]]] = {}

    def at(self, as_of: str) -> dict[str, dict[str, dict]]:
        if as_of not in self._cache:
            out = {}
            for a in self.addresses:
                aid = a["address_id"]
                items = self.evaluate(self.rules, a, self.jurisdictions[aid], as_of)
                out[aid] = {i["team_rule_id"]: i for i in items}
            self._cache[as_of] = out
        return self._cache[as_of]

    def result(self, aid: str, rule_id: str, as_of: str) -> str | None:
        item = self.at(as_of).get(aid, {}).get(rule_id)
        return item.get("result") if item else None

    def flagged(self, aid: str, rule_id: str, as_of: str) -> bool:
        item = self.at(as_of).get(aid, {}).get(rule_id)
        return bool(item and item.get("conflict_flag"))

    def city(self, aid: str) -> str | None:
        return self.jurisdictions[aid].get("jurisdiction")

    def state(self, aid: str) -> str | None:
        return self.jurisdictions[aid].get("state")


def _describe(matched: dict[str, dict | None]) -> str:
    parts = []
    for rid, r in matched.items():
        if r is None:
            parts.append(f"{rid} -> no matching rule")
        else:
            parts.append(f"{rid} -> {r['team_rule_id']} ({r.get('citation')}; status {r.get('status')}; "
                         f"source {r.get('source_doc_id')})")
    return "Matched: " + "; ".join(parts) + "."


def _flip_ids(run: Runner, rule: dict, before: str, after: str, state: str | None) -> list[str]:
    rid = rule["team_rule_id"]
    return sorted(
        aid for aid in run.at(after)
        if (state is None or run.state(aid) == state)
        and (run.result(aid, rid, before), run.result(aid, rid, after)) == FLIP
    )


def _t_as_of(test: dict, matched: dict, run: Runner, all_rules: list[dict]) -> dict:
    """T1/T3: addresses whose result flips not_yet_effective -> applies; conflict flags."""
    before, after = test["as_of_before"], test["as_of_after"]
    state = (test.get("states") or [None])[0]
    affected: set[str] = set()
    flags: set[str] = set()
    engine_flags: set[str] = set()
    notes = [_describe(matched)]
    for rule in (r for r in matched.values() if r):
        ids = _flip_ids(run, rule, before, after, state)
        affected.update(ids)
        rid = rule["team_rule_id"]
        engine_flags.update(a for a in ids if run.flagged(a, rid, before) or run.flagged(a, rid, after))
    in_state = [a for a in run.at(after) if state is None or run.state(a) == state]
    notes.append(f"{len(affected)} of {len(in_state)} resolved {state or ''} addresses flip "
                 f"not_yet_effective ({before}) -> applies ({after}).".replace("  ", " "))
    conflicts = test.get("conflict_with") or []
    if conflicts:
        cmatched = match_rules(conflicts, all_rules)
        notes.append("Conflict check against " + _describe(cmatched)[len("Matched: "):])
        for r in (r for r in cmatched.values() if r):
            crid = r["team_rule_id"]
            flags.update(a for a in affected
                         if run.result(a, crid, before) or run.result(a, crid, after))
        notes.append(f"{len(flags)} addresses carry a conflict flag (state law vs local ordinance, "
                     "possible preemption; flagged for human review, not resolved).")
        if engine_flags - flags:
            notes.append(f"The engine also flagged {len(engine_flags - flags)} addresses without a "
                         "conflicting local rule; those are not counted.")
    else:
        flags = engine_flags
    if not any(matched.values()):
        notes.append("No matching rule extracted, so no address can be reported.")
    return {"affected_address_ids": sorted(affected), "conflict_flag_address_ids": sorted(flags),
            "notes": " ".join(notes)}


CITY_OF = {"HOB-ALG-01": "Hoboken, NJ", "JC-ALG-01": "Jersey City, NJ"}


def _t_boundary(test: dict, matched: dict, run: Runner) -> dict:
    """T2: addresses where each local ban appears; any appearance outside its city is reported."""
    as_of = test["as_of"]
    affected: set[str] = set()
    flags: set[str] = set()
    notes = [_describe(matched)]
    for oid, rule in matched.items():
        if rule is None:
            continue
        rid = rule["team_rule_id"]
        city = CITY_OF.get(oid, rule.get("jurisdiction"))
        hits = [a for a in run.at(as_of) if run.result(a, rid, as_of)]
        inside = [a for a in hits if run.city(a) == city]
        outside = sorted(set(hits) - set(inside))
        affected.update(inside)
        flags.update(a for a in inside if run.flagged(a, rid, as_of))
        results = sorted({run.result(a, rid, as_of) for a in inside})
        notes.append(f"{oid}: {len(inside)} {city} addresses ({', '.join(results) or 'none'}).")
        if outside:
            notes.append(f"WARNING {oid} also returned for {len(outside)} addresses outside {city} "
                         f"(excluded): {outside[:5]}.")
    newark = [a for a in run.at(as_of) if run.city(a) == "Newark, NJ"]
    notes.append(f"Newark: {len(newark)} resolved addresses, {len(set(newark) & affected)} affected.")
    return {"affected_address_ids": sorted(affected), "conflict_flag_address_ids": sorted(flags),
            "notes": " ".join(notes)}


def _t_pending(test: dict, matched: dict, run: Runner) -> dict:
    """T4: addresses the pending bills would reach (result 'pending' at as_of)."""
    as_of = test["as_of"]
    state = (test.get("states") or [None])[0]
    affected: set[str] = set()
    notes = [_describe(matched)]
    for oid, rule in matched.items():
        if rule is None:
            continue
        rid = rule["team_rule_id"]
        ids = [a for a in run.at(as_of)
               if (state is None or run.state(a) == state) and run.result(a, rid, as_of) == "pending"]
        affected.update(ids)
        wrong = [a for a in run.at(as_of) if run.result(a, rid, as_of) not in (None, "pending")]
        notes.append(f"{oid}: pending (not in force) for {len(ids)} addresses.")
        if wrong:
            notes.append(f"WARNING {oid} reported as something other than pending for {len(wrong)} addresses.")
    notes.append("Affected set = addresses these bills would reach if enacted; nothing is in force.")
    return {"affected_address_ids": sorted(affected), "conflict_flag_address_ids": [],
            "notes": " ".join(notes)}


def _applies_as_cap(run: "Runner", aid: str, rule_id: str, as_of: str) -> bool:
    """An 'applies' item that is not the statewide bar on local rent control."""
    item = run.at(as_of).get(aid, {}).get(rule_id)
    return bool(item and item.get("result") == "applies" and item.get("reason") != BAR_REASON)


def _t_negative(test: dict, matched: dict, run: Runner, all_rules: list[dict]) -> dict:
    """T5: struck measure; affected only if the engine wrongly applies it (expected empty)."""
    as_of = test["as_of"]
    state = (test.get("states") or [None])[0]
    affected: set[str] = set()
    notes = [_describe(matched)]
    for oid, rule in matched.items():
        if rule is None:
            notes.append(f"{oid}: no rule extracted for the struck measure, so nothing is in force.")
            continue
        rid = rule["team_rule_id"]
        affected.update(a for a in run.at(as_of) if _applies_as_cap(run, a, rid, as_of))
        if rule.get("status") == "failed":
            notes.append(f"{oid}: recorded as failed ({rule.get('citation')}); failed rules never apply.")
        else:
            notes.append(f"WARNING {oid}: matched rule has status {rule.get('status')!r}, expected 'failed'.")
    in_scope = [r for r in all_rules
                if r.get("category") == "rent_increase_limits" and state
                and (r.get("jurisdiction") == state or str(r.get("jurisdiction", "")).endswith(f", {state}"))]
    bars = [r for r in in_scope if is_rent_control_bar(r)]
    caps = {r["team_rule_id"] for r in in_scope if not is_rent_control_bar(r)}
    leaking = sorted(a for a in run.at(as_of)
                     if any(_applies_as_cap(run, a, c, as_of) for c in caps))
    in_state = [a for a in run.at(as_of) if run.state(a) == state]
    notes.append(f"Rent caps applying to {state} addresses at {as_of}: {len(leaking)} of {len(in_state)}"
                 f"{' ' + str(leaking[:5]) if leaking else ''}. Affected set is empty when the measure "
                 "was struck.")
    for b in bars:
        n = sum(1 for a in in_state if run.result(a, b["team_rule_id"], as_of) == "applies")
        notes.append(f"Supporting evidence: {b['team_rule_id']} ({b.get('citation')}) bars local rent "
                     f"control statewide and applies to {n} {state} addresses; it is not a rent cap.")
    return {"affected_address_ids": sorted(affected), "conflict_flag_address_ids": [],
            "notes": " ".join(notes)}


def run_tests(evaluate: contracts.Evaluate, rules: list[dict], jurisdictions: dict,
              addresses: list[dict] | None = None, tests: list[dict] | None = None) -> dict:
    """Build the changes.json object: {test_id: {affected_address_ids, conflict_flag_address_ids, notes}}."""
    if addresses is None:
        addresses = corpus.addresses()
    if tests is None:
        tests = json.loads(paths.CHANGE_TESTS.read_text(encoding="utf-8"))
    jurisdictions = {k: v for k, v in jurisdictions.items() if not k.startswith("_")}
    run = Runner(evaluate, rules, addresses, jurisdictions)
    out = {}
    for test in tests:
        matched = match_rules(test["rule_ids"], rules)
        kind = test.get("type")
        if kind == "as_of":
            entry = _t_as_of(test, matched, run, rules)
        elif kind == "boundary":
            entry = _t_boundary(test, matched, run)
        elif kind == "pending":
            entry = _t_pending(test, matched, run)
        else:
            entry = _t_negative(test, matched, run, rules)
        if run.skipped:
            entry["notes"] += f" {run.skipped} addresses without a resolved jurisdiction were not evaluated."
        out[test["test_id"]] = entry
    return out


def _load_inputs() -> tuple[list[dict], dict, list[str]]:
    warnings = []
    rules = []
    if paths.RULES_JSON.exists():
        rules = json.loads(paths.RULES_JSON.read_text(encoding="utf-8")).get("rules", [])
    if not rules:
        rules = json.loads((paths.FIXTURES / "rules.json").read_text(encoding="utf-8"))["rules"]
        warnings.append("submission/rules.json is empty or missing: using tests/fixtures/rules.json")
    if paths.JURISDICTIONS_JSON.exists():
        jur = json.loads(paths.JURISDICTIONS_JSON.read_text(encoding="utf-8"))
    else:
        jur = json.loads((paths.FIXTURES / "jurisdictions.json").read_text(encoding="utf-8"))
        warnings.append("derived/jurisdictions.json missing: using tests/fixtures/jurisdictions.json "
                        "(only ~11 addresses resolved)")
    return rules, jur, warnings


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m realrent.changes", description=__doc__)
    ap.add_argument("--out", type=Path, default=paths.CHANGES_JSON, help="output path")
    ap.add_argument("--dry-run", action="store_true", help="print instead of writing")
    args = ap.parse_args(argv)
    try:
        from realrent.engine import evaluate  # W3
    except ImportError as e:
        print(f"error: realrent.engine.evaluate is not available ({e}); merge W3 (feat/engine) first.",
              file=sys.stderr)
        return 2
    rules, jur, warnings = _load_inputs()
    for w in warnings:
        print(f"warning: {w}", file=sys.stderr)
    data = run_tests(evaluate, rules, jur)
    if warnings:
        for entry in data.values():
            entry["notes"] = "[FIXTURE INPUT, not a submission] " + entry["notes"]
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if args.dry_run:
        print(text, end="")
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
    for tid, entry in data.items():
        print(f"{tid}: {len(entry['affected_address_ids'])} affected, "
              f"{len(entry['conflict_flag_address_ids'])} conflict flags", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
