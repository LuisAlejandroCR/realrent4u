# lookups.py: runs engine.evaluate over every sample address -> submission/lookups.json (as_of
# 2026-10-01) and derived/lookups/<date>.json for each date in paths.DEMO_DATES.
# Run `python -m realrent.lookups`; fixture rules never reach submission/ unless --fixtures is given.

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from realrent import corpus, engine, paths


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _warn(msg: str) -> None:
    print(f"\n{'!' * 72}\nWARNING: {msg}\n{'!' * 72}\n", file=sys.stderr)


def load_rules(force_fixtures: bool = False) -> tuple[list[dict], bool]:
    """(rules, from_fixtures). submission/rules.json if it has rules, else the test fixtures."""
    if not force_fixtures and paths.RULES_JSON.exists():
        rules = _read(paths.RULES_JSON).get("rules") or []
        if rules:
            return rules, False
    _warn("using tests/fixtures/rules.json (hand-written TEST rules, not extracted). "
          "Output is for development only.")
    return _read(paths.FIXTURES / "rules.json")["rules"], True


def load_jurisdictions() -> tuple[dict, bool]:
    """(address_id -> Jurisdiction, from_fixtures)."""
    if paths.JURISDICTIONS_JSON.exists():
        data, fx = _read(paths.JURISDICTIONS_JSON), False
    else:
        _warn("derived/jurisdictions.json not found; using tests/fixtures/jurisdictions.json "
              "(11 addresses). Others are treated as unresolved.")
        data, fx = _read(paths.FIXTURES / "jurisdictions.json"), True
    return {k: v for k, v in data.items() if not k.startswith("_")}, fx


def build(rules: list[dict], jurisdictions: dict, as_of: str) -> dict:
    lookups = {}
    for row in corpus.addresses():
        aid = row["address_id"]
        lookups[aid] = engine.evaluate(rules, row, jurisdictions.get(aid), as_of)
    return {"as_of": as_of, "lookups": lookups}


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def summary(data: dict) -> str:
    c = Counter(i["result"] for items in data["lookups"].values() for i in items)
    flags = sum(i.get("conflict_flag", False) for items in data["lookups"].values() for i in items)
    return f"{data['as_of']}: " + ", ".join(f"{k}={v}" for k, v in sorted(c.items())) + \
        f", conflict_flags={flags}"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fixtures", action="store_true",
                    help="use tests/fixtures/rules.json AND allow writing submission/lookups.json "
                         "(development only; that file will not validate against real rules.json)")
    args = ap.parse_args(argv)

    rules, rules_fx = load_rules(force_fixtures=args.fixtures)
    jurisdictions, jur_fx = load_jurisdictions()
    note = None
    if rules_fx or jur_fx:
        note = ("DEVELOPMENT OUTPUT built from test fixtures "
                f"(rules={'fixtures' if rules_fx else 'submission'}, "
                f"jurisdictions={'fixtures' if jur_fx else 'derived'}). Not a submission.")

    for as_of in paths.DEMO_DATES:
        data = build(rules, jurisdictions, as_of)
        out = {"_note": note, **data} if note else data
        target = paths.LOOKUPS_BY_DATE / f"{as_of}.json"
        _write(target, out)
        print(f"wrote {target.relative_to(paths.ROOT)}  {summary(data)}")

    if rules_fx and not args.fixtures:
        _warn("submission/lookups.json NOT written: rules came from fixtures. "
              "Run extraction first, or pass --fixtures to write it anyway.")
        return 0
    data = build(rules, jurisdictions, paths.DEFAULT_AS_OF)
    _write(paths.LOOKUPS_JSON, data)
    print(f"wrote {paths.LOOKUPS_JSON.relative_to(paths.ROOT)}  {summary(data)}")
    if jur_fx:
        _warn("submission/lookups.json was built with fixture jurisdictions; re-run after W2 "
              "writes derived/jurisdictions.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
