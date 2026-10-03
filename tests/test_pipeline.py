# test_pipeline.py: the one-command pipeline (order, stop on failure, offline env, --check) on a small
# copy of the repo, plus the CI guard on change tests T1, T3, T4, T5 over the committed rules.
# No network, no LLM. The guard skips with no rules, T3 flags without Hoboken/Jersey City bans.

import csv
import json
import shutil
from pathlib import Path

import pytest

from realrent import changes, paths, pipeline

D001_QUOTE = "AMENDING CHAPTER 13.63 OF THE BERKELEY MUNICIPAL CODE COORDINATED PRICING ALGORITHMS"
MINI_ADDRESSES = 12

RAW_RULE = {
    "jurisdiction": "Berkeley, CA", "level": "city", "category": "algorithmic_rent_setting",
    "status": "in_force", "title": "Coordinated pricing algorithm ban",
    "requirement": "Landlords may not use coordinated pricing algorithms to set rents.",
    "key_value": "", "citation": "BMC ch. 13.63", "quoted_span": D001_QUOTE,
    "effective_date": "2026-03-01", "enacted_date": "", "coverage_text": "", "built_cutoff_date": "",
    "built_cutoff_basis": "none", "built_cutoff_direction": "none", "min_units": 0,
    "exempts_small_owner_occupied": False, "exemptions": "", "penalty": "", "displaces_state_rule": False,
    "interaction": "", "conflict_note": "", "extraction_note": "", "confidence": 0.8,
}


def _write_csv(path: Path, header: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)


def mini_root(root: Path, raw: bool = True) -> Path:
    """A repo copy with one captured document (D001), 12 addresses, the real Census cache and, if raw,
    one cached model output for D001."""
    data = root / "data"
    shutil.copytree(paths.RULE_SCHEMA.parent, data / "schema")
    shutil.copytree(paths.CHANGE_TESTS.parent, data / "dev")
    with paths.MANIFEST.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        header, rows = reader.fieldnames, list(reader)
    for r in rows:
        if r["doc_id"] != "D001":
            r.update(status="link-only", text_file="")
    _write_csv(data / "corpus" / "corpus_manifest.csv", header, rows)
    (data / "corpus" / "text").mkdir()
    shutil.copyfile(paths.CORPUS / "text" / "D001.txt", data / "corpus" / "text" / "D001.txt")
    with paths.ADDRESSES.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        header, rows = reader.fieldnames, list(reader)[:MINI_ADDRESSES]
    _write_csv(data / "data" / "sample_addresses.csv", header, rows)
    (root / "derived").mkdir()
    pipeline.link_dir(root / "derived" / "census", paths.DERIVED / "census")
    if raw:
        (root / "runs" / "raw").mkdir(parents=True)
        (root / "runs" / "raw" / "D001.json").write_text(json.dumps({"rules": [RAW_RULE], "meta": {}}))
    return root


GENERATED = ["submission/rules.json", "submission/lookups.json", "submission/changes.json",
             "derived/jurisdictions.json"] + [f"derived/lookups/{d}.json" for d in paths.DEMO_DATES]


# ---------------------------------------------------------------- orchestration (always runs)


def test_plan_is_offline_by_default():
    steps = pipeline.plan(online=False, skip_extract=False, have_key=True)
    assert [s.name for s in steps] == ["extract", "resolve", "lookups", "changes", "validate"]
    assert steps[0].argv == ["realrent.extract", "--offline"]
    assert steps[1].argv == ["realrent.resolve", "--offline"]
    online = pipeline.plan(online=True, skip_extract=False, have_key=False)
    assert online[0].argv == ["realrent.extract", "--offline"]  # no key: cache only
    assert online[1].argv == ["realrent.resolve"]
    assert [s.name for s in pipeline.plan(online=False, skip_extract=True, have_key=False)][0] == "resolve"


def test_offline_steps_get_no_model_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("REALRENT_LLM_EXPLAIN", "1")
    env = pipeline.step_env(online=False)
    assert "ANTHROPIC_API_KEY" not in env and "REALRENT_LLM_EXPLAIN" not in env
    assert pipeline.step_env(online=True)["ANTHROPIC_API_KEY"] == "sk-test"


