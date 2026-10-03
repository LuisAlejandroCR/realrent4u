# validate.py: checks the three submission files against the official schema and templates.
# Run `python -m realrent.validate` (exit 1 on any error); `--init` writes empty valid files.

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

from realrent import corpus, paths

RESULTS = {"applies", "unknown", "superseded", "not_yet_effective", "pending"}


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def check_rules(data) -> list[str]:
    errors = []
    if not isinstance(data, dict) or not isinstance(data.get("rules"), list):
        return ["rules.json: expected {\"rules\": [...]}"]
    validator = Draft202012Validator(_load(paths.RULE_SCHEMA))
    seen = set()
    for i, rule in enumerate(data["rules"]):
        rid = rule.get("team_rule_id", f"#{i}") if isinstance(rule, dict) else f"#{i}"
        for err in validator.iter_errors(rule):
            errors.append(f"rules.json {rid}: {err.message}")
        if rid in seen:
            errors.append(f"rules.json {rid}: duplicate team_rule_id")
        seen.add(rid)
        doc_id = rule.get("source_doc_id") if isinstance(rule, dict) else None
        quote = rule.get("quoted_span", "") if isinstance(rule, dict) else ""
        found = corpus.find_quote(doc_id, quote) if doc_id else corpus.quote_in_corpus(quote)
        if not found:
            errors.append(f"rules.json {rid}: quoted_span not found in source {doc_id}")
    return errors


def check_lookups(data, rule_ids: set[str]) -> list[str]:
    errors = []
    if not isinstance(data, dict) or "as_of" not in data or not isinstance(data.get("lookups"), dict):
        return ["lookups.json: expected {\"as_of\": ..., \"lookups\": {...}}"]
    expected = {a["address_id"] for a in corpus.addresses()}
    missing = expected - data["lookups"].keys()
    extra = data["lookups"].keys() - expected
    if missing:
        errors.append(f"lookups.json: {len(missing)} addresses missing, e.g. {sorted(missing)[:3]}")
    if extra:
        errors.append(f"lookups.json: unknown address ids {sorted(extra)[:3]}")
    for aid, items in data["lookups"].items():
        if not isinstance(items, list):
            errors.append(f"lookups.json {aid}: expected a list")
            continue
        for item in items:
            if item.get("result") not in RESULTS:
                errors.append(f"lookups.json {aid}: bad result {item.get('result')!r}")
            if item.get("team_rule_id") not in rule_ids:
                errors.append(f"lookups.json {aid}: unknown rule {item.get('team_rule_id')!r}")
            if not isinstance(item.get("conflict_flag", False), bool):
                errors.append(f"lookups.json {aid}: conflict_flag must be boolean")
            if not item.get("explanation"):
                errors.append(f"lookups.json {aid}: empty explanation")
    return errors


def check_changes(data) -> list[str]:
    errors = []
    if not isinstance(data, dict):
        return ["changes.json: expected an object keyed by test_id"]
    expected_tests = {t["test_id"] for t in _load(paths.CHANGE_TESTS)}
    for t in sorted(expected_tests - data.keys()):
        errors.append(f"changes.json: missing test {t}")
    ids = {a["address_id"] for a in corpus.addresses()}
    for tid, entry in data.items():
        for key in ("affected_address_ids", "conflict_flag_address_ids"):
            values = entry.get(key, [])
            if not isinstance(values, list):
                errors.append(f"changes.json {tid}: {key} must be a list")
                continue
            bad = [v for v in values if v not in ids]
            if bad:
                errors.append(f"changes.json {tid}: unknown address ids in {key}: {bad[:3]}")
        if "affected_address_ids" not in entry:
            errors.append(f"changes.json {tid}: missing affected_address_ids")
    return errors


def validate_all() -> list[str]:
    rules = _load(paths.RULES_JSON)
    rule_ids = {r.get("team_rule_id") for r in rules.get("rules", []) if isinstance(r, dict)}
    return (
        check_rules(rules)
        + check_lookups(_load(paths.LOOKUPS_JSON), rule_ids)
        + check_changes(_load(paths.CHANGES_JSON))
    )


def write_empty() -> None:
    paths.SUBMISSION.mkdir(exist_ok=True)
    tests = [t["test_id"] for t in _load(paths.CHANGE_TESTS)]
    empty = {
        paths.RULES_JSON: {"rules": []},
        paths.LOOKUPS_JSON: {
            "as_of": paths.DEFAULT_AS_OF,
            "lookups": {a["address_id"]: [] for a in corpus.addresses()},
        },
        paths.CHANGES_JSON: {
            t: {"affected_address_ids": [], "conflict_flag_address_ids": [], "notes": ""} for t in tests
        },
    }
    for path, data in empty.items():
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    if "--init" in argv:
        write_empty()
    errors = validate_all()
    for e in errors:
        print(e)
    print(f"{'FAIL' if errors else 'OK'}: {len(errors)} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
