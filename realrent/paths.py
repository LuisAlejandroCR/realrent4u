# paths.py: filesystem locations shared by every pipeline step.
# Starter pack lives in data/ (read-only); generated files go to submission/ and runs/.

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CORPUS = DATA / "corpus"
MANIFEST = CORPUS / "corpus_manifest.csv"
ADDRESSES = DATA / "data" / "sample_addresses.csv"
RULE_SCHEMA = DATA / "schema" / "rule_record.schema.json"
CHANGE_TESTS = DATA / "dev" / "change_tests.json"

SUBMISSION = ROOT / "submission"
RULES_JSON = SUBMISSION / "rules.json"
LOOKUPS_JSON = SUBMISSION / "lookups.json"
CHANGES_JSON = SUBMISSION / "changes.json"

RUNS = ROOT / "runs"

# Intermediate outputs shared between workstreams (see docs/PLAN.md, "Contracts").
DERIVED = ROOT / "derived"
JURISDICTIONS_JSON = DERIVED / "jurisdictions.json"
LOOKUPS_BY_DATE = DERIVED / "lookups"  # one <as_of>.json per query date, same shape as lookups.json

FIXTURES = ROOT / "tests" / "fixtures"

# Query dates the demo offers: the default plus every before/after date in the change tests.
DEMO_DATES = ["2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02"]

DEFAULT_AS_OF = "2026-10-01"