def test_check_refuses_online():
    with pytest.raises(SystemExit) as e:
        pipeline.main(["--check", "--online"])
    assert e.value.code == 2


def test_runs_every_step_then_check_is_clean(tmp_path, capfd, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    root = mini_root(tmp_path / "repo")
    assert pipeline.run(root, stage=tmp_path / "s1") == 0
    out = capfd.readouterr().out
    for rel in GENERATED:
        assert (root / rel).exists(), rel
    rules = json.loads((root / "submission" / "rules.json").read_text())["rules"]
    assert [(r["source_doc_id"], r["quoted_span"]) for r in rules] == [("D001", D001_QUOTE)]
    assert len(list((root / "runs").glob("extract-*.jsonl"))) == 1  # A14 audit log promoted
    assert f"addresses    {MINI_ADDRESSES}" in out and "rules        1" in out and "T5 0/0" in out

    # A2: regenerating from the same inputs changes nothing, and --check writes nothing.
    assert pipeline.run(root, check=True, stage=tmp_path / "s2") == 0
    assert "OK: regenerating changes none" in capfd.readouterr().out
    assert len(list((root / "runs").glob("extract-*.jsonl"))) == 1

    # A hand edit to a committed output is caught.
    target = root / "submission" / "changes.json"
    target.write_text(target.read_text().replace('"notes": "', '"notes": "edited by hand ', 1))
    assert pipeline.run(root, check=True, stage=tmp_path / "s3") == 1
    out = capfd.readouterr().out
    assert "DIFFERS  submission/changes.json" in out and "edited by hand" in out
    assert "DIFFERS  submission/rules.json" not in out


def test_check_skips_lookups_and_changes_while_placeholders(tmp_path, capfd, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    root = mini_root(tmp_path / "repo")
    assert pipeline.run(root, stage=tmp_path / "s1") == 0
    # What `validate --init` leaves before the final run: empty lookups and change tests.
    lookups = json.loads((root / "submission" / "lookups.json").read_text())
    (root / "submission" / "lookups.json").write_text(json.dumps(
        {"as_of": lookups["as_of"], "lookups": {a: [] for a in lookups["lookups"]}}, indent=2) + "\n")
    tests = json.loads((root / "submission" / "changes.json").read_text())
    (root / "submission" / "changes.json").write_text(json.dumps(
        {t: {"affected_address_ids": [], "conflict_flag_address_ids": [], "notes": ""} for t in tests}))
    shutil.rmtree(root / "derived" / "lookups")
    capfd.readouterr()
    assert pipeline.run(root, check=True, stage=tmp_path / "s2") == 0
    out = capfd.readouterr().out
    assert "same     submission/rules.json" in out and "same     derived/jurisdictions.json" in out
    assert "skipped  submission/changes.json" in out and "skipped  derived/lookups/2026-10-01.json" in out
    # rules.json is still checked (A2).
    rules = root / "submission" / "rules.json"
    rules.write_text(rules.read_text().replace("BMC ch. 13.63", "BMC ch. 99"))
    assert pipeline.run(root, check=True, stage=tmp_path / "s3") == 1
    assert "DIFFERS  submission/rules.json" in capfd.readouterr().out


def test_stops_at_first_failing_step_and_writes_nothing(tmp_path, capfd):
    root = mini_root(tmp_path / "repo")
    calls = []

    def runner(argv, cwd, env):
        calls.append(argv[0])
        return 3 if argv[0] == "realrent.lookups" else pipeline.subprocess_runner(argv, cwd, env)

    assert pipeline.run(root, runner=runner, stage=tmp_path / "s") == 1
    assert calls == ["realrent.extract", "realrent.resolve", "realrent.lookups"]
    assert "FAILED at lookups: exited with code 3" in capfd.readouterr().err
    assert not (root / "submission").exists() and not (root / "derived" / "jurisdictions.json").exists()


def test_missing_model_cache_fails_extract_and_keeps_rules(tmp_path, capfd):
    root = mini_root(tmp_path / "repo", raw=False)
    (root / "submission").mkdir()
    committed = '{"rules": ["committed"]}\n'
    (root / "submission" / "rules.json").write_text(committed)
    assert pipeline.run(root, stage=tmp_path / "s") == 1
    err = capfd.readouterr().err
    assert "FAILED at extract: 1 documents have no model output (first: D001" in err and "runs/raw/" in err
    assert (root / "submission" / "rules.json").read_text() == committed


def test_skip_extract_needs_rules(tmp_path, capfd):
    root = mini_root(tmp_path / "repo")
    (root / "submission").mkdir()
    (root / "submission" / "rules.json").write_text('{"rules": []}\n')
    calls = []
    assert pipeline.run(root, skip_extract=True, runner=lambda *a: calls.append(a) or 0,
                        stage=tmp_path / "s") == 1
    assert calls == []
    assert "FAILED at rules: submission/rules.json has no rules" in capfd.readouterr().err


# ---------------------------------------------------------------- CI guard on T1-T5 (skips until rules land)


def _load(path: Path):
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {k: v for k, v in data.items() if not k.startswith("_")}


RULES = _load(paths.RULES_JSON).get("rules") or []
JUR = _load(paths.JURISDICTIONS_JSON)
NO_RULES = "submission/rules.json has no rules; the T1-T5 guard runs once extracted rules are committed"


def _ids(pred) -> list[str]:
    return sorted(a for a, j in JUR.items() if pred(j))


BAN_CITIES = ("Hoboken, NJ", "Jersey City, NJ")
CA = _ids(lambda j: j["state"] == "CA")
NJ = _ids(lambda j: j["state"] == "NJ")
MA = _ids(lambda j: j["state"] == "MA")
LOCAL_BANS = _ids(lambda j: j.get("jurisdiction") in BAN_CITIES)
# Cities whose local algorithmic-pricing ban was extracted (T2/T3 sources D032-D035 are link-only).
CITIES_WITH_BANS = sorted({r.get("jurisdiction") for r in RULES if r.get("jurisdiction") in BAN_CITIES
                           and r.get("category") == "algorithmic_rent_setting" and r.get("status") != "failed"})


def test_expected_sets_from_jurisdictions():
    assert (len(CA), len(NJ), len(MA), len(LOCAL_BANS)) == (250, 140, 110, 90)


@pytest.fixture(scope="module", params=["regenerated", "committed"])
def change_results(request):
    """changes.json computed now from the committed rules and jurisdictions, and as committed."""
    if not RULES:
        pytest.skip(NO_RULES)
    if request.param == "committed":
        if pipeline.is_placeholder(paths.ROOT):
            pytest.skip("submission/changes.json is still the empty placeholder; regenerate it with "
                        "`uv run python -m realrent.pipeline`")
        return _load(paths.CHANGES_JSON)
    from realrent import engine

    with pytest.MonkeyPatch.context() as mp:
        for k in pipeline.LLM_ENV:
            mp.delenv(k, raising=False)
        return changes.run_tests(engine.evaluate, RULES, JUR)


def _same(got: list[str], expected: list[str], what: str) -> None:
    missing, extra = sorted(set(expected) - set(got)), sorted(set(got) - set(expected))
    assert not missing and not extra, (
        f"{what}: got {len(got)}, expected {len(expected)}; missing {len(missing)} e.g. {missing[:5]}, "
        f"extra {len(extra)} e.g. {extra[:5]}")


def test_t1_affects_every_ca_address(change_results):
    _same(change_results["T1"]["affected_address_ids"], CA, "T1 affected (all CA)")


def test_t3_affects_every_nj_address(change_results):
    _same(change_results["T3"]["affected_address_ids"], NJ, "T3 affected (all NJ)")


def test_t3_conflict_flags_hoboken_and_jersey_city(change_results):
    """Flags go exactly on the addresses of the cities whose ban was extracted (both: all 90)."""
    if not CITIES_WITH_BANS:
        pytest.skip("no Hoboken/Jersey City ban rules extracted yet (link-only sources)")
    expected = _ids(lambda j: j.get("jurisdiction") in CITIES_WITH_BANS)
    _same(change_results["T3"]["conflict_flag_address_ids"], expected,
          f"T3 conflict flags ({' + '.join(CITIES_WITH_BANS)})")


def test_t4_affects_every_ma_address(change_results):
    _same(change_results["T4"]["affected_address_ids"], MA, "T4 affected (all MA)")


def test_t5_affects_nobody(change_results):
    _same(change_results["T5"]["affected_address_ids"], [], "T5 affected (struck measure)")
